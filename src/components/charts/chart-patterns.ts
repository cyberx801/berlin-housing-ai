// The reader's "patterns" choice (DESIGN_SYSTEM §8.5, D-054): dashed lines and hatched bars in
// every chart. Kept in this browser only. An inline script in <head> sets the attribute before
// first paint, so a chart never flashes in color alone; globals.css does the drawing.
export const CHART_PATTERNS_KEY = "bhai.chartPatterns.v1";
export const CHART_PATTERNS_ATTR = "data-chart-patterns";

export const chartPatternsScript = `try{if(localStorage.getItem(${JSON.stringify(CHART_PATTERNS_KEY)})==="on")document.documentElement.setAttribute(${JSON.stringify(CHART_PATTERNS_ATTR)},"")}catch(e){}`;

const listeners = new Set<() => void>();

export function subscribeChartPatterns(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getChartPatterns(): boolean {
  return document.documentElement.hasAttribute(CHART_PATTERNS_ATTR);
}

export function getServerChartPatterns(): boolean {
  return false;
}

/** Applies the choice at once. Returns false when it couldn't be saved (blocked storage). */
export function setChartPatterns(on: boolean): boolean {
  document.documentElement.toggleAttribute(CHART_PATTERNS_ATTR, on);
  for (const listener of listeners) listener();
  try {
    if (on) localStorage.setItem(CHART_PATTERNS_KEY, "on");
    else localStorage.removeItem(CHART_PATTERNS_KEY);
    return true;
  } catch {
    return false;
  }
}
