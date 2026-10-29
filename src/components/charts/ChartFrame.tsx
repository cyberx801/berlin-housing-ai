"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cx } from "@/lib/cx";

export interface ChartSize {
  width: number;
  height: number;
}

export interface ChartTooltipContent {
  /** Anchor point inside the chart, in px. */
  x: number;
  y: number;
  content: ReactNode;
}

interface ChartFrameProps {
  /** Names the chart for assistive tech, e.g. "Median asking rent per m², by month". */
  label: string;
  /** Number of positions the cursor can take (months, bars, bins, rows). */
  count: number;
  /** Where the cursor starts before anyone moves it. */
  initialIndex?: number;
  /** "horizontal" moves with Left/Right (time, bins); "vertical" with Up/Down (rows). */
  orientation?: "horizontal" | "vertical";
  /** Fixed height in px; without it the frame takes its height from `className`. */
  height?: number;
  className?: string;
  /** The readout for one position; it becomes the slider's aria-valuetext. */
  valueText: (index: number) => string;
  /** Maps a pointer position (px, inside the frame) to a position, or null outside the plot. */
  indexAt: (point: { x: number; y: number }, size: ChartSize) => number | null;
  tooltip: (index: number, size: ChartSize) => ChartTooltipContent | null;
  /** Draws the SVG once the frame has been measured. `active` is the highlighted position. */
  children: (state: { size: ChartSize; active: number | null }) => ReactNode;
}

/**
 * The interactive shell every chart shares (FRONTEND_ARCHITECTURE §7, DESIGN_SYSTEM §8.4):
 * measures itself, draws nothing until measured (the SSR box keeps its size, so nothing jumps),
 * and exposes one focusable slider whose arrow keys move the same cursor as the pointer.
 * The SVG is hidden from assistive tech: the slider's value text and the table view carry it.
 */
export function ChartFrame({
  label,
  count,
  initialIndex,
  orientation = "horizontal",
  height,
  className,
  valueText,
  indexAt,
  tooltip,
  children,
}: ChartFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const box = element.getBoundingClientRect();
      const next = { width: Math.round(box.width), height: Math.round(box.height) };
      if (next.width > 0 && next.height > 0) {
        setSize((previous) =>
          previous && previous.width === next.width && previous.height === next.height ? previous : next,
        );
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const last = Math.max(0, count - 1);
  // The data can change under the cursor (new filters), so keep it in range.
  const current = Math.min(cursor ?? initialIndex ?? last, last);
  const shown = dismissed ? null : (hovered ?? (focused ? current : null));
  const active = shown === null ? null : Math.min(shown, last);
  const tip = size && active !== null && count > 0 ? tooltip(active, size) : null;

  const move = (index: number) => {
    setCursor(Math.max(0, Math.min(last, index)));
    setDismissed(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const page = Math.max(1, Math.round(count / 6));
    const forward = orientation === "horizontal" ? ["ArrowRight", "ArrowUp"] : ["ArrowDown", "ArrowRight"];
    const backward = orientation === "horizontal" ? ["ArrowLeft", "ArrowDown"] : ["ArrowUp", "ArrowLeft"];
    let next: number | null = null;
    if (forward.includes(event.key)) next = current + 1;
    else if (backward.includes(event.key)) next = current - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "PageUp") next = current + (orientation === "horizontal" ? page : -page);
    else if (event.key === "PageDown") next = current + (orientation === "horizontal" ? -page : page);
    else if (event.key === "Escape" && !dismissed && active !== null) {
      // WCAG 1.4.13: the readout can be dismissed without moving focus.
      event.preventDefault();
      event.stopPropagation();
      setDismissed(true);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setHovered(null);
    move(next);
  };

  const pointAt = (event: PointerEvent<HTMLDivElement>) => {
    if (!size) return null;
    const box = event.currentTarget.getBoundingClientRect();
    return indexAt({ x: event.clientX - box.left, y: event.clientY - box.top }, size);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const index = pointAt(event);
    setHovered(index);
    if (index !== null) move(index);
  };

  return (
    <div
      ref={ref}
      data-chart=""
      className={cx("relative min-w-0", className)}
      style={height ? { height } : undefined}
    >
      {count > 0 ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-orientation={orientation}
          aria-valuemin={1}
          aria-valuemax={count}
          aria-valuenow={current + 1}
          aria-valuetext={valueText(current)}
          data-chart-index={active ?? undefined}
          className="absolute inset-0 touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onKeyDown={onKeyDown}
          onFocus={() => {
            setFocused(true);
            setDismissed(false);
          }}
          onBlur={() => setFocused(false)}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerMove}
          onPointerLeave={(event) => {
            // A tap leaves at once; keep its readout until focus moves on.
            if (event.pointerType !== "touch") setHovered(null);
          }}
        >
          {size ? children({ size, active }) : null}
        </div>
      ) : size ? (
        children({ size, active: null })
      ) : null}
      {tip ? <ChartTooltip tip={tip} width={size?.width ?? 0} /> : null}
    </div>
  );
}

/** The visual readout. Hidden from assistive tech, which reads the slider's value text instead. */
function ChartTooltip({ tip, width }: { tip: ChartTooltipContent; width: number }) {
  const flip = tip.x > width / 2;
  return (
    <div
      aria-hidden="true"
      data-chart-tooltip
      className="pointer-events-none absolute z-10 w-max max-w-[16rem] rounded-control border border-ink bg-sheet px-3 py-2 type-small text-ink"
      style={{
        top: Math.max(0, tip.y - 12),
        ...(flip ? { right: width - tip.x + 14 } : { left: tip.x + 14 }),
      }}
    >
      {tip.content}
    </div>
  );
}

/** One readout row: line key in the series color, value first (strong), then its label. */
export function TooltipRow({ swatch, value, label }: { swatch?: ReactNode; value: string; label?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      {swatch}
      <span className="tabular font-[650]">{value}</span>
      {label ? <span className="text-ink-2">{label}</span> : null}
    </div>
  );
}
