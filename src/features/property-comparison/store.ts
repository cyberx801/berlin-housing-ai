import { useSyncExternalStore } from "react";
import { z } from "zod";
import { randomId } from "@/lib/id";
import { getStorage, readVersioned, writeVersioned } from "@/lib/storage/versioned";
import { COMPARE_LIMITS, listingUrlSchema } from "@/lib/validation/compare";
import { storedPropertySchema } from "@/lib/validation/property";

// The comparison lives only in this browser (PRD F4, DATA_BOUNDARIES: user data).
export const COMPARE_KEY = "bhai.compare.v1";
export const MAX_COMPARE_ITEMS = 3;

export const compareItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(COMPARE_LIMITS.label.max),
  property: storedPropertySchema,
  /** Entered by the user from a listing. Never estimated. */
  askingColdRent: z.number().min(COMPARE_LIMITS.askingColdRent.min).max(COMPARE_LIMITS.askingColdRent.max).nullable(),
  listingUrl: listingUrlSchema.nullable(),
  source: z.enum(["manual", "analysis"]),
  addedAt: z.string(),
});
export type CompareItem = z.infer<typeof compareItemSchema>;
export type NewCompareItem = Omit<CompareItem, "id" | "addedAt">;

const stateSchema = z.object({
  version: z.literal(1),
  items: z.array(compareItemSchema).max(MAX_COMPARE_ITEMS),
});

export interface CompareSnapshot {
  items: readonly CompareItem[];
  /** Stored data failed validation and was dropped; the UI tells the user once. */
  discarded: boolean;
  /** False when storage is blocked: changes last only for this page view. */
  persisted: boolean;
}

const SERVER_SNAPSHOT: CompareSnapshot = { items: [], discarded: false, persisted: true };
let snapshot: CompareSnapshot | null = null;
const listeners = new Set<() => void>();

function load(): CompareSnapshot {
  const storage = getStorage("local");
  const read = readVersioned(storage, COMPARE_KEY, stateSchema);
  return {
    items: read.status === "ok" ? read.value.items : [],
    discarded: read.status === "discarded",
    persisted: storage !== null,
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  // Another tab changed the comparison (or cleared all storage).
  if (event.key === COMPARE_KEY || event.key === null) {
    snapshot = null;
    emit();
  }
}

export function subscribeCompare(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function getCompareSnapshot(): CompareSnapshot {
  snapshot ??= load();
  return snapshot;
}

function commit(items: readonly CompareItem[]) {
  const persisted = writeVersioned(getStorage("local"), COMPARE_KEY, { version: 1, items });
  snapshot = { items, discarded: false, persisted };
  emit();
}

export type AddResult = { ok: true; id: string } | { ok: false; reason: "full" };

export function addCompareItem(item: NewCompareItem, now = new Date()): AddResult {
  const { items } = getCompareSnapshot();
  if (items.length >= MAX_COMPARE_ITEMS) return { ok: false, reason: "full" };
  const id = randomId();
  commit([...items, compareItemSchema.parse({ ...item, id, addedAt: now.toISOString() })]);
  return { ok: true, id };
}

/** Returns false when the item is gone (e.g. removed in another tab); nothing is written then. */
export function replaceCompareItem(id: string, item: NewCompareItem): boolean {
  const { items } = getCompareSnapshot();
  if (!items.some((existing) => existing.id === id)) return false;
  commit(
    items.map((existing) =>
      existing.id === id ? compareItemSchema.parse({ ...item, id, addedAt: existing.addedAt }) : existing,
    ),
  );
  return true;
}

export function removeCompareItem(id: string) {
  commit(getCompareSnapshot().items.filter((item) => item.id !== id));
}

export function clearCompareItems() {
  commit([]);
}

/** Clears the "dropped corrupt data" notice after it has been shown. */
export function acknowledgeCompareDiscard() {
  const current = getCompareSnapshot();
  if (!current.discarded) return;
  snapshot = { ...current, discarded: false };
  emit();
}

/** For tests: forget the cached snapshot so the next read goes to storage. */
export function resetCompareCacheForTests() {
  snapshot = null;
}

export function useCompareSnapshot(): CompareSnapshot {
  return useSyncExternalStore(subscribeCompare, getCompareSnapshot, () => SERVER_SNAPSHOT);
}
