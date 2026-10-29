"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Maximize, Minus, Plus } from "lucide-react";
import {
  getVersion,
  Map as MapLibreMap,
  setWorkerUrl,
  type LngLatBoundsLike,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { cx } from "@/lib/cx";
import type { ExploreBezirk, ExplorePlace } from "@/types/geo";
import type { Bbox, MapStatus, MapTarget, MapView } from "./map-types";
import { prefersReducedMotion } from "./webgl";

interface ExploreMapProps {
  places: readonly ExplorePlace[];
  bezirke: readonly ExploreBezirk[];
  berlinBbox: Bbox;
  selected: string | null;
  /** Codes that match the current filter; the rest are dimmed while `filtered`. */
  matching: ReadonlySet<string>;
  filtered: boolean;
  view: MapView;
  /** The details panel. Where it covers the map, camera targets are fitted beside it. */
  coverRef: RefObject<HTMLElement | null>;
  onSelect: (code: string) => void;
  onStatus: (status: MapStatus) => void;
}

const SOURCE = { ortsteile: "ortsteile", bezirke: "bezirke", ring: "ring" } as const;
const FILL_LAYER = "ortsteil-fill";
/** Below this zoom the map labels Bezirke; from it, Ortsteile. */
const ORTSTEIL_LABEL_ZOOM = 11;
const PADDING = 32;
/** Height of the attribution line along the map's bottom edge (ExploreView). */
const ATTRIBUTION_STRIP = 28;
const MOTION_MAP_MS = 600;
const WORKER_URL = `/vendor/maplibre-gl-worker-${getVersion()}.js`;

/** Colours come from the design tokens on :root, so the canvas matches the CSS. */
function buildStyle(root: Element, origin: string): StyleSpecification {
  const css = getComputedStyle(root);
  // Absolute, because the worker resolves URLs against its own (possibly blob:) address.
  const data = (file: string) => new URL(`/geo/${file}`, origin).href;
  const token = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
  const ink = token("ink");
  const sheet = token("sheet");
  const selected = ["boolean", ["feature-state", "selected"], false];
  const hover = ["boolean", ["feature-state", "hover"], false];
  const dim = ["boolean", ["feature-state", "dim"], false];
  return {
    version: 8,
    sources: {
      [SOURCE.ortsteile]: { type: "geojson", data: data("ortsteile.geojson"), promoteId: "code" },
      [SOURCE.bezirke]: { type: "geojson", data: data("bezirke.geojson"), promoteId: "code" },
      [SOURCE.ring]: { type: "geojson", data: data("ring.geojson") },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": sheet } },
      {
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE.ortsteile,
        paint: {
          "fill-color": ["case", selected, token("marker"), dim, ink, sheet],
          "fill-opacity": ["case", selected, 0.85, dim, 0.12, 1],
        },
      },
      {
        id: "ortsteil-line",
        type: "line",
        source: SOURCE.ortsteile,
        layout: { "line-join": "round" },
        paint: { "line-color": token("line-strong"), "line-width": 0.75 },
      },
      {
        id: "bezirk-line",
        type: "line",
        source: SOURCE.bezirke,
        layout: { "line-join": "round" },
        paint: { "line-color": ink, "line-width": 1.5 },
      },
      {
        id: "ring-casing",
        type: "line",
        source: SOURCE.ring,
        layout: { "line-join": "round" },
        paint: { "line-color": sheet, "line-width": 4.5 },
      },
      {
        id: "ring-line",
        type: "line",
        source: SOURCE.ring,
        layout: { "line-join": "round" },
        paint: { "line-color": ink, "line-width": 2.5 },
      },
      {
        id: "ortsteil-outline",
        type: "line",
        source: SOURCE.ortsteile,
        layout: { "line-join": "round" },
        paint: { "line-color": ink, "line-width": ["case", selected, 2, hover, 1.5, 0] },
      },
    ],
  } as StyleSpecification;
}

function grow([w, s, e, n]: Bbox, factor: number): Bbox {
  const dx = (e - w) * factor;
  const dy = (n - s) * factor;
  return [w - dx, s - dy, e + dx, n + dy];
}

function targetBbox(
  target: MapTarget,
  places: readonly ExplorePlace[],
  bezirke: readonly ExploreBezirk[],
  berlin: Bbox,
): Bbox {
  if (target.kind === "ortsteil") return places.find((p) => p.code === target.code)?.bbox ?? berlin;
  if (target.kind === "bezirk") return bezirke.find((b) => b.code === target.code)?.bbox ?? berlin;
  return berlin;
}

/** How many pixels of the map's right side the details panel covers (lg and up; else 0). */
function coveredRight(container: HTMLElement | null, cover: HTMLElement | null): number {
  if (!container || !cover || cover.offsetParent === null) return 0;
  const box = container.getBoundingClientRect();
  const panel = cover.getBoundingClientRect();
  const overlaps = panel.left < box.right && panel.right > box.left && panel.top < box.bottom && panel.bottom > box.top;
  return overlaps ? Math.max(0, box.right - panel.left) : 0;
}

/** Padding for camera fits, widened on the side the details panel covers. */
function fitOptions(target: MapTarget, container: HTMLElement | null, cover: HTMLElement | null) {
  const box = container?.getBoundingClientRect();
  // An Ortsteil keeps a margin of its surroundings, so its neighbours stay readable.
  const base =
    target.kind === "ortsteil" && box ? Math.max(PADDING, Math.round(Math.min(box.width, box.height) * 0.15)) : PADDING;
  const right = base + coveredRight(container, cover);
  return {
    padding: { top: base, bottom: base, left: base, right },
    maxZoom: target.kind === "ortsteil" ? 13 : 12.5,
  };
}

/** Feature state can't be written once the map is removed; cleanups may run after that. */
function setState(map: MapLibreMap, code: string, state: Record<string, boolean>) {
  try {
    map.setFeatureState({ source: SOURCE.ortsteile, id: code }, state);
  } catch {
    // The map was removed first (route hidden or left); nothing to undo.
  }
}

/**
 * The interactive map (D-004, D-038): our own GeoJSON and an inline style, so no key and no
 * third-party requests. Labels are HTML (there is no glyph server) and hidden from assistive
 * tech, because the list and the details panel carry the same information.
 */
export default function ExploreMap({
  places,
  bezirke,
  berlinBbox,
  selected,
  matching,
  filtered,
  view,
  coverRef,
  onSelect,
  onStatus,
}: ExploreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<string, HTMLSpanElement>());
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const appliedView = useRef(view.id);
  const byArea = useMemo(() => [...places].sort((a, b) => b.areaKm2 - a.areaKm2), [places]);

  const select = useEffectEvent((code: string) => onSelect(code));
  const report = useEffectEvent((status: MapStatus) => onStatus(status));
  const startView = useEffectEvent(() => {
    appliedView.current = view.id;
    return {
      bounds: targetBbox(view.target, places, bezirke, berlinBbox) as LngLatBoundsLike,
      fitBoundsOptions: fitOptions(view.target, containerRef.current, coverRef.current),
    };
  });

  // Selection and filter dimming are feature-state, so the sources are never re-parsed.
  useEffect(() => {
    if (!map || !selected) return;
    setState(map, selected, { selected: true });
    return () => setState(map, selected, { selected: false });
  }, [map, selected]);

  useEffect(() => {
    if (!map) return;
    for (const place of places) setState(map, place.code, { dim: filtered && !matching.has(place.code) });
  }, [map, places, matching, filtered]);

  useEffect(() => {
    if (!map || view.id === appliedView.current) return;
    appliedView.current = view.id;
    const duration = view.instant || prefersReducedMotion() ? 0 : MOTION_MAP_MS;
    map.fitBounds(targetBbox(view.target, places, bezirke, berlinBbox) as LngLatBoundsLike, {
      ...fitOptions(view.target, containerRef.current, coverRef.current),
      duration,
      animate: duration > 0,
    });
  }, [map, view, places, bezirke, berlinBbox, coverRef]);

  // Labels: placed greedily (selected first, then larger areas) and hidden where they collide.
  const placeLabels = useEffectEvent(() => {
    const container = containerRef.current;
    if (!map || !container) return;
    // Labels under the details panel or the attribution line would be cut off: off-map for labels.
    const width = container.clientWidth - coveredRight(container, coverRef.current);
    const height = container.clientHeight - ATTRIBUTION_STRIP;
    const candidates: { key: string; lngLat: [number, number] }[] = [];
    const selectedPlace = selected ? places.find((p) => p.code === selected) : undefined;
    if (selectedPlace) candidates.push({ key: `o-${selectedPlace.code}`, lngLat: selectedPlace.labelPoint });
    if (map.getZoom() >= ORTSTEIL_LABEL_ZOOM) {
      for (const place of byArea) {
        if (place.code === selected || (filtered && !matching.has(place.code))) continue;
        candidates.push({ key: `o-${place.code}`, lngLat: place.labelPoint });
      }
    } else {
      for (const bezirk of bezirke) candidates.push({ key: `b-${bezirk.code}`, lngLat: bezirk.labelPoint });
    }

    // Read every size first, then write, so the pass costs one layout.
    const sizes = new Map<string, [number, number]>();
    for (const { key } of candidates) {
      const el = labelRefs.current.get(key);
      if (el) sizes.set(key, [el.offsetWidth, el.offsetHeight]);
    }
    const placed: [number, number, number, number][] = [];
    const positions = new Map<string, [number, number]>();
    for (const { key, lngLat } of candidates) {
      const size = sizes.get(key);
      if (!size) continue;
      const { x, y } = map.project(lngLat);
      const box: [number, number, number, number] = [
        x - size[0] / 2 - 3,
        y - size[1] / 2 - 2,
        x + size[0] / 2 + 3,
        y + size[1] / 2 + 2,
      ];
      if (box[0] < 0 || box[1] < 0 || box[2] > width || box[3] > height) continue;
      if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      positions.set(key, [x, y]);
    }
    for (const [key, el] of labelRefs.current) {
      const position = positions.get(key);
      el.style.visibility = position ? "visible" : "hidden";
      if (position) el.style.transform = `translate(${position[0]}px, ${position[1]}px) translate(-50%, -50%)`;
    }
  });

  useEffect(() => {
    if (!map) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => placeLabels());
    };
    map.on("move", schedule);
    map.on("resize", schedule);
    schedule();
    void document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      map.off("move", schedule);
      map.off("resize", schedule);
    };
  }, [map]);

  // Re-place after the selection or filter changes (the selected label is bold, so wider).
  useLayoutEffect(() => {
    placeLabels();
  }, [selected, matching, filtered]);

  // Created last, so on unmount the effects above clean up while the map still exists. Hidden
  // routes stay mounted but their effects are torn down (D-027): a returning visitor gets a
  // fresh map framed on the current view.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    report("loading");
    setWorkerUrl(WORKER_URL);
    let instance: MapLibreMap;
    try {
      instance = new MapLibreMap({
        container,
        style: buildStyle(document.documentElement, window.location.origin),
        ...startView(),
        maxBounds: grow(berlinBbox, 0.6) as LngLatBoundsLike,
        maxZoom: 15,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        locale: {
          "Map.Title": "Map of Berlin's Ortsteile. Arrow keys move the map, plus and minus zoom.",
        },
      });
    } catch {
      report("unsupported");
      return;
    }
    instance.touchZoomRotate.disableRotation();
    instance.keyboard.disableRotation();

    let hovered: string | null = null;
    const setHover = (code: string | null) => {
      if (code === hovered) return;
      if (hovered) setState(instance, hovered, { hover: false });
      if (code) setState(instance, code, { hover: true });
      hovered = code;
      instance.getCanvas().style.cursor = code ? "pointer" : "";
    };
    const codeOf = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.id;
      return typeof id === "string" ? id : null;
    };

    instance.on("mousemove", FILL_LAYER, (event) => setHover(codeOf(event)));
    instance.on("mouseleave", FILL_LAYER, () => setHover(null));
    instance.on("click", FILL_LAYER, (event) => {
      const code = codeOf(event);
      if (code) select(code);
    });
    // A listener replaces MapLibre's own console logging, so every error is logged here too.
    let failed = false;
    instance.on("error", (event) => {
      console.error(event.error);
      if ((event as { sourceId?: string }).sourceId) {
        failed = true;
        report("error");
      }
    });
    instance.on("webglcontextlost", () => report("lost"));
    instance.on("webglcontextrestored", () => report("ready"));
    instance.once("load", () => {
      setMap(instance);
      instance.once("idle", () => {
        if (!failed) report("ready");
      });
    });

    return () => {
      setMap(null);
      instance.remove();
    };
  }, [berlinBbox]);

  const zoomBy = (delta: 1 | -1) => {
    if (!map) return;
    const options = { duration: prefersReducedMotion() ? 0 : 250 };
    if (delta > 0) map.zoomIn(options);
    else map.zoomOut(options);
  };

  const showBerlin = () => {
    if (!map) return;
    const duration = prefersReducedMotion() ? 0 : MOTION_MAP_MS;
    map.fitBounds(berlinBbox as LngLatBoundsLike, {
      ...fitOptions({ kind: "berlin" }, containerRef.current, coverRef.current),
      duration,
      animate: duration > 0,
    });
  };

  return (
    <div className="absolute inset-0" data-explore-map="">
      {/* MapLibre's unlayered `.maplibregl-map { position: relative }` beats layered utilities,
          so the map container fills a positioned wrapper instead of positioning itself. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="size-full" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {bezirke.map((bezirk) => (
          <MapLabel key={`b-${bezirk.code}`} id={`b-${bezirk.code}`} refs={labelRefs} className="font-[650] text-ink">
            {bezirk.name}
          </MapLabel>
        ))}
        {places.map((place) => (
          <MapLabel
            key={`o-${place.code}`}
            id={`o-${place.code}`}
            refs={labelRefs}
            className={place.code === selected ? "font-[720] text-ink" : "text-ink-2"}
          >
            {place.name}
          </MapLabel>
        ))}
      </div>

      {map ? (
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <MapButton label="Zoom in" onClick={() => zoomBy(1)}>
            <Plus />
          </MapButton>
          <MapButton label="Zoom out" onClick={() => zoomBy(-1)}>
            <Minus />
          </MapButton>
          <MapButton label="Show all of Berlin" onClick={showBerlin}>
            <Maximize />
          </MapButton>
        </div>
      ) : null}
    </div>
  );
}

function MapLabel({
  id,
  refs,
  className,
  children,
}: {
  id: string;
  refs: RefObject<Map<string, HTMLSpanElement>>;
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      ref={(el) => {
        if (!el) return;
        refs.current.set(id, el);
        return () => void refs.current.delete(id);
      }}
      className={cx("invisible absolute top-0 left-0 type-label whitespace-nowrap label-halo", className)}
    >
      {children}
    </span>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-control border border-ink bg-sheet text-ink transition-state hover:bg-paper active:translate-y-px [&>svg]:size-5"
    >
      {children}
    </button>
  );
}
