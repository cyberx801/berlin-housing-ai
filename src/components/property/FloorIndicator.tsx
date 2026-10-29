import { cx } from "@/lib/cx";

const MAX_DRAWN_FLOORS = 25;

/**
 * A vertical stack of the building's floors with the chosen one marked (DESIGN_DIRECTION:
 * the one element borrowed from "Grundriss"). Decorative twin of the floor inputs: it shows
 * only what the user typed, so it is hidden from assistive tech.
 */
export function FloorIndicator({ floor, totalFloors }: { floor: number | null; totalFloors: number | null }) {
  if (totalFloors === null || totalFloors < 1 || totalFloors > MAX_DRAWN_FLOORS) return null;
  // Floor numbers top-down: totalFloors … 1, 0 (ground), and −1 only when it is the chosen one.
  const levels = Array.from({ length: totalFloors + 1 }, (_, i) => totalFloors - i);
  if (floor === -1) levels.push(-1);
  const segment = Math.max(4, Math.min(14, Math.floor(156 / levels.length)));

  return (
    <div aria-hidden="true" className="flex w-12 flex-col gap-[2px]">
      {levels.map((level) => (
        <span
          key={level}
          className={cx(
            "block",
            level === floor
              ? "border-2 border-ink bg-marker forced-colors:bg-[Highlight]"
              : "border border-line-strong bg-sheet",
            level === -1 && "border-dashed",
          )}
          style={{ height: segment }}
        />
      ))}
      <span className="block h-[2px] bg-ink" />
    </div>
  );
}
