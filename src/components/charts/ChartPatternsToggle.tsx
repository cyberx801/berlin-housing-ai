"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getChartPatterns,
  getServerChartPatterns,
  setChartPatterns,
  subscribeChartPatterns,
} from "./chart-patterns";

/** The "patterns" setting: a native checkbox, applied at once and remembered in this browser. */
export function ChartPatternsToggle({ id }: { id: string }) {
  const on = useSyncExternalStore(subscribeChartPatterns, getChartPatterns, getServerChartPatterns);
  const [unsaved, setUnsaved] = useState(false);
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex min-h-9 cursor-pointer items-center gap-2.5 type-small font-[600] text-ink">
        <input
          id={id}
          type="checkbox"
          checked={on}
          aria-describedby={hintId}
          onChange={(event) => setUnsaved(!setChartPatterns(event.target.checked))}
          className="size-[1.125rem] shrink-0 cursor-pointer accent-ink"
        />
        Draw patterns in the charts
      </label>
      <p id={hintId} className="type-small text-ink-2">
        {unsaved
          ? "On until you reload or leave the site: this browser blocks storage, so the setting can’t be kept."
          : "Each line gets its own dash and bars are hatched, so no series depends on color alone. Saved in this browser."}
      </p>
    </div>
  );
}
