"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { cx } from "@/lib/cx";
import type { ExplorePlace } from "@/types/geo";

export interface PlaceGroup {
  code: string;
  name: string;
  places: readonly ExplorePlace[];
}

interface PlaceListProps {
  id: string;
  label: string;
  groups: readonly PlaceGroup[];
  selected: string | null;
  onSelect: (code: string) => void;
  listRef: RefObject<HTMLDivElement | null>;
  describedBy?: string;
  className?: string;
}

export const optionId = (listId: string, code: string) => `${listId}-o-${code}`;

const PAGE = 10;

/**
 * A single-select listbox (aria-activedescendant). Focus stays on the list: arrow keys, Home,
 * End and Page keys move the active option, Enter or Space selects it. Selection does not
 * follow focus, because every selection moves the map camera.
 */
export function PlaceList({ id, label, groups, selected, onSelect, listRef, describedBy, className }: PlaceListProps) {
  const codes = useMemo(() => groups.flatMap((group) => group.places.map((p) => p.code)), [groups]);
  const [active, setActive] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const pointerDown = useRef(false);
  const current = active !== null && codes.includes(active) ? active : null;

  const move = (code: string | undefined) => {
    if (code === undefined) return;
    setActive(code);
    document.getElementById(optionId(id, code))?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = current === null ? -1 : codes.indexOf(current);
    const last = codes.length - 1;
    switch (event.key) {
      case "ArrowDown":
        move(codes[Math.min(index + 1, last)]);
        break;
      case "ArrowUp":
        move(codes[Math.max(index - 1, 0)]);
        break;
      case "Home":
        move(codes[0]);
        break;
      case "End":
        move(codes[last]);
        break;
      case "PageDown":
        move(codes[Math.min(index + PAGE, last)]);
        break;
      case "PageUp":
        move(codes[Math.max(index - PAGE, 0)]);
        break;
      case "Enter":
      case " ":
        if (current !== null) onSelect(current);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-describedby={describedBy}
      aria-activedescendant={current !== null ? optionId(id, current) : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={() => {
        pointerDown.current = true;
      }}
      onFocus={() => {
        setFocused(true);
        // A pointer press focuses the list before its click lands; don't scroll it away.
        if (pointerDown.current || current !== null) return;
        move(selected !== null && codes.includes(selected) ? selected : codes[0]);
      }}
      onBlur={() => {
        setFocused(false);
        pointerDown.current = false;
      }}
      className={cx("focus-visible:-outline-offset-2", className)}
    >
      {groups.map((group) => (
        <div key={group.code} role="group" aria-label={group.name}>
          <div aria-hidden="true" className="sticky top-0 z-[1] bg-paper px-3 pt-4 pb-1 type-label text-ink-2">
            {group.name}
          </div>
          {group.places.map((place) => {
            const isSelected = place.code === selected;
            return (
              <div
                key={place.code}
                id={optionId(id, place.code)}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  pointerDown.current = false;
                  setActive(place.code);
                  onSelect(place.code);
                }}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 type-body transition-state",
                  isSelected
                    ? "bg-marker font-[620] shadow-[inset_0_0_0_2px_var(--color-ink)] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none"
                    : "hover:bg-sheet",
                  focused && place.code === current && "outline-2 -outline-offset-2 outline-focus",
                )}
              >
                <span>{place.name}</span>
                {isSelected ? <span className="type-small">Selected</span> : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
