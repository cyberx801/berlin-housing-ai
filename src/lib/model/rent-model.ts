import featureSchema from "../../../services/rent-api/artifacts/rent_v1/feature_schema.json";
import linearModel from "../../../services/rent-api/artifacts/rent_v1/linear_model.json";
import metadata from "../../../services/rent-api/artifacts/rent_v1/metadata.json";
import residualGrid from "../../../services/rent-api/artifacts/rent_v1/residual_quantiles.json";

// The demo rent model (D-058, D-061), evaluated in-process. This is a port of
// services/rent-api/rent_api/inference.py: same artifacts, same request checks, same answer shape.
// The model is a log-linear regression on log(rent per m²), trained on synthetic data, so every
// answer says `synthetic: true`. Where the Python service samples the training distribution to fill
// in missing inputs, this port takes the exact expectation instead, so the point estimate and the
// explanation are exact and only the interval is sampled (with a fixed seed: same input, same answer).

export const API_VERSION = "1.0";
const LEVEL = 0.8;
const SEED = 20261030;
const N_SAMPLES = 4000;
const STALE_AFTER_DAYS = 180;
const LOW_TAIL = (1 - LEVEL) / 2;
const HIGH_TAIL = 1 - LOW_TAIL;

const REQUEST_FIELDS = new Set([
  "bezirk", "ortsteil", "ortsteil_code", "property_type", "rooms", "area_m2", "floor", "total_floors", "building_era",
  "energy_class", "condition", "has_lift", "has_balcony", "furnishing", "transit_distance_min", "lat", "lon",
]);
const ENUMS: Record<string, ReadonlySet<string>> = {
  property_type: new Set(["apartment", "maisonette", "penthouse", "loft", "house", "other"]),
  building_era: new Set(["pre_1919", "1919_1949", "1950_1972", "1973_1990", "1991_2009", "2010_plus", "unknown"]),
  energy_class: new Set(["A_plus", "A", "B", "C", "D", "E", "F", "G", "H", "unknown"]),
  condition: new Set(["first_occupancy", "renovated", "well_kept", "needs_renovation", "unknown"]),
  furnishing: new Set(["unfurnished", "partly_furnished", "furnished", "unknown"]),
};

type Counts = Record<string, number>;
type FieldIssue = { field: string; issue: string };
type Warning = { code: string; message: string; field?: string };
type Terms = Record<string, number>;
interface Outcome {
  p: number;
  terms: Terms;
}

const schema = featureSchema as unknown as {
  bezirke: string[];
  ortsteil_by_bezirk: Record<string, Counts>;
  ortsteil_bezirk: Record<string, string>;
  alkis_code_to_name: Record<string, string>;
  alkis_name_alias: Record<string, string>;
  centroids: Record<string, [number, number]>;
  brandenburg_gate: [number, number];
  ranges: Record<string, [number, number]>;
  enum_map: Record<string, Record<string, unknown>>;
  energy_classes: string[];
  marginals: Record<string, Counts> & { floor_total_pairs: [number, number, number][] };
  cat_freq: Record<string, Counts>;
  ignored_request_fields: string[];
  t_ref: number;
  data_reference_date: string;
  reference_period: { start: string; end: string };
};
const lin = linearModel as unknown as {
  num_features: string[];
  mean: number[];
  scale: number[];
  coef_num: number[];
  cat_features: string[];
  coef_cat: Record<string, Counts>;
  intercept: number;
};
const meta = metadata as unknown as {
  name: string;
  version: string;
  trained_at: string;
  data?: { synthetic?: boolean };
};
const residuals = (residualGrid as { log_residual_quantiles: number[] }).log_residual_quantiles;

export interface RentModelResult {
  status: number;
  body: Record<string, unknown>;
}

/** Indexing that fails loudly: the artifacts are trusted, a missing key is a bug. */
const at = <T>(a: readonly T[], i: number): T => {
  const v = a[i];
  if (v === undefined) throw new Error(`rent model: index ${i} out of range`);
  return v;
};
const get = <T>(o: Record<string, T>, k: string): T => {
  const v = o[k];
  if (v === undefined) throw new Error(`rent model: missing key ${k}`);
  return v;
};
const nfc = (value: unknown) => (typeof value === "string" ? value.normalize("NFC") : value);
const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);
const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * p) / 2) ** 2 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(((lon2 - lon1) * p) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** Linear interpolation on the 1,001-point residual quantile grid (numpy.interp). */
function residualQuantile(level: number) {
  const x = Math.min(Math.max(level, 0), 1) * (residuals.length - 1);
  const i = Math.min(Math.floor(x), residuals.length - 2);
  return at(residuals, i) + (x - i) * (at(residuals, i + 1) - at(residuals, i));
}

/** Small seeded generator (mulberry32), so the same request always gives the same interval. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** numpy.quantile, linear interpolation, on a sorted array. */
function quantile(sorted: number[], q: number) {
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return at(sorted, lo) + (at(sorted, hi) - at(sorted, lo)) * (pos - lo);
}

function validate(req: Record<string, unknown>) {
  const errs: FieldIssue[] = Object.keys(req)
    .filter((k) => !REQUEST_FIELDS.has(k))
    .map((field) => ({ field, issue: "unknown field" }));

  const num = (name: string, lo: number, hi: number, opts: { integer?: boolean; half?: boolean; required?: boolean } = {}) => {
    const v = req[name];
    if (v === null || v === undefined) {
      if (opts.required) errs.push({ field: name, issue: "is required" });
      return null;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) errs.push({ field: name, issue: "must be a number" });
    else if (opts.integer && !Number.isInteger(v)) errs.push({ field: name, issue: "must be an integer" });
    else if (opts.half && !Number.isInteger(v * 2)) errs.push({ field: name, issue: "must be a multiple of 0.5" });
    else if (!(lo <= v && v <= hi)) errs.push({ field: name, issue: `must be between ${lo} and ${hi}` });
    else return v;
    return null;
  };

  const bezirk = nfc(req.bezirk);
  if (bezirk === null || bezirk === undefined) errs.push({ field: "bezirk", issue: "is required" });
  else if (typeof bezirk !== "string" || !schema.bezirke.includes(bezirk))
    errs.push({ field: "bezirk", issue: "must be one of the 12 Berlin Bezirke" });
  if (req.property_type === null || req.property_type === undefined) errs.push({ field: "property_type", issue: "is required" });
  for (const [field, allowed] of Object.entries(ENUMS)) {
    const v = req[field];
    if (v !== null && v !== undefined && !(typeof v === "string" && allowed.has(v)))
      errs.push({ field, issue: "invalid value" });
  }
  const rooms = num("rooms", 1, 10, { half: true, required: true });
  const area = num("area_m2", 10, 500, { required: true });
  const floor = num("floor", -1, 60, { integer: true });
  const total = num("total_floors", 1, 60, { integer: true });
  num("transit_distance_min", 0, 60, { integer: true });
  if (floor !== null && total !== null && floor > total) errs.push({ field: "floor", issue: "must be <= total_floors" });
  for (const field of ["has_lift", "has_balcony"]) {
    const v = req[field];
    if (v !== null && v !== undefined && typeof v !== "boolean") errs.push({ field, issue: "must be boolean or null" });
  }
  if ((req.lat === null || req.lat === undefined) !== (req.lon === null || req.lon === undefined))
    errs.push({ field: "lat", issue: "lat and lon must be given together" });
  return { errs, v: { bezirk: bezirk as string, rooms: rooms as number, area: area as number, floor, total } };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const normalise = (counts: Counts) => {
  const keys = Object.keys(counts);
  const total = sum(keys.map((k) => get(counts, k)));
  return keys.map((k) => ({ key: k, p: get(counts, k) / total }));
};

interface Resolved {
  known: Record<string, string | number>;
  /** Marginal distributions of inputs the request did not give. */
  dist: Record<string, Counts>;
  pairs: [number, number, number][] | null;
}

function resolve(
  req: Record<string, unknown>,
  v: ReturnType<typeof validate>["v"],
  warnings: Warning[],
  missing: string[],
  imputed: { field: string; strategy: string }[],
): Resolved | FieldIssue {
  const marg = schema.marginals;
  const known: Resolved["known"] = { bezirk: v.bezirk };
  const dist: Resolved["dist"] = {};

  const marginalise = (field: string, requestName: string) => {
    missing.push(requestName);
    imputed.push({ field: requestName, strategy: "train_distribution_marginalised" });
    dist[field] = get(marg as Record<string, Counts>, field);
  };

  let name: string | null = null;
  if (req.ortsteil_code) {
    const found = schema.alkis_code_to_name[req.ortsteil_code as string];
    if (found === undefined) return { field: "ortsteil_code", issue: "unknown ALKIS Ortsteil code" };
    name = found;
  }
  if (req.ortsteil) {
    const given = nfc(req.ortsteil) as string;
    if (name !== null && given !== name) return { field: "ortsteil", issue: "does not match ortsteil_code" };
    name = given;
  }
  let key: string | null = null;
  if (name !== null) {
    key = has(schema.alkis_name_alias, name) ? get(schema.alkis_name_alias, name) : name;
    if (!has(schema.ortsteil_bezirk, key)) {
      warnings.push({
        code: "LOW_SUPPORT_REGION",
        field: "ortsteil",
        message: "This Ortsteil is not in the training data; the estimate uses the Bezirk average.",
      });
      key = null;
    } else if (get(schema.ortsteil_bezirk, key) !== v.bezirk) {
      return { field: "ortsteil", issue: "does not belong to bezirk" };
    } else if (has(schema.alkis_name_alias, name)) {
      warnings.push({
        code: "LOW_SUPPORT_REGION",
        field: "ortsteil",
        message: "Training data merges Alt- and Neu-Hohenschoenhausen; the merged level is used.",
      });
    }
  }
  if (key !== null) known.ortsteil_key = key;
  else {
    missing.push("ortsteil");
    imputed.push({ field: "ortsteil", strategy: "bezirk_distribution" });
    dist.ortsteil_key = get(schema.ortsteil_by_bezirk, v.bezirk);
  }

  const rooms = Math.min(Math.max(Math.floor(v.rooms + 0.5), 1), 5);
  if (rooms !== v.rooms)
    warnings.push({ code: "OUT_OF_DISTRIBUTION", field: "rooms", message: "The model knows whole rooms 1-5; the value was adjusted." });
  known.rooms = rooms;
  known.area_m2 = v.area;
  const [lo, hi] = get(schema.ranges, "area_m2");
  if (!(lo <= v.area && v.area <= hi))
    warnings.push({
      code: "OUT_OF_DISTRIBUTION",
      field: "area_m2",
      message: `Living area is outside the training range (${lo.toFixed(0)}-${hi.toFixed(0)} m2).`,
    });

  const categorical = (field: string, requestName: string, mapper: (x: string) => string | null | undefined) => {
    const value = req[requestName] as string | null | undefined;
    const given = value !== null && value !== undefined && value !== "unknown";
    const mapped = given ? mapper(value) : null;
    if (mapped === null || mapped === undefined) {
      marginalise(field, requestName);
      if (given)
        warnings.push({
          code: "INPUT_INCONSISTENT",
          field: requestName,
          message: `'${value}' has no counterpart in the training data and was treated as unknown.`,
        });
    } else known[field] = mapped;
  };
  const mapOf = (field: string) => (x: string) =>
    has(get(schema.enum_map, field), x) ? (get(get(schema.enum_map, field), x) as string) : null;

  categorical("building_era", "building_era", mapOf("building_era"));
  categorical("energy_class", "energy_class", (x) => (schema.energy_classes.includes(x) ? x : null));
  categorical("condition", "condition", mapOf("condition"));
  for (const field of ["has_lift", "has_balcony"]) {
    const given = req[field];
    if (given === null || given === undefined) marginalise(field, field);
    else known[field] = given ? 1 : 0;
  }
  const furnishing = req.furnishing as string | null | undefined;
  const furnished = furnishing && has(get(schema.enum_map, "furnishing"), furnishing) ? get(get(schema.enum_map, "furnishing"), furnishing) : null;
  if (furnished === null || furnished === undefined) marginalise("furnished", "furnishing");
  else known.furnished = furnished as number;

  let floor = v.floor;
  const total = v.total;
  if (floor === -1) {
    floor = 0;
    warnings.push({
      code: "OUT_OF_DISTRIBUTION",
      field: "floor",
      message: "Basement floors are not in the training data; treated as ground floor.",
    });
  }
  if ((floor !== null && floor > 8) || (total !== null && total > 8))
    warnings.push({
      code: "OUT_OF_DISTRIBUTION",
      field: "floor",
      message: "Floor counts above 8 are not in the training data; the value was capped.",
    });
  if (floor !== null) known.floor = Math.min(floor, 8);
  if (total !== null) known.total_floors = Math.min(total, 8);
  if (floor === null) {
    missing.push("floor");
    imputed.push({ field: "floor", strategy: "train_distribution_marginalised" });
  }
  if (total === null) {
    missing.push("total_floors");
    imputed.push({ field: "total_floors", strategy: "train_distribution_marginalised" });
  }
  let pairs: Resolved["pairs"] = null;
  if (floor === null || total === null) {
    const all = marg.floor_total_pairs;
    const some = all.filter(
      (p) => (floor === null || p[0] === known.floor) && (total === null || p[1] === known.total_floors),
    );
    pairs = some.length ? some : all;
  }
  return { known, dist, pairs };
}

// ---- the model as a sum of independent terms in log(rent per m2) -------------------------------

const numIndex = (f: string) => lin.num_features.indexOf(f);
const numTerm = (f: string, value: number) => ((value - at(lin.mean, numIndex(f))) / at(lin.scale, numIndex(f))) * at(lin.coef_num, numIndex(f));
const catTerm = (f: string, value: string) => (has(get(lin.coef_cat, f), value) ? get(get(lin.coef_cat, f), value) : 0); // unseen -> 0, as in training
const catAverage = (f: string) => {
  const freq = get(schema.cat_freq, f);
  const total = sum(Object.values(freq));
  return sum(Object.entries(freq).map(([k, c]) => (catTerm(f, k) * c) / total));
};

function centreKm(key: string) {
  const [lat, lon] = get(schema.centroids, key);
  return haversineKm(lat, lon, schema.brandenburg_gate[0], schema.brandenburg_gate[1]);
}

/** Independent discrete components. A given input is one outcome with probability 1. */
function components(r: Resolved): Outcome[][] {
  const { known, dist, pairs } = r;
  const out: Outcome[][] = [];
  const fixed: Terms = {};
  const add = (group: string, term: number) => {
    fixed[group] = (fixed[group] ?? 0) + term;
  };
  add("bezirk", catTerm("bezirk", known.bezirk as string));
  add("rooms", numTerm("rooms", known.rooms as number));
  add("area_m2", numTerm("area_m2", known.area_m2 as number));
  add("market_period", numTerm("t_month", schema.t_ref));
  for (const f of ["building_era", "energy_class", "condition"]) {
    if (has(known, f)) add(f, catTerm(f, known[f] as string));
  }
  for (const f of ["has_lift", "has_balcony", "furnished"]) {
    if (has(known, f)) add(f, numTerm(f, known[f] as number));
  }
  const locationTerms = (key: string): Terms => ({
    location: catTerm("ortsteil_key", key) + numTerm("ortsteil_centre_km", centreKm(key)),
  });
  if (has(known, "ortsteil_key")) {
    const t = locationTerms(known.ortsteil_key as string);
    add("location", t.location ?? 0);
  } else {
    out.push(normalise(get(dist, "ortsteil_key")).map(({ key, p }) => ({ p, terms: locationTerms(key) })));
  }
  for (const f of ["building_era", "energy_class", "condition"]) {
    if (!has(known, f)) out.push(normalise(get(dist, f)).map(({ key, p }) => ({ p, terms: { [f]: catTerm(f, key) } })));
  }
  for (const f of ["has_lift", "has_balcony", "furnished"]) {
    if (!has(known, f)) out.push(normalise(get(dist, f)).map(({ key, p }) => ({ p, terms: { [f]: numTerm(f, Number(key)) } })));
  }
  if (pairs) {
    const total = sum(pairs.map((p) => p[2]));
    out.push(
      pairs.map(([floor, floors, count]) => ({
        p: count / total,
        terms: { floor: numTerm("floor", floor), total_floors: numTerm("total_floors", floors) },
      })),
    );
  } else {
    add("floor", numTerm("floor", known.floor as number));
    add("total_floors", numTerm("total_floors", known.total_floors as number));
  }
  out.push([{ p: 1, terms: fixed }]);
  return out;
}

const totalOf = (terms: Terms) => sum(Object.values(terms));

/** Expected effect of each feature group on log(rent per m2) against the average training listing. */
function explain(parts: Outcome[][], predMean: number) {
  const expected: Terms = {};
  for (const comp of parts)
    for (const o of comp) for (const [g, t] of Object.entries(o.terms)) expected[g] = (expected[g] ?? 0) + o.p * t;
  // What an average training listing has, for the categorical terms. Numeric terms are already centred.
  const centre: Terms = {
    location: catAverage("ortsteil_key"),
    bezirk: catAverage("bezirk"),
    building_era: catAverage("building_era"),
    energy_class: catAverage("energy_class"),
    condition: catAverage("condition"),
  };
  const grouped: Terms = {};
  for (const [g, e] of Object.entries(expected)) {
    const target = g === "bezirk" ? "location" : g; // Bezirk and Ortsteil are one factor: location
    grouped[target] = (grouped[target] ?? 0) + e - (centre[g] ?? 0);
  }
  return { baseline: Math.exp(predMean - sum(Object.values(grouped))), grouped };
}

export interface RentModelOptions {
  requestId: string;
  now?: Date;
}

export function predictRent(request: unknown, { requestId, now = new Date() }: RentModelOptions): RentModelResult {
  const error = (status: number, code: string, message: string, details: FieldIssue[] = []): RentModelResult => ({
    status,
    body: { api_version: API_VERSION, request_id: requestId, error: { code, message, details, retryable: false } },
  });

  if (typeof request !== "object" || request === null || Array.isArray(request))
    return error(422, "VALIDATION_ERROR", "Request must be a JSON object.");
  const req = request as Record<string, unknown>;
  const { errs, v } = validate(req);
  if (errs.length) return error(422, "VALIDATION_ERROR", `Request has ${errs.length} invalid field(s).`, errs);

  const warnings: Warning[] = [];
  const missing: string[] = [];
  const imputed: { field: string; strategy: string }[] = [];
  const resolved = resolve(req, v, warnings, missing, imputed);
  if ("issue" in resolved) return error(422, "VALIDATION_ERROR", "Request has 1 invalid field.", [resolved]);

  const area = resolved.known.area_m2 as number;
  const parts = components(resolved);
  const base = lin.intercept;
  const predMean = base + sum(parts.map((comp) => sum(comp.map((o) => o.p * totalOf(o.terms)))));
  const stochastic = parts.filter((comp) => comp.length > 1);

  const point = Math.exp(predMean) * area;
  let lower: number;
  let upper: number;
  if (stochastic.length === 0) {
    lower = point * Math.exp(residualQuantile(LOW_TAIL));
    upper = point * Math.exp(residualQuantile(HIGH_TAIL));
  } else {
    const rand = mulberry32(SEED);
    const fixedPart = base + sum(parts.filter((c) => c.length === 1).map((c) => totalOf(at(c, 0).terms)));
    const draws: number[] = [];
    for (let i = 0; i < N_SAMPLES; i++) {
      let pred = fixedPart;
      for (const comp of stochastic) {
        let u = rand();
        let chosen = at(comp, comp.length - 1);
        for (const o of comp) {
          if (u < o.p) {
            chosen = o;
            break;
          }
          u -= o.p;
        }
        pred += totalOf(chosen.terms);
      }
      draws.push(Math.exp(pred + residualQuantile(rand())) * area);
    }
    draws.sort((a, b) => a - b);
    lower = quantile(draws, LOW_TAIL);
    upper = quantile(draws, HIGH_TAIL);
  }
  const { baseline, grouped } = explain(parts, predMean);

  const reference = new Date(`${schema.data_reference_date}T00:00:00Z`);
  const ageDays = Math.floor((now.getTime() - reference.getTime()) / 86_400_000);
  if (ageDays > STALE_AFTER_DAYS)
    warnings.push({
      code: "STALE_MODEL",
      message: `Training data ends ${schema.data_reference_date}; rents may have moved since.`,
    });
  warnings.push({
    code: "TRAINING_DATA_UNVERIFIED",
    message: "Demo model: the training data is synthetic. Not a Berlin market estimate.",
  });
  const factors = Object.entries(grouped)
    .map(([feature, c]) => ({ feature, effect_pct: round((Math.exp(c) - 1) * 100, 1) }))
    .sort((a, b) => Math.abs(b.effect_pct) - Math.abs(a.effect_pct));

  return {
    status: 200,
    body: {
      api_version: API_VERSION,
      request_id: requestId,
      generated_at: now.toISOString().replace(/\.\d{3}Z$/, "+00:00"),
      estimate: {
        monthly_cold_rent: { value: round(point, 2), currency: "EUR" },
        rent_per_m2: { value: round(point / area, 2), currency: "EUR" },
        interval: { lower: round(lower, 2), upper: round(upper, 2), level: LEVEL, method: "split_conformal_log" },
      },
      model: {
        name: meta.name,
        version: `${meta.version}+linear`,
        trained_at: meta.trained_at,
        training_data: {
          source_id: "kaggle-berlin-5csv",
          synthetic: meta.data?.synthetic ?? true,
          reference_period: schema.reference_period,
        },
      },
      data_reference_date: schema.data_reference_date,
      inputs: {
        missing: [...new Set(missing)].sort(),
        imputed,
        ignored: schema.ignored_request_fields.filter((f) => req[f] !== null && req[f] !== undefined),
      },
      warnings,
      explanation: {
        method: "log-linear coefficients",
        baseline_rent_per_m2: round(baseline, 2),
        factors: factors.slice(0, 8),
      },
    },
  };
}
