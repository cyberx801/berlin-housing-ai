"use client";

import dynamic from "next/dynamic";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { inputClasses } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { cx } from "@/lib/cx";
import { RING_STATUS_LABELS } from "@/lib/property/labels";
import { SearchParamsReader } from "@/lib/url-state/SearchParamsReader";
import { NARROW_QUERY, useMediaQuery } from "@/lib/use-media-query";
import type { ExploreBezirk, ExplorePlace, RingStatus } from "@/types/geo";
import type { Provenance } from "@/types/provenance";
import {
  createLookups,
  EMPTY_EXPLORE_STATE,
  exploreQuery,
  isFiltered,
  NO_FILTER,
  placeMatcher,
  QUERY_MAX_LENGTH,
  readExploreParams,
  type ExploreUrlIssue,
  type ExploreUrlState,
  type PlaceFilter,
} from "./filters";
import type { Bbox, MapStatus, MapTarget, MapView } from "./map-types";
import { PlaceDetails } from "./PlaceDetails";
import { PlaceList, type PlaceGroup } from "./PlaceList";
import { PlateLayer } from "./PlateLayer";
import { supportsWebGL2 } from "./webgl";

// MapLibre (~300 kB gzip) loads only after hydration, and only where WebGL2 exists (D-038).
const ExploreMap = dynamic(() => import("./ExploreMap"), { ssr: false });

const ID = "explore";
const IDS = {
  listPanel: `${ID}-list-panel`,
  listTitle: `${ID}-list-title`,
  list: `${ID}-list`,
  count: `${ID}-count`,
  search: `${ID}-q`,
  bezirk: `${ID}-bezirk`,
  ring: `${ID}-ring`,
  details: `${ID}-details`,
  detailsTitle: `${ID}-details-title`,
  tabList: `${ID}-tab-list`,
  tabDetails: `${ID}-tab-details`,
} as const;

const RING_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "inside", label: "Inside" },
  { value: "partly", label: "Partly inside" },
  { value: "outside", label: "Outside" },
] as const;

const ISSUE_NAMES: Record<ExploreUrlIssue, string> = {
  o: "Ortsteil",
  bezirk: "Bezirk",
  ring: "ring filter",
};

const ATTRIBUTION = "Geometry: ALKIS Berlin, Umweltzone (Geoportal Berlin), dl-de/zero-2.0";
const Q_WRITE_DELAY = 400;
const Q_ANNOUNCE_DELAY = 800;

type Tab = "list" | "details";
type Source = "list" | "map" | "details";
type Support = "unknown" | "webgl2" | "none";

let webglSupport: Support = "unknown";
const subscribeNothing = () => () => {};
function getSupport(): Support {
  if (webglSupport === "unknown") webglSupport = supportsWebGL2() ? "webgl2" : "none";
  return webglSupport;
}

function targetFor(state: { selected: string | null; bezirk: string | null }): MapTarget {
  if (state.selected) return { kind: "ortsteil", code: state.selected };
  if (state.bezirk) return { kind: "bezirk", code: state.bezirk };
  return { kind: "berlin" };
}

function countText(shown: number, total: number, filtered: boolean): string {
  if (!filtered) return `All ${total} Ortsteile`;
  return shown === 1 ? `1 of ${total} Ortsteile` : `${shown} of ${total} Ortsteile`;
}

interface ExploreViewProps {
  /** Sorted by name. */
  places: readonly ExplorePlace[];
  /** Sorted by name. */
  bezirke: readonly ExploreBezirk[];
  berlinBbox: Bbox;
  provenance: Provenance;
  /** Server-rendered `<RingPlate>`: shown while the map loads, and instead of it without WebGL2. */
  plate: ReactNode;
  plateIdPrefix: string;
  plateSize: { width: number; height: number };
}

/**
 * `/explore`: list, filters, details and map in one view (PRD C1–C5, USER_FLOWS Flow 3).
 * The list is server-rendered and works before the map loads; the map is never the only path.
 * URL state (`o`, `bezirk`, `ring`, `q`) is read through a Suspense-wrapped reader and written
 * only from user actions with `history.replaceState` (D-037).
 */
export function ExploreView({
  places,
  bezirke,
  berlinBbox,
  provenance,
  plate,
  plateIdPrefix,
  plateSize,
}: ExploreViewProps) {
  const lookups = useMemo(() => createLookups(places, bezirke), [places, bezirke]);
  const byCode = useMemo(() => new Map(places.map((p) => [p.code, p])), [places]);

  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlaceFilter>(NO_FILTER);
  const [tab, setTab] = useState<Tab>("list");
  const [view, setView] = useState<MapView>({ id: 0, target: { kind: "berlin" }, instant: true });
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [mapKey, setMapKey] = useState(0);
  const [linkIssues, setLinkIssues] = useState<readonly ExploreUrlIssue[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [focusRequest, setFocusRequest] = useState<{ target: "details" | "list"; n: number } | null>(null);

  const support = useSyncExternalStore(subscribeNothing, getSupport, () => "unknown" as const);
  const narrow = useMediaQuery(NARROW_QUERY, true);

  // The state the URL should show, kept in step synchronously so the reader can tell our own
  // writes (and a route shown again) from a real navigation.
  const stateRef = useRef<ExploreUrlState>(EMPTY_EXPLORE_STATE);
  const pendingWrites = useRef<string[]>([]);
  const writeTimer = useRef<number | undefined>(undefined);
  const announceTimer = useRef<number | undefined>(undefined);
  const handledFocus = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listPanelRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const matcher = useMemo(() => placeMatcher(filter), [filter]);
  const matches = useMemo(() => places.filter(matcher), [places, matcher]);
  const matching = useMemo(() => new Set(matches.map((p) => p.code)), [matches]);
  const filtered = isFiltered(filter);
  const groups = useMemo<PlaceGroup[]>(
    () =>
      bezirke
        .map((b) => ({ code: b.code, name: b.name, places: matches.filter((p) => p.bezirkCode === b.code) }))
        .filter((group) => group.places.length > 0),
    [bezirke, matches],
  );
  const dimmed = useMemo(
    () => (filtered ? places.filter((p) => !matching.has(p.code)).map((p) => p.code) : []),
    [filtered, places, matching],
  );
  const selectedPlace = selected ? (byCode.get(selected) ?? null) : null;
  const neighbors = useMemo(
    () =>
      (selectedPlace?.neighbors ?? [])
        .map((code) => byCode.get(code))
        .filter((p): p is ExplorePlace => p !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [selectedPlace, byCode],
  );

  // Timers must not fire once the route is hidden or left: they would write this page's
  // query onto another route's URL.
  useEffect(
    () => () => {
      window.clearTimeout(writeTimer.current);
      window.clearTimeout(announceTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!focusRequest || focusRequest.n === handledFocus.current) return;
    handledFocus.current = focusRequest.n;
    if (focusRequest.target === "details") headingRef.current?.focus();
    else (listRef.current ?? searchRef.current)?.focus();
  }, [focusRequest]);

  const writeUrl = useCallback(
    (next: ExploreUrlState, delay = 0) => {
      stateRef.current = next;
      window.clearTimeout(writeTimer.current);
      const path = window.location.pathname;
      const commit = () => {
        if (window.location.pathname !== path) return;
        const query = exploreQuery(stateRef.current, lookups);
        if (query === window.location.search) return;
        pendingWrites.current.push(query.slice(1));
        window.history.replaceState(null, "", `${path}${query}`);
      };
      if (delay > 0) writeTimer.current = window.setTimeout(commit, delay);
      else commit();
    },
    [lookups],
  );

  const announce = (text: string, delay = 0) => {
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(text), delay);
  };

  const requestFocus = (target: "details" | "list") =>
    setFocusRequest((previous) => ({ target, n: (previous?.n ?? 0) + 1 }));

  const onSearch = useCallback(
    (search: string) => {
      const echo = pendingWrites.current.indexOf(search);
      if (echo !== -1) {
        pendingWrites.current.splice(0, echo + 1);
        return;
      }
      if (search === exploreQuery(stateRef.current, lookups).slice(1)) return;
      pendingWrites.current = [];
      const { state, invalid } = readExploreParams(new URLSearchParams(search), lookups);
      stateRef.current = state;
      setSelected(state.selected);
      setFilter({ bezirk: state.bezirk, ring: state.ring, q: state.q });
      setTab(state.selected ? "details" : "list");
      setView((v) => ({ id: v.id + 1, target: targetFor(state), instant: true }));
      setLinkIssues(invalid);
      // Drop the parts of the link that couldn't be used, so sharing it again is clean.
      if (invalid.length > 0) writeUrl(state);
    },
    [lookups, writeUrl],
  );

  const select = (code: string, source: Source) => {
    const place = byCode.get(code);
    if (!place) return;
    const focusInList = listPanelRef.current?.contains(document.activeElement) ?? false;
    setSelected(code);
    setLinkIssues([]);
    writeUrl({ ...stateRef.current, selected: code });
    setView((v) => ({ id: v.id + 1, target: { kind: "ortsteil", code }, instant: false }));
    setTab("details");
    // The list hides below lg, and a bordering-Ortsteil button disappears with the old details.
    if (source === "details" || (narrow && focusInList)) requestFocus("details");
    else announce(`${place.name} selected, in ${place.bezirkName}. ${RING_STATUS_LABELS[place.ringStatus]}.`);
  };

  const close = () => {
    const focusInDetails = detailsRef.current?.contains(document.activeElement) ?? false;
    setSelected(null);
    setLinkIssues([]);
    writeUrl({ ...stateRef.current, selected: null });
    setTab("list");
    if (focusInDetails) requestFocus("list");
    announce("Selection cleared.");
  };

  /** `typing`: from the search field, so the URL write and the count announcement wait a moment. */
  const updateFilter = (patch: Partial<PlaceFilter>, typing = false) => {
    const next = { ...filter, ...patch };
    setFilter(next);
    setLinkIssues([]);
    writeUrl({ ...stateRef.current, ...patch }, typing ? Q_WRITE_DELAY : 0);
    if ("bezirk" in patch && stateRef.current.selected === null) {
      setView((v) => ({ id: v.id + 1, target: targetFor({ selected: null, bezirk: next.bezirk }), instant: false }));
    }
    const shown = places.filter(placeMatcher(next)).length;
    announce(`${countText(shown, places.length, isFiltered(next))} shown.`, typing ? Q_ANNOUNCE_DELAY : 0);
  };

  const clearFilters = () => updateFilter({ bezirk: null, ring: null, q: "" });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || selected === null || event.defaultPrevented) return;
    // Esc in a text field or select belongs to that control (clearing, closing its popup).
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    event.preventDefault();
    close();
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && matches.length > 0) {
      event.preventDefault();
      listRef.current?.focus();
    } else if (event.key === "Enter" && matches.length === 1 && matches[0]) {
      event.preventDefault();
      select(matches[0].code, "list");
    }
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next: Tab =
      event.key === "Home" ? "list" : event.key === "End" ? "details" : tab === "list" ? "details" : "list";
    setTab(next);
    document.getElementById(next === "list" ? IDS.tabList : IDS.tabDetails)?.focus();
  };

  const phase =
    support === "unknown"
      ? "placeholder"
      : support === "none" || mapStatus === "unsupported"
        ? "fallback"
        : mapStatus;
  const mountMap = support === "webgl2" && mapStatus !== "unsupported" && mapStatus !== "error";
  const hiddenByFilter = selectedPlace !== null && !matching.has(selectedPlace.code);
  const count = countText(matches.length, places.length, filtered);

  return (
    <div className="explore-layout mx-auto max-w-[90rem] lg:px-8 lg:pb-6" onKeyDown={onKeyDown}>
      <div role="tablist" aria-label="Explore views" className="flex border-b border-rule bg-paper [grid-area:tabs] lg:hidden">
        {(
          [
            { key: "list", id: IDS.tabList, panel: IDS.listPanel, label: `List (${matches.length})` },
            { key: "details", id: IDS.tabDetails, panel: IDS.details, label: "Details" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={t.id}
            aria-selected={tab === t.key}
            aria-controls={t.panel}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={onTabKeyDown}
            className={cx(
              "min-h-11 flex-1 border-b-[3px] px-4 type-body font-[600] transition-state focus-visible:-outline-offset-2",
              tab === t.key ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section
        ref={listPanelRef}
        id={IDS.listPanel}
        role={narrow ? "tabpanel" : undefined}
        aria-labelledby={narrow ? IDS.tabList : IDS.listTitle}
        className={cx(
          "min-h-0 overflow-y-auto bg-paper [grid-area:sheet] lg:flex lg:flex-col lg:overflow-hidden",
          tab !== "list" && "max-lg:hidden",
        )}
      >
        <div className="flex flex-col gap-4 px-4 pt-4 md:px-6 lg:px-0 lg:pt-0">
          <h2 id={IDS.listTitle} className="type-title-3 max-lg:sr-only">
            Find an Ortsteil
          </h2>
          {linkIssues.length > 0 ? (
            <p role="status" className="border-l-4 border-line-strong bg-sheet px-3 py-2 type-small">
              This link&rsquo;s {linkIssues.map((issue) => ISSUE_NAMES[issue]).join(" and ")} couldn&rsquo;t be
              matched, so {linkIssues.length === 1 ? "it was" : "they were"} left out.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
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
            hint="The ring is the Umweltzone: the area inside the S-Bahn ring."
            options={RING_OPTIONS}
            size="sm"
            showRequirement={false}
            value={filter.ring ?? "any"}
            onValueChange={(value) => updateFilter({ ring: value === "any" ? null : value })}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2">
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

        {matches.length > 0 ? (
          <PlaceList
            id={IDS.list}
            label="Ortsteile"
            groups={groups}
            selected={selected}
            onSelect={(code) => select(code, "list")}
            listRef={listRef}
            describedBy={IDS.count}
            className="pb-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-0"
          />
        ) : (
          <div className="flex flex-col items-start gap-2 px-4 py-6 md:px-6 lg:px-0">
            <p className="type-body font-[600]">No Ortsteil matches these filters.</p>
            <p className="type-small text-ink-2">Try another spelling, or clear the search and filters.</p>
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear search and filters
            </Button>
          </div>
        )}
      </section>

      <section
        ref={detailsRef}
        id={IDS.details}
        role={narrow ? "tabpanel" : undefined}
        aria-labelledby={narrow ? IDS.tabDetails : IDS.detailsTitle}
        className={cx(
          "min-h-0 overflow-y-auto bg-sheet [grid-area:sheet]",
          "lg:z-10 lg:w-[min(24rem,50%)] lg:justify-self-end lg:border-l lg:border-ink lg:[grid-area:map]",
          tab !== "details" && "max-lg:hidden",
          selectedPlace === null && "lg:hidden",
        )}
      >
        <PlaceDetails
          titleId={IDS.detailsTitle}
          place={selectedPlace}
          neighbors={neighbors}
          hiddenByFilter={hiddenByFilter}
          provenance={provenance}
          headingRef={headingRef}
          onSelectNeighbor={(code) => select(code, "details")}
          onClose={close}
          onClearFilters={clearFilters}
        />
      </section>

      <div
        className="relative min-h-0 overflow-hidden border-t-[3px] border-ink bg-sheet [grid-area:map]"
        data-map-state={phase}
      >
        <div className={cx("absolute inset-0 p-4 pb-8", phase === "ready" && "invisible")}>
          <PlateLayer
            idPrefix={plateIdPrefix}
            width={plateSize.width}
            height={plateSize.height}
            selected={selected}
            dimmed={dimmed}
            onSelect={(code) => select(code, "map")}
          >
            {plate}
          </PlateLayer>
        </div>

        {mountMap ? (
          <ExploreMap
            key={mapKey}
            places={places}
            bezirke={bezirke}
            berlinBbox={berlinBbox}
            selected={selected}
            matching={matching}
            filtered={filtered}
            view={view}
            coverRef={detailsRef}
            onSelect={(code) => select(code, "map")}
            onStatus={setMapStatus}
          />
        ) : null}

        <MapNotice
          phase={phase}
          onRetry={() => {
            setMapStatus("loading");
            setMapKey((k) => k + 1);
          }}
        />

        <p className="absolute bottom-0 left-0 max-w-full bg-sheet px-2 py-1 type-label text-ink-2">{ATTRIBUTION}</p>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <Suspense fallback={null}>
        <SearchParamsReader onSearch={onSearch} />
      </Suspense>
    </div>
  );
}

function MapNotice({ phase, onRetry }: { phase: string; onRetry: () => void }) {
  const box = "absolute top-3 right-3 left-3 flex max-w-[40rem] flex-col items-start gap-2 border border-ink bg-sheet px-3 py-2.5 type-small lg:right-auto";
  if (phase === "placeholder" || phase === "loading") {
    return (
      <p role="status" className="absolute top-3 left-3 border border-rule bg-sheet px-3 py-1.5 type-small text-ink-2">
        Loading the interactive map&hellip;
      </p>
    );
  }
  if (phase === "fallback") {
    return (
      <div className={box}>
        <p>
          <span className="font-[650]">The interactive map needs WebGL2</span>, which this browser doesn&rsquo;t
          provide or has turned off. This plate shows the same Ortsteile: tap one here, or use the list.
        </p>
      </div>
    );
  }
  if (phase === "lost") {
    return (
      <p role="status" className={box}>
        The map stopped drawing and should come back by itself. The plate stands in meanwhile.
      </p>
    );
  }
  if (phase === "error") {
    return (
      <div className={box}>
        <p>
          <span className="font-[650]">The map data couldn&rsquo;t be loaded.</span> The list and this plate
          still work.
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try loading the map again
        </Button>
      </div>
    );
  }
  return null;
}
