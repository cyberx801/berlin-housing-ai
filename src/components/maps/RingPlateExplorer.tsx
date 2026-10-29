"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Select } from "@/components/ui/Select";
import { formatKm2, formatRingShare } from "@/lib/formatting/number";
import { RING_STATUS_LABELS } from "@/lib/property/labels";
import type { PlatePlace } from "@/types/geo";
import { plateIds } from "./plate-ids";
import { markRingDrawn } from "./ring-draw";

interface RingPlateExplorerProps {
  idPrefix: string;
  width: number;
  height: number;
  places: readonly PlatePlace[];
  /** The server-rendered `<RingPlate>` with the same `idPrefix`. */
  children: ReactNode;
  /** Draw-in is 150 ms delay + 900 ms; mark it done after that. */
  drawsRing?: boolean;
}

function codeAt(target: EventTarget | null): string | null {
  return target instanceof Element ? (target.closest("[data-code]")?.getAttribute("data-code") ?? null) : null;
}

/**
 * Pointer hover/tap and a grouped native select drive one highlight and readout (D-031).
 * Highlights are `<use>` clones of the server paths in a pointer-transparent overlay,
 * so the 97 paths are never re-rendered on the client.
 */
export function RingPlateExplorer({
  idPrefix,
  width,
  height,
  places,
  children,
  drawsRing = false,
}: RingPlateExplorerProps) {
  const ids = plateIds(idPrefix);
  const selectId = `${idPrefix}-find`;
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const byCode = useMemo(() => new Map(places.map((p) => [p.code, p])), [places]);
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; places: PlatePlace[] }>();
    for (const p of places) {
      const group = map.get(p.bezirkCode) ?? { name: p.bezirkName, places: [] };
      group.places.push(p);
      map.set(p.bezirkCode, group);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [places]);

  useEffect(() => {
    if (!drawsRing) return;
    const timer = window.setTimeout(markRingDrawn, 1100);
    return () => window.clearTimeout(timer);
  }, [drawsRing]);

  const shown = byCode.get(hovered ?? selected ?? "") ?? null;
  const selectedPlace = selected ? byCode.get(selected) : undefined;
  const active = hovered !== null || selected !== null;

  return (
    <div className="flex flex-col gap-6">
      {/* Pointer only; the select below is the keyboard path. */}
      <div
        className="relative cursor-pointer touch-manipulation"
        onPointerOver={(e) => {
          if (e.pointerType !== "touch") setHovered(codeAt(e.target));
        }}
        onPointerLeave={() => setHovered(null)}
        onClick={(e) => {
          const code = codeAt(e.target);
          if (code) setSelected(code);
        }}
      >
        {children}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full"
        >
          {selected ? (
            <use
              href={`#${ids.ortsteil(selected)}`}
              style={{ fill: "var(--color-marker)", fillOpacity: 0.85, stroke: "none" }}
            />
          ) : null}
          {active ? <use href={`#${ids.borders}`} /> : null}
          {active ? <use href={`#${ids.ring}`} /> : null}
          {selected ? (
            <use
              href={`#${ids.ortsteil(selected)}`}
              style={{ fill: "none", stroke: "var(--color-ink)", strokeWidth: 2 }}
            />
          ) : null}
          {hovered && hovered !== selected ? (
            <use
              href={`#${ids.ortsteil(hovered)}`}
              style={{ fill: "none", stroke: "var(--color-ink)", strokeWidth: 1.5 }}
            />
          ) : null}
        </svg>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="type-body font-[600]">
            Find an Ortsteil
          </label>
          <p id={`${selectId}-hint`} className="type-small text-ink-2">
            All 97, grouped by Bezirk (borough). On the plate, point at or tap an area.
          </p>
          <Select
            id={selectId}
            aria-describedby={`${selectId}-hint`}
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value || null)}
          >
            <option value="">Choose an Ortsteil</option>
            {groups.map((group) => (
              <optgroup key={group.name} label={group.name}>
                {group.places.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        <PlaceReadout place={shown} linkable={shown !== null && shown.code === selected} />
      </div>

      <p className="sr-only" aria-live="polite">
        {selectedPlace
          ? `${selectedPlace.name}, in ${selectedPlace.bezirkName}. ${RING_STATUS_LABELS[selectedPlace.ringStatus]}.`
          : ""}
      </p>
    </div>
  );
}

function PlaceReadout({ place, linkable }: { place: PlatePlace | null; linkable: boolean }) {
  if (!place) {
    return (
      <p className="self-end border-t border-rule pt-3 type-small text-ink-2">
        Choose an Ortsteil to see its Bezirk, its area and how much of it lies inside the ring.
      </p>
    );
  }
  return (
    <div className="flex min-h-36 flex-col gap-2 border-t border-ink pt-3">
      <p className="type-title-3 stretch-wide">{place.name}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 type-small">
        <dt className="text-ink-2">Bezirk</dt>
        <dd>{place.bezirkName}</dd>
        <dt className="text-ink-2">Ring status</dt>
        <dd>{RING_STATUS_LABELS[place.ringStatus]}</dd>
        <dt className="text-ink-2">Area inside the ring</dt>
        <dd className="tabular">{formatRingShare(place.ringShare)}</dd>
        <dt className="text-ink-2">Area</dt>
        <dd className="tabular">{formatKm2(place.areaKm2)}</dd>
      </dl>
      {linkable ? (
        <Link href={`/neighborhoods/${place.slug}`} className="type-small font-[600]">
          Open the {place.name} profile
        </Link>
      ) : null}
    </div>
  );
}
