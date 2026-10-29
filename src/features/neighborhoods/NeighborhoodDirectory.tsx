"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { Plate } from "@/components/provenance/Plate";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { inputClasses } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import {
  createLookups,
  foldQuery,
  isFiltered,
  NO_FILTER,
  placeCountText,
  placeFilterQuery,
  placeMatcher,
  QUERY_MAX_LENGTH,
  readPlaceFilter,
  type PlaceFilter,
} from "@/features/neighborhood-explorer/filters";
import { formatKm2 } from "@/lib/formatting/number";
import { RING_STATUS_LABELS, RING_STATUS_SHORT } from "@/lib/property/labels";
import { SearchParamsReader } from "@/lib/url-state/SearchParamsReader";
import type { BezirkOption, PlatePlace, RingStatus } from "@/types/geo";
import type { Provenance } from "@/types/provenance";

const ID = "directory";
export const DIRECTORY_IDS = {
  root: ID,
  filters: `${ID}-filters`,
  search: `${ID}-q`,
  bezirk: `${ID}-bezirk`,
  ring: `${ID}-ring`,
  count: `${ID}-count`,
  results: `${ID}-results`,
} as const;
const IDS = DIRECTORY_IDS;

const subscribeNothing = () => () => {};

const RING_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "inside", label: "Inside" },
  { value: "partly", label: "Partly inside" },
  { value: "outside", label: "Outside" },
] as const;

const ISSUE_NAMES = { bezirk: "Bezirk", ring: "ring filter" } as const;
const Q_WRITE_DELAY = 400;
const Q_ANNOUNCE_DELAY = 800;

const linkClasses = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";

interface NeighborhoodDirectoryProps {
  /** Sorted by name. */
  places: readonly PlatePlace[];
  /** Sorted by name. */
  bezirke: readonly BezirkOption[];
  provenance: Provenance;
}

/**
 * `/neighborhoods`: every Ortsteil A–Z, filtered by Bezirk and ring status and searched by name
 * (PRD E1, USER_FLOWS Flow 2). The full list is in the static HTML; filters come from the URL
 * through a Suspense-wrapped reader and are written only from user actions (D-037).
 */
export function NeighborhoodDirectory({ places, bezirke, provenance }: NeighborhoodDirectoryProps) {
  const router = useRouter();
  const lookups = useMemo(() => createLookups(places, bezirke), [places, bezirke]);
  const bezirkNames = useMemo(() => new Map(bezirke.map((b) => [b.code, b.name])), [bezirke]);

  const [filter, setFilter] = useState<PlaceFilter>(NO_FILTER);
  const [linkIssues, setLinkIssues] = useState<readonly ("bezirk" | "ring")[]>([]);
  const [announcement, setAnnouncement] = useState("");

  // The filter the URL should show, kept in step synchronously so the reader can tell our own
  // writes (and the route shown again) from a real navigation.
  const stateRef = useRef<PlaceFilter>(NO_FILTER);
  const pendingWrites = useRef<string[]>([]);
  const writeTimer = useRef<number | undefined>(undefined);
  const pendingCommit = useRef<(() => void) | null>(null);
  const announceTimer = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const bezirkRef = useRef<HTMLSelectElement>(null);

  const matches = useMemo(() => places.filter(placeMatcher(filter)), [places, filter]);
  const filtered = isFiltered(filter);
  const count = placeCountText(matches.length, places.length, filtered);

  // Timers must not fire once the route is hidden or left: they would write this page's
  // query onto another route's URL.
  useEffect(
    () => () => {
      window.clearTimeout(writeTimer.current);
      window.clearTimeout(announceTimer.current);
    },
    [],
  );

  const writeUrl = useCallback(
    (next: PlaceFilter, delay = 0) => {
      stateRef.current = next;
      window.clearTimeout(writeTimer.current);
      const path = window.location.pathname;
      const commit = () => {
        pendingCommit.current = null;
        if (window.location.pathname !== path) return;
        const query = placeFilterQuery(stateRef.current, lookups);
        if (query === window.location.search) return;
        pendingWrites.current.push(query.slice(1));
        window.history.replaceState(null, "", `${path}${query}`);
      };
      if (delay > 0) {
        pendingCommit.current = commit;
        writeTimer.current = window.setTimeout(commit, delay);
      } else commit();
    },
    [lookups],
  );

  /**
   * Writes a search still waiting on its delay, before a link or Enter leaves the page. The timer
   * is cleared when the route hides, so without this, Back would return to a URL without the search.
   */
  const flushUrl = () => {
    window.clearTimeout(writeTimer.current);
    pendingCommit.current?.();
  };

  const onSearch = useCallback(
    (search: string) => {
      const echo = pendingWrites.current.indexOf(search);
      if (echo !== -1) {
        pendingWrites.current.splice(0, echo + 1);
        return;
      }
      if (search === placeFilterQuery(stateRef.current, lookups).slice(1)) return;
      pendingWrites.current = [];
      const { filter: next, invalid } = readPlaceFilter(new URLSearchParams(search), lookups);
      stateRef.current = next;
      setFilter(next);
      setLinkIssues(invalid);
      // Drop the parts of the link that couldn't be used, so sharing it again is clean.
      if (invalid.length > 0) writeUrl(next);
    },
    [lookups, writeUrl],
  );

  const announce = (text: string, delay = 0) => {
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(text), delay);
  };

  /** `typing`: from the search field, so the URL write and the count announcement wait a moment. */
  const updateFilter = (patch: Partial<PlaceFilter>, typing = false) => {
    const next = { ...stateRef.current, ...patch };
    setFilter(next);
    setLinkIssues([]);
    writeUrl(next, typing ? Q_WRITE_DELAY : 0);
    const shown = places.filter(placeMatcher(next)).length;
    announce(`${placeCountText(shown, places.length, isFiltered(next))} shown.`, typing ? Q_ANNOUNCE_DELAY : 0);
  };

  // Buttons in the empty state vanish once results return, so focus moves to the control that changed.
  const removeFilter = (key: keyof PlaceFilter) => {
    if (key === "bezirk") {
      updateFilter({ bezirk: null });
      bezirkRef.current?.focus();
    } else if (key === "ring") {
      updateFilter({ ring: null });
      document.getElementById(`${IDS.ring}-any`)?.focus();
    } else {
      updateFilter({ q: "" });
      searchRef.current?.focus();
    }
  };
  const clearFilters = () => {
    updateFilter({ bezirk: null, ring: null, q: "" });
    searchRef.current?.focus();
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && matches.length === 1 && matches[0]) {
      event.preventDefault();
      flushUrl();
      router.push(`/neighborhoods/${matches[0].slug}`);
    }
  };

  const query = foldQuery(filter.q) === "" ? "" : filter.q.trim();
  const active: { key: keyof PlaceFilter; label: string; name: string; value: string }[] = [
    filter.bezirk !== null && {
      key: "bezirk" as const,
      label: "Bezirk",
      name: "Bezirk filter",
      value: bezirkNames.get(filter.bezirk) ?? filter.bezirk,
    },
    filter.ring !== null && {
      key: "ring" as const,
      label: "Ring status",
      name: "ring status filter",
      value: RING_STATUS_LABELS[filter.ring],
    },
    query !== "" && { key: "q" as const, label: "Name contains", name: "name search", value: `“${query}”` },
  ].filter((item) => item !== false);

  // Typing before hydration is lost (the slice 9 pre-hydration item); tests wait for this.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);

  return (
    <>
      <div id={IDS.root} data-hydrated={hydrated ? "" : undefined} className="page-grid gap-y-8 pb-16" onClickCapture={flushUrl}>
        <div className="col-span-4 md:col-span-8 lg:col-span-3">
          <div
            id={IDS.filters}
            role="search"
            aria-label="Filter the Ortsteile"
            className="grid gap-5 md:grid-cols-2 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:-ml-1 lg:grid-cols-1 lg:pl-1"
          >
            <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-1">
              <label htmlFor={IDS.search} className="type-body font-[600]">
                Search by name
              </label>
              <input
                ref={searchRef}
                id={IDS.search}
                type="search"
                value={filter.q}
                maxLength={QUERY_MAX_LENGTH}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                aria-describedby={IDS.count}
                onChange={(event) => updateFilter({ q: event.target.value }, true)}
                onKeyDown={onSearchKeyDown}
                className={inputClasses}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={IDS.bezirk} className="type-body font-[600]">
                Bezirk (borough)
              </label>
              <Select
                ref={bezirkRef}
                id={IDS.bezirk}
                value={filter.bezirk ?? ""}
                onChange={(event) => updateFilter({ bezirk: event.target.value || null })}
              >
                <option value="">All {bezirke.length} Bezirke</option>
                {bezirke.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <ChoiceGroup<"any" | RingStatus>
              id={IDS.ring}
              name={IDS.ring}
              legend="Ring status"
              hint={
                <>
                  The ring is the Umweltzone: the area inside the <span className="whitespace-nowrap">S-Bahn</span> ring.
                </>
              }
              options={RING_OPTIONS}
              size="sm"
              showRequirement={false}
              value={filter.ring ?? "any"}
              onValueChange={(value) => updateFilter({ ring: value === "any" ? null : value })}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-rule pt-3 md:col-span-2 lg:col-span-1">
              <p id={IDS.count} className="type-small font-[600]">
                {count}
              </p>
              {filtered ? (
                <Button variant="quiet" onClick={clearFilters} className="type-small">
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-span-4 flex min-w-0 flex-col gap-6 md:col-span-8 lg:col-span-9">
          {linkIssues.length > 0 ? (
            <p role="status" className="border-l-4 border-line-strong bg-sheet px-3 py-2 type-small">
              This link&rsquo;s {linkIssues.map((issue) => ISSUE_NAMES[issue]).join(" and ")} couldn&rsquo;t be
              matched, so {linkIssues.length === 1 ? "it was" : "they were"} left out.
            </p>
          ) : null}
          <Plate
            id={IDS.results}
            title="Ortsteile from A to Z"
            provenance={provenance}
            bodyClassName="px-0 py-0 md:px-0"
            caption="Area is computed from the official boundary geometry; ring status from the share of that area inside the Umweltzone."
          >
            {matches.length > 0 ? (
              <table className="w-full border-collapse text-left type-small md:type-body">
                <caption className="sr-only">
                  {count}, by name: Bezirk, area and ring status
                </caption>
                <thead>
                  <tr className="border-b border-ink">
                    <th scope="col" className="stretch-condensed py-2 pr-3 pl-4 font-[620] md:w-[32%] md:pl-5">
                      Ortsteil
                    </th>
                    <th scope="col" className="stretch-condensed hidden py-2 pr-3 font-[620] md:table-cell md:w-[32%]">
                      Bezirk
                    </th>
                    <th scope="col" className="stretch-condensed py-2 pr-6 text-right font-[620] md:w-[14%]">
                      Area
                    </th>
                    <th scope="col" className="stretch-condensed py-2 pr-4 font-[620] md:pr-5">
                      Ring status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((place) => (
                    <tr key={place.code} className="border-b border-rule transition-state last:border-b-0 hover:bg-paper">
                      <th scope="row" className="py-2.5 pr-3 pl-4 align-top font-[450] md:pl-5">
                        <Link href={`/neighborhoods/${place.slug}`} className={`font-[600] ${linkClasses}`}>
                          {place.name}
                        </Link>
                        <span className="block text-ink-2 md:hidden">{place.bezirkName}</span>
                      </th>
                      <td className="hidden py-2.5 pr-3 align-top md:table-cell">{place.bezirkName}</td>
                      <td className="tabular py-2.5 pr-6 text-right align-top whitespace-nowrap">
                        {formatKm2(place.areaKm2, true)}
                      </td>
                      <td className="py-2.5 pr-4 align-top md:pr-5">{RING_STATUS_SHORT[place.ringStatus]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-start gap-4 px-4 py-6 md:px-5">
                <div className="flex flex-col gap-1">
                  <p className="type-title-3">No Ortsteil matches these filters</p>
                  <p className="type-small text-ink-2">
                    Remove a filter, or check the spelling. Umlauts can be typed as ae, oe and ue.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="type-small font-[650]">Active filters</h3>
                  <ul className="flex flex-col gap-2">
                    {active.map((item) => (
                      <li key={item.key} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span>
                          <span className="text-ink-2">{item.label}:</span> {item.value}
                        </span>
                        <Button
                          variant="quiet"
                          onClick={() => removeFilter(item.key)}
                          aria-label={`Remove the ${item.name}`}
                          className="type-small"
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </div>
            )}
          </Plate>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <Suspense fallback={null}>
        <SearchParamsReader onSearch={onSearch} />
      </Suspense>
    </>
  );
}
