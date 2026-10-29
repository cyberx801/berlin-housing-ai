"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import type { SeriesSlot } from "@/components/charts/chart-parts";
import { Button } from "@/components/ui/Button";
import {
  createBezirkSlugs,
  defaultFilter,
  marketQuery,
  MAX_BEZIRKE,
  readMarketParams,
  sameFilter,
  years as coverageYears,
  type MarketFilter,
  type MarketUrlIssue,
} from "@/lib/market/query";
import { SearchParamsReader } from "@/lib/url-state/SearchParamsReader";
import type { BezirkOption } from "@/types/geo";
import type { MarketCoverage, MarketTypeFilter } from "@/types/market";
import { MODULES, moduleSearch, type InitialMarketData } from "./api";
import { MarketFilters } from "./MarketFilters";
import { DistributionModule, DistrictModule, TrendModule, TypesModule, type ModuleContext } from "./modules";
import { namesText, summaryText } from "./scope";
import { useMarketData } from "./use-market-data";

/** Chosen Bezirke by color slot: index 0 is slot 1, null a free slot (DESIGN_SYSTEM §8, color follows the entity). */
type Slots = (string | null)[];

interface ViewState {
  slots: Slots;
  from: number;
  to: number;
  type: MarketTypeFilter;
}

const EMPTY_SLOTS: Slots = Array.from({ length: MAX_BEZIRKE }, () => null);

function toFilter(state: ViewState): MarketFilter {
  return {
    bezirke: state.slots.filter((code): code is string => code !== null),
    from: state.from,
    to: state.to,
    type: state.type,
  };
}

function fromFilter(filter: MarketFilter): ViewState {
  return { slots: EMPTY_SLOTS.map((_, i) => filter.bezirke[i] ?? null), from: filter.from, to: filter.to, type: filter.type };
}

const ISSUE_TEXT: Record<MarketUrlIssue, string> = {
  bezirke: "a Bezirk in it wasn't recognised and was left out",
  "too-many": `only its first ${MAX_BEZIRKE} Bezirke were kept`,
  period: "its period wasn't valid, so every year is shown",
  type: "its property type wasn't recognised, so all types are shown",
};

interface MarketViewProps {
  /** Sorted by name. */
  bezirke: readonly BezirkOption[];
  coverage: MarketCoverage;
  /** Server-rendered answers for the default filters. */
  initial: InitialMarketData;
}

/**
 * `/market`: one filter set, four modules that each answer one question (PRD D1–D5,
 * USER_FLOWS Flow 4). Filters live in the URL (`bezirke`, `from`, `to`, `type`), read through a
 * Suspense-wrapped reader and written only from user actions (D-037 pattern). Each module
 * fetches its own endpoint, so one failure leaves the others standing (D-022).
 */
export function MarketView({ bezirke, coverage, initial }: MarketViewProps) {
  const slugs = useMemo(() => createBezirkSlugs(bezirke), [bezirke]);
  const names = useMemo(() => new Map(bezirke.map((b) => [b.code, b.name])), [bezirke]);
  const defaults = useMemo(() => defaultFilter(coverage), [coverage]);
  const years = useMemo(() => coverageYears(coverage), [coverage]);

  const [state, setState] = useState<ViewState>(() => fromFilter(defaults));
  const [linkIssues, setLinkIssues] = useState<readonly MarketUrlIssue[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);

  const filter = useMemo(() => toFilter(state), [state]);
  const slotMap = useMemo(
    () =>
      new Map(
        state.slots.flatMap((code, i) => (code === null ? [] : [[code, (i + 1) as SeriesSlot] as const])),
      ),
    [state.slots],
  );

  const trend = useMarketData(MODULES.trend, moduleSearch(MODULES.trend, filter), {
    search: moduleSearch(MODULES.trend, defaults),
    response: initial.trend,
  });
  const districts = useMarketData(MODULES.districts, moduleSearch(MODULES.districts, filter), {
    search: moduleSearch(MODULES.districts, defaults),
    response: initial.districts,
  });
  const distribution = useMarketData(MODULES.distribution, moduleSearch(MODULES.distribution, filter), {
    search: moduleSearch(MODULES.distribution, defaults),
    response: initial.distribution,
  });
  const types = useMarketData(MODULES.types, moduleSearch(MODULES.types, filter), {
    search: moduleSearch(MODULES.types, defaults),
    response: initial.types,
  });

  // The filters the URL should show, kept in step synchronously so the reader can tell our
  // own writes (and a route shown again) from a real navigation (same pattern as /explore).
  const stateRef = useRef<ViewState>(state);
  const pendingWrites = useRef<string[]>([]);

  const writeUrl = useCallback(
    (next: ViewState) => {
      stateRef.current = next;
      const path = window.location.pathname;
      const query = marketQuery(toFilter(next), slugs, coverage);
      if (query === window.location.search) return;
      pendingWrites.current.push(query.slice(1));
      window.history.replaceState(null, "", `${path}${query}`);
    },
    [slugs, coverage],
  );

  const onSearch = useCallback(
    (search: string) => {
      const echo = pendingWrites.current.indexOf(search);
      if (echo !== -1) {
        pendingWrites.current.splice(0, echo + 1);
        return;
      }
      if (search === marketQuery(toFilter(stateRef.current), slugs, coverage).slice(1)) return;
      pendingWrites.current = [];
      const { filter: read, issues } = readMarketParams(new URLSearchParams(search), slugs, coverage);
      const next = fromFilter(read);
      stateRef.current = next;
      setState(next);
      setLinkIssues(issues);
      setBlocked(null);
      // Drop the parts of the link that couldn't be used, so sharing it again is clean.
      if (issues.length > 0) writeUrl(next);
    },
    [slugs, coverage, writeUrl],
  );

  const apply = (next: ViewState) => {
    setState(next);
    setLinkIssues([]);
    setInteracted(true);
    writeUrl(next);
  };

  const toggleBezirk = (code: string) => {
    const current = stateRef.current;
    const slot = current.slots.indexOf(code);
    if (slot !== -1) {
      setBlocked(null);
      apply({ ...current, slots: current.slots.map((c) => (c === code ? null : c)) });
      return;
    }
    const free = current.slots.indexOf(null);
    if (free === -1) {
      setBlocked(names.get(code) ?? code);
      return;
    }
    setBlocked(null);
    apply({ ...current, slots: current.slots.map((c, i) => (i === free ? code : c)) });
  };

  const setPeriod = (from: number, to: number) => {
    if (from > to) return;
    apply({ ...stateRef.current, from, to });
  };
  const setType = (type: MarketTypeFilter) => apply({ ...stateRef.current, type });
  const reset = () => {
    setBlocked(null);
    apply(fromFilter(defaults));
  };

  const ctx: ModuleContext = {
    filter,
    names,
    slots: slotMap,
    onShowAllTypes: () => setType("all"),
    onReset: reset,
  };

  const statuses = [trend.status, districts.status, distribution.status, types.status];
  const settled = !statuses.includes("loading");
  const failedCount = statuses.filter((s) => s === "error").length;
  const chosenNames = filter.bezirke.map((code) => names.get(code) ?? code);
  // Spoken once every module has its answer, and only after the reader changed something.
  const announcement =
    interacted && settled
      ? `${summaryText({ ...filter, names: chosenNames })}${
          failedCount > 0 ? ` ${failedCount === 1 ? "One chart" : `${failedCount} charts`} couldn't load.` : ""
        }`
      : "";

  return (
    <>
      <div className="page-grid gap-y-10 pb-16">
        <div className="col-span-full lg:col-span-3">
          <div className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:max-h-[calc(100svh-var(--header-height)-3rem)] lg:-ml-1 lg:overflow-y-auto lg:pr-2 lg:pb-4 lg:pl-1">
            <MarketFilters
              bezirke={bezirke}
              slots={state.slots}
              years={years}
              from={state.from}
              to={state.to}
              type={state.type}
              blocked={blocked}
              isDefault={sameFilter(filter, defaults)}
              onToggleBezirk={toggleBezirk}
              onPeriod={setPeriod}
              onType={setType}
              onReset={reset}
            />
          </div>
        </div>
        <div className="col-span-full flex min-w-0 flex-col gap-10 lg:col-span-9">
          {linkIssues.length > 0 ? (
            <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 border-ink bg-sheet px-4 py-3">
              <p className="type-small text-ink">
                This link couldn&rsquo;t be used in full: {namesText(linkIssues.map((i) => ISSUE_TEXT[i]))}.
              </p>
              <Button variant="quiet" onClick={() => setLinkIssues([])}>
                Dismiss
              </Button>
            </div>
          ) : null}
          <TrendModule data={trend} ctx={ctx} />
          <DistrictModule data={districts} ctx={ctx} />
          <div className="grid min-w-0 gap-10 xl:grid-cols-2">
            <DistributionModule data={distribution} ctx={ctx} />
            <TypesModule data={types} ctx={ctx} />
          </div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Suspense fallback={null}>
        <SearchParamsReader onSearch={onSearch} />
      </Suspense>
    </>
  );
}
