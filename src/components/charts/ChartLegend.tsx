import { LineKey, type SeriesSlot } from "./chart-parts";

/** Legend for two or more series: line keys beside text-token labels (DESIGN_SYSTEM §8.4). */
export function ChartLegend({ items, label = "Legend" }: { items: { key: string; label: string; slot: SeriesSlot }[]; label?: string }) {
  if (items.length < 2) return null;
  return (
    <ul aria-label={label} className="mb-2 flex flex-wrap gap-x-5 gap-y-1 type-small text-ink">
      {items.map((item) => (
        <li key={item.key} className="inline-flex items-center gap-2">
          <LineKey slot={item.slot} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
