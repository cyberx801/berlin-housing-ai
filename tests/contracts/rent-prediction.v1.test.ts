import { readFileSync } from "node:fs";
import path from "node:path";
import { readPredictionConfig } from "@/lib/api/prediction/config";
import { interpretPredictionResponse } from "@/lib/api/prediction/interpret";
import { PropertyAnalysisService, createTransport } from "@/lib/api/prediction/service";
import { createDisabledTransport, createHttpTransport } from "@/lib/api/prediction/transports";
import {
  rentPredictionRequestV1,
  rentPredictionResponseV1,
  toRentPredictionRequest,
  type NameLookup,
} from "@/lib/contracts/rent-prediction.v1";
import type { PropertyInput } from "@/lib/validation/property";

// Fixtures are read from disk, never imported, so they can't leak into the src/ bundle graph.
const FIXTURES = path.join(__dirname, "fixtures");
const fixtureText = (name: string) => readFileSync(path.join(FIXTURES, name), "utf8");
const fixture = (name: string): unknown => JSON.parse(fixtureText(name));

const RID = "test-request-id";

const names: NameLookup = {
  bezirkName: (code) => ({ "01": "Mitte", "08": "Neukölln" })[code],
  ortsteilName: (code) => ({ "0102": "Moabit" })[code],
};

const input: PropertyInput = {
  bezirkCode: "01",
  ortsteilCode: "0102",
  address: "Turmstraße, near the park",
  propertyType: "apartment",
  areaM2: 65,
  rooms: 2.5,
  floor: 2,
  totalFloors: 5,
  buildingEra: "unknown",
  energyClass: "unknown",
  condition: "unknown",
  hasLift: null,
  hasBalcony: true,
  furnishing: "unfurnished",
  transitMinutes: null,
};

describe("request schema", () => {
  it("accepts the documented example request", () => {
    expect(rentPredictionRequestV1.safeParse(fixture("rent.v1.request.json")).success).toBe(true);
  });

  it("rejects unknown fields (no silent schema drift)", () => {
    const withExtra = { ...(fixture("rent.v1.request.json") as object), furnished: true };
    expect(rentPredictionRequestV1.safeParse(withExtra).success).toBe(false);
  });

  it("requires lat and lon together and a floor within the building", () => {
    const base = fixture("rent.v1.request.json") as Record<string, unknown>;
    expect(rentPredictionRequestV1.safeParse({ ...base, lat: 52.5 }).success).toBe(false);
    expect(rentPredictionRequestV1.safeParse({ ...base, floor: 6, total_floors: 5 }).success).toBe(false);
  });
});

describe("toRentPredictionRequest", () => {
  it("produces exactly the documented example from the matching form input", () => {
    expect(toRentPredictionRequest(input, names)).toEqual(fixture("rent.v1.request.json"));
  });

  it("never sends the free-text address or coordinates", () => {
    const request = toRentPredictionRequest(input, names);
    expect(JSON.stringify(request)).not.toContain("Turmstraße");
    expect(request.lat).toBeNull();
    expect(request.lon).toBeNull();
  });

  it("drops an Ortsteil code that has no official name", () => {
    const request = toRentPredictionRequest({ ...input, ortsteilCode: "9999" }, names);
    expect(request.ortsteil).toBeNull();
    expect(request.ortsteil_code).toBeNull();
  });

  it("refuses an unknown Bezirk instead of sending a guess", () => {
    expect(() => toRentPredictionRequest({ ...input, bezirkCode: "99" }, names)).toThrow(/Bezirk/);
  });
});

describe("response schema", () => {
  it.each(["rent.v1.ok.json", "rent.v1.ok-no-interval.json", "rent.v1.ok-observed.json", "rent.v1.ok-no-flag.json"])(
    "accepts %s",
    (name) => {
      expect(rentPredictionResponseV1.safeParse(fixture(name)).success).toBe(true);
    },
  );

  it("reads the draft.2 additions", () => {
    const parsed = rentPredictionResponseV1.parse(fixture("rent.v1.ok.json"));
    expect(parsed.model.training_data?.synthetic).toBe(true);
    expect(parsed.inputs.ignored).toEqual(["property_type"]);
    expect(parsed.explanation?.factors[0]).toEqual({ feature: "location", effect_pct: 11.1 });
  });

  it("rejects the malformed fixture", () => {
    expect(rentPredictionResponseV1.safeParse(fixture("rent.v1.malformed.json")).success).toBe(false);
  });
});

describe("interpretPredictionResponse", () => {
  const interpret = (status: number, name: string, headers?: Record<string, string>) =>
    interpretPredictionResponse(status, fixtureText(name), RID, {
      get: (h) => headers?.[h.toLowerCase()] ?? null,
    });

  it("maps a valid 200 to ok, keeping the interval exactly as sent", () => {
    const outcome = interpret(200, "rent.v1.ok.json");
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") expect(outcome.data.estimate.interval?.level).toBe(0.8);
  });

  it("reads synthetic: true as a demo model and synthetic: false as observed (D-058)", () => {
    expect(interpret(200, "rent.v1.ok.json")).toMatchObject({ status: "ok", trainedOn: "synthetic" });
    expect(interpret(200, "rent.v1.ok-observed.json")).toMatchObject({ status: "ok", trainedOn: "observed" });
  });

  it("treats an answer that does not say what the model was trained on as not connected, never as observed", () => {
    expect(interpret(200, "rent.v1.ok-no-flag.json")).toEqual({
      status: "not_connected",
      reason: "unverified_data",
      requestId: RID,
    });
  });

  it("accepts a newer minor version and a missing interval", () => {
    const outcome = interpret(200, "rent.v1.ok-no-interval.json");
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") expect(outcome.data.estimate.interval).toBeNull();
  });

  it("refuses a different major version", () => {
    expect(interpret(200, "rent.v1.ok-major-2.json")).toMatchObject({
      status: "unavailable",
      code: "UNSUPPORTED_API_VERSION",
      retryable: false,
    });
  });

  it("never shows a number from a malformed 200", () => {
    expect(interpret(200, "rent.v1.malformed.json")).toMatchObject({ status: "unavailable", code: "INVALID_RESPONSE" });
    expect(interpretPredictionResponse(200, "<html>", RID)).toMatchObject({ code: "INVALID_RESPONSE" });
    expect(interpretPredictionResponse(200, "", RID)).toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("maps the envelope codes", () => {
    expect(interpret(503, "rent.v1.error-not-configured.json")).toEqual({
      status: "not_connected",
      reason: "not_configured",
      requestId: RID,
    });
    expect(interpret(422, "rent.v1.error-validation.json")).toEqual({
      status: "invalid_input",
      issues: [{ field: "area_m2", issue: "must be >= 10" }],
      requestId: RID,
    });
    expect(interpret(422, "rent.v1.error-out-of-support.json")).toMatchObject({
      status: "rejected",
      code: "OUT_OF_SUPPORT",
    });
    expect(interpret(503, "rent.v1.error-unavailable.json")).toMatchObject({
      status: "unavailable",
      code: "MODEL_UNAVAILABLE",
      retryable: true,
    });
  });

  it("reads Retry-After in seconds", () => {
    expect(interpret(503, "rent.v1.error-unavailable.json", { "retry-after": "30" })).toMatchObject({
      retryAfterMs: 30_000,
    });
  });

  it("accepts FastAPI's default 422 body and maps loc[-1] to the field", () => {
    expect(interpret(422, "rent.v1.fastapi-default-422.json")).toEqual({
      status: "invalid_input",
      issues: [
        { field: "area_m2", issue: "Input should be greater than or equal to 10" },
        { field: "rooms", issue: "Input should be a multiple of 0.5" },
      ],
      requestId: RID,
    });
  });

  it("falls back on the HTTP status for bodies that aren't the envelope", () => {
    expect(interpretPredictionResponse(429, "", RID)).toMatchObject({ code: "RATE_LIMITED", retryable: true });
    expect(interpretPredictionResponse(502, "<html>Bad gateway</html>", RID)).toMatchObject({
      code: "INTERNAL_ERROR",
      retryable: true,
    });
    expect(interpretPredictionResponse(504, "", RID)).toMatchObject({ code: "UPSTREAM_TIMEOUT", retryable: true });
    expect(interpretPredictionResponse(400, "{}", RID)).toMatchObject({ code: "INTERNAL_ERROR", retryable: false });
  });
});

describe("transports", () => {
  const request = rentPredictionRequestV1.parse(fixture("rent.v1.request.json"));

  it("the disabled transport sends nothing and reports not_connected", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const outcome = await createDisabledTransport().send(request, { requestId: RID });
    expect(outcome).toEqual({ status: "not_connected", reason: "disabled", requestId: RID });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("the HTTP transport posts JSON with the request ID header", async () => {
    const fetchImpl = vi.fn(async () => new Response(fixtureText("rent.v1.ok.json"), { status: 200 }));
    const transport = createHttpTransport({ endpoint: "/api/predictions/rent", mode: "proxy", timeoutMs: 1000, fetchImpl });
    const outcome = await transport.send(request, { requestId: RID });

    expect(outcome.status).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/predictions/rent");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("X-Request-ID")).toBe(RID);
    expect(JSON.parse(String(init.body))).toEqual(request);
  });

  it("distinguishes network errors, cancellation and timeouts", async () => {
    const failing = createHttpTransport({
      endpoint: "/x",
      mode: "proxy",
      timeoutMs: 1000,
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(await failing.send(request, { requestId: RID })).toMatchObject({ code: "NETWORK_ERROR", retryable: true });

    const hanging = (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });

    const controller = new AbortController();
    const cancelled = createHttpTransport({ endpoint: "/x", mode: "proxy", timeoutMs: 1000, fetchImpl: hanging });
    const pending = cancelled.send(request, { requestId: RID, signal: controller.signal });
    controller.abort();
    expect(await pending).toMatchObject({ code: "ABORTED", retryable: false });

    const slow = createHttpTransport({ endpoint: "/x", mode: "proxy", timeoutMs: 20, fetchImpl: hanging });
    expect(await slow.send(request, { requestId: RID })).toMatchObject({ code: "CLIENT_TIMEOUT", retryable: true });
  });
});

describe("configuration", () => {
  it("defaults to disabled when nothing is set", () => {
    expect(readPredictionConfig({})).toMatchObject({ mode: "disabled", endpoint: null });
    expect(createTransport(readPredictionConfig({})).mode).toBe("disabled");
  });

  it("builds the direct endpoint from the base URL", () => {
    expect(readPredictionConfig({ mode: "direct", baseUrl: "https://ml.example.org/" }).endpoint).toBe(
      "https://ml.example.org/api/v1/predictions/rent",
    );
  });

  it("fails loudly on direct mode without a URL or on an unknown mode", () => {
    expect(() => readPredictionConfig({ mode: "direct" })).toThrow(/API_BASE_URL/);
    expect(() => readPredictionConfig({ mode: "magic" })).toThrow(/Invalid prediction configuration/);
  });

  it("uses the same-origin proxy path in proxy mode", () => {
    expect(readPredictionConfig({ mode: "proxy" }).endpoint).toBe("/api/predictions/rent");
  });
});

describe("PropertyAnalysisService", () => {
  it("prepares a validated payload and returns not_connected by default", async () => {
    const service = new PropertyAnalysisService(createDisabledTransport(), names, () => RID);
    const prepared = service.prepare(input);
    expect(prepared).toEqual({ requestId: RID, payload: fixture("rent.v1.request.json") });
    expect(await service.estimateRent(prepared)).toEqual({
      status: "not_connected",
      reason: "disabled",
      requestId: RID,
    });
  });

  it("does not send a tampered payload", async () => {
    const send = vi.fn();
    const service = new PropertyAnalysisService({ mode: "proxy", send }, names, () => RID);
    const prepared = service.prepare(input);
    const outcome = await service.estimateRent({ ...prepared, payload: { ...prepared.payload, area_m2: 5 } });
    expect(outcome.status).toBe("invalid_input");
    expect(send).not.toHaveBeenCalled();
  });
});
