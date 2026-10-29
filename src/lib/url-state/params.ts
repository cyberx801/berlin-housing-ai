// Typed, forgiving URL search-param helpers. Invalid values fall back to defaults and are
// reported, so a hand-edited or stale link never crashes a page.

export interface ParamReader {
  get(name: string): string | null;
}

export function readEnum<T extends string>(
  params: ParamReader,
  name: string,
  allowed: readonly T[],
  fallback: T,
): { value: T; invalid: boolean } {
  const raw = params.get(name);
  if (raw === null || raw === "") return { value: fallback, invalid: false };
  return (allowed as readonly string[]).includes(raw)
    ? { value: raw as T, invalid: false }
    : { value: fallback, invalid: true };
}

export function readList<T extends string>(
  params: ParamReader,
  name: string,
  allowed: readonly T[],
  max: number,
): { value: T[]; invalid: boolean } {
  const raw = params.get(name);
  if (!raw) return { value: [], invalid: false };
  const parts = raw.split(",").filter(Boolean);
  const valid = parts.filter((p): p is T => (allowed as readonly string[]).includes(p));
  const unique = [...new Set(valid)].slice(0, max);
  return { value: unique, invalid: unique.length !== parts.length };
}

export function readString(params: ParamReader, name: string, maxLength = 80): string {
  return (params.get(name) ?? "").slice(0, maxLength);
}

/** Returns "?a=1&b=2" (or "") with empty/default values removed. */
export function buildQuery(values: Record<string, string | readonly string[] | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    const str = Array.isArray(value) ? value.join(",") : (value as string);
    if (str !== "") search.set(key, str);
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
