import { z } from "zod";
import { getStorage, readVersioned, removeKey, writeVersioned, type ReadResult } from "@/lib/storage/versioned";
import { formValuesSchema, type PropertyFormValues } from "@/lib/validation/property";

// The analysis form survives a reload within this tab (PRD B6). Shape-checked on read;
// anything that doesn't parse is removed and the user is told.
export const DRAFT_KEY = "bhai.analyze.draft.v1";

const draftSchema = z.object({ version: z.literal(1), values: formValuesSchema });

export function readDraft(): ReadResult<PropertyFormValues> {
  const read = readVersioned(getStorage("session"), DRAFT_KEY, draftSchema);
  return read.status === "ok" ? { status: "ok", value: read.value.values } : read;
}

export function writeDraft(values: PropertyFormValues): void {
  writeVersioned(getStorage("session"), DRAFT_KEY, { version: 1, values });
}

export function clearDraft(): void {
  removeKey(getStorage("session"), DRAFT_KEY);
}
