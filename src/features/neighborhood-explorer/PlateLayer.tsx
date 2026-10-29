"use client";

import { useState, type ReactNode } from "react";
import { plateIds } from "@/components/maps/plate-ids";

interface PlateLayerProps {
  idPrefix: string;
  width: number;
  height: number;
  selected: string | null;
  /** Codes outside the current filter, tinted like the map's dimmed areas. */
  dimmed: readonly string[];
  onSelect: (code: string) => void;
  /** The server-rendered `<RingPlate>` with the same `idPrefix`, sized to fill this layer. */
  children: ReactNode;
}

function codeAt(target: EventTarget | null): string | null {
  return target instanceof Element ? (target.closest("[data-code]")?.getAttribute("data-code") ?? null) : null;
}

/**
 * The SVG plate standing in for the map: while MapLibre loads, and for good when WebGL2 is
 * missing (D-038). Pointer hover and tap work as on the homepage plate; the list is the
 * keyboard path. Highlights are `<use>` clones, so the 97 server paths never re-render.
 */
export function PlateLayer({ idPrefix, width, height, selected, dimmed, onSelect, children }: PlateLayerProps) {
  const ids = plateIds(idPrefix);
  const [hovered, setHovered] = useState<string | null>(null);
  const highlighted = selected !== null || dimmed.length > 0;

  return (
    <div
      className="relative size-full cursor-pointer touch-manipulation"
      onPointerOver={(event) => {
        if (event.pointerType !== "touch") setHovered(codeAt(event.target));
      }}
      onPointerLeave={() => setHovered(null)}
      onClick={(event) => {
        const code = codeAt(event.target);
        if (code) onSelect(code);
      }}
    >
      {children}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
      >
        {dimmed.map((code) => (
          <use
            key={code}
            href={`#${ids.ortsteil(code)}`}
            style={{ fill: "var(--color-ink)", fillOpacity: 0.12, stroke: "none" }}
          />
        ))}
        {selected ? (
          <use
            href={`#${ids.ortsteil(selected)}`}
            style={{ fill: "var(--color-marker)", fillOpacity: 0.85, stroke: "none" }}
          />
        ) : null}
        {highlighted ? <use href={`#${ids.borders}`} /> : null}
        {highlighted ? <use href={`#${ids.ring}`} /> : null}
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
  );
}
