import { z } from "zod";

/** The listing details the compare dialog adds to a property description (PRD F1–F2). */
export interface CompareExtrasValues {
  label: string;
  askingColdRent: string;
  listingUrl: string;
  /** The id of the property a new one replaces; only asked for when the comparison is full. */
  replace: string;
}

export interface CompareExtras {
  label: string | null;
  askingColdRent: number | null;
  listingUrl: string | null;
  replace: string | null;
}

export const EMPTY_COMPARE_EXTRAS: CompareExtrasValues = { label: "", askingColdRent: "", listingUrl: "", replace: "" };

export const COMPARE_LIMITS = {
  label: { max: 60 },
  askingColdRent: { min: 1, max: 100_000 },
  listingUrl: { max: 500 },
} as const;

/** The one rule for listing links, shared with the stored comparison so a saved link always reads back. */
export const listingUrlSchema = z.url({ protocol: /^https?$/ }).max(COMPARE_LIMITS.listingUrl.max);

/**
 * Parses a rent as people type it from German and English listings: "1150", "1.150",
 * "1,150", "950,50", "1.150,50", "1,150.50", with or without "€". One separator followed by
 * exactly three digits groups thousands; followed by one or two digits it is the decimal mark.
 * Returns NaN for anything else.
 */
export function parseEuroAmount(raw: string): number {
  const s = raw.replace(/[\s  ]/g, "").replace(/^(€|eur)|(€|eur)$/gi, "");
  const plain = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(s);
  if (plain) return Number(`${plain[1]}.${plain[2] ?? "0"}`);
  const grouped = /^(\d{1,3}([.,])\d{3}(?:\2\d{3})*)(?:([.,])(\d{1,2}))?$/.exec(s);
  if (!grouped) return Number.NaN;
  const [, whole, group, decimal, cents] = grouped;
  if (decimal === group) return Number.NaN;
  return Number(`${whole!.replaceAll(group!, "")}.${cents ?? "0"}`);
}

const RENT_FORMAT = "Enter the asking cold rent in euros, for example 1150 or 1.150,50.";
const RENT_RANGE = `The asking cold rent must be between €${COMPARE_LIMITS.askingColdRent.min} and €100,000 a month.`;
const URL_FORMAT = "Paste the listing's full web address, starting with https://.";
const URL_LENGTH = `This link is longer than ${COMPARE_LIMITS.listingUrl.max} characters. Copy a shorter link to the listing.`;

/**
 * The dialog's listing fields. `replaceIds` lists the properties a new one may replace: empty while
 * the comparison has room, so the choice is only required when it is full.
 */
export function createCompareExtrasSchema(replaceIds: readonly string[]) {
  return z.object({
    label: z
      .string()
      .trim()
      .max(COMPARE_LIMITS.label.max, `Keep the name under ${COMPARE_LIMITS.label.max} characters.`)
      .transform((v) => (v === "" ? null : v)),
    askingColdRent: z.string().transform((raw, ctx): number | null => {
      if (raw.trim() === "") return null;
      const n = parseEuroAmount(raw);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: RENT_FORMAT });
        return z.NEVER;
      }
      if (n < COMPARE_LIMITS.askingColdRent.min || n > COMPARE_LIMITS.askingColdRent.max) {
        ctx.addIssue({ code: "custom", message: RENT_RANGE });
        return z.NEVER;
      }
      return n;
    }),
    listingUrl: z
      .string()
      .trim()
      .transform((v, ctx): string | null => {
        if (v === "") return null;
        if (v.length > COMPARE_LIMITS.listingUrl.max) {
          ctx.addIssue({ code: "custom", message: URL_LENGTH });
          return z.NEVER;
        }
        if (!listingUrlSchema.safeParse(v).success) {
          ctx.addIssue({ code: "custom", message: URL_FORMAT });
          return z.NEVER;
        }
        return v;
      }),
    replace: z.string().transform((v, ctx): string | null => {
      if (replaceIds.length === 0) return null;
      if (!replaceIds.includes(v)) {
        ctx.addIssue({ code: "custom", message: "Choose the property this one replaces." });
        return z.NEVER;
      }
      return v;
    }),
  });
}

/** A stored rent back as form text ("1150.5" reads back through `parseEuroAmount`). */
export const rentToField = (rent: number | null) => (rent === null ? "" : String(rent));
