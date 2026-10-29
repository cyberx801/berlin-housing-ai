"use client";

import { LineKey, type SeriesSlot } from "@/components/charts/chart-parts";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { cx } from "@/lib/cx";
import { MAX_BEZIRKE, TYPE_FILTERS } from "@/lib/market/query";
import { PROPERTY_TYPE_LABELS } from "@/lib/property/labels";
import type { BezirkOption } from "@/types/geo";
import type { MarketTypeFilter } from "@/types/market";

export const FILTER_IDS = {
  title: "market-filters-title",
  bezirkeHint: "market-bezirke-hint",
  bezirkeLimit: "market-bezirke-limit",
  bezirkeStatus: "market-bezirke-status",
  from: "market-from",
  to: "market-to",
  type: "market-type",
} as const;

interface MarketFiltersProps {
  /** Sorted by name. */
  bezirke: readonly BezirkOption[];
  /** Chosen Bezirk codes by color slot (index 0 is slot 1); null is a free slot. */
  slots: readonly (string | null)[];
  years: readonly number[];
  from: number;
  to: number;
  type: MarketTypeFilter;
  /** Name of the Bezirk the reader just tried to add past the limit. */
  blocked: string | null;
  isDefault: boolean;
  onToggleBezirk: (code: string) => void;
  onPeriod: (from: number, to: number) => void;
  onType: (type: MarketTypeFilter) => void;
  onReset: () => void;
}

/**
 * The one filter set that scopes every module (PRD D2). Native controls throughout. The
 * fifth Bezirk is refused with a reason instead of a disabled box, which would drop out of
 * the tab order and hide why (USER_FLOWS Flow 4).
 */
export function MarketFilters({
  bezirke,
  slots,
  years,
  from,
  to,
  type,
  blocked,
  isDefault,
  onToggleBezirk,
  onPeriod,
  onType,
  onReset,
}: MarketFiltersProps) {
  const chosen = slots.filter((code): code is string => code !== null);
  const full = chosen.length >= MAX_BEZIRKE;

  return (
    <section aria-labelledby={FILTER_IDS.title} className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-3 border-t border-ink pt-3">
        <h2 id={FILTER_IDS.title} className="type-title-3">
          Filter the charts
        </h2>
        {!isDefault ? (
          <Button variant="quiet" onClick={onReset}>
            Reset filters
          </Button>
        ) : null}
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={FILTER_IDS.bezirkeHint}>
        <legend className="mb-1 type-body font-[600]">Bezirke (boroughs)</legend>
        <p id={FILTER_IDS.bezirkeHint} className="-mt-1 type-small text-ink-2">
          Choose up to {MAX_BEZIRKE} to compare. With none chosen, the charts show all of Berlin.
        </p>
        <p id={FILTER_IDS.bezirkeLimit} className={cx("type-small font-[560] text-ink", !full && "sr-only")}>
          {chosen.length} of {MAX_BEZIRKE} chosen{full ? ". Clear one to add another." : "."}
        </p>
        <p id={FILTER_IDS.bezirkeStatus} role="status" className="type-small font-[560] text-ink">
          {blocked
            ? `Up to ${MAX_BEZIRKE} Bezirke can be compared at once. Clear one to add ${blocked}.`
            : ""}
        </p>
        <ul className="grid grid-cols-2 gap-x-4 md:grid-cols-3 lg:grid-cols-1">
          {bezirke.map((b) => {
            const slot = slots.indexOf(b.code);
            const checked = slot !== -1;
            const refused = full && !checked;
            return (
              <li key={b.code}>
                <label
                  className={cx(
                    "flex min-h-9 cursor-pointer items-center gap-2.5 type-small",
                    refused ? "text-ink-3" : "text-ink",
                    checked && "font-[620]",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleBezirk(b.code)}
                    {...(refused ? { "aria-disabled": true, "aria-describedby": FILTER_IDS.bezirkeLimit } : {})}
                    className="size-[1.125rem] shrink-0 cursor-pointer accent-ink"
                  />
                  <span className="min-w-0">{b.name}</span>
                  {checked ? <LineKey slot={(slot + 1) as SeriesSlot} /> : null}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 type-body font-[600]">Period</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={FILTER_IDS.from} className="type-small text-ink-2">
              From
            </label>
            <Select id={FILTER_IDS.from} value={from} onChange={(e) => onPeriod(Number(e.target.value), to)}>
              {years.map((y) => (
                <option key={y} value={y} disabled={y > to}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={FILTER_IDS.to} className="type-small text-ink-2">
              To
            </label>
            <Select id={FILTER_IDS.to} value={to} onChange={(e) => onPeriod(from, Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y} disabled={y < from}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={FILTER_IDS.type} className="type-body font-[600]">
          Property type
        </label>
        <Select id={FILTER_IDS.type} value={type} onChange={(e) => onType(e.target.value as MarketTypeFilter)}>
          {TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All property types" : PROPERTY_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
    </section>
  );
}
