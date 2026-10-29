import type { z } from "zod";

export type ReadResult<T> =
  | { status: "empty" }
  | { status: "ok"; value: T }
  /** Stored data failed validation (corrupt or an incompatible shape) and was removed. */
  | { status: "discarded" };

/** Browser storage, or null where it is unavailable (SSR, privacy modes, blocked storage). */
export function getStorage(kind: "local" | "session"): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "__bhai_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function readVersioned<T>(storage: Storage | null, key: string, schema: z.ZodType<T>): ReadResult<T> {
  if (!storage) return { status: "empty" };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { status: "empty" };
  }
  if (raw === null) return { status: "empty" };
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return { status: "ok", value: parsed.data };
  } catch {
    // fall through: unreadable JSON
  }
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
  return { status: "discarded" };
}

export function writeVersioned(storage: Storage | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(storage: Storage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // ignore
  }
}
