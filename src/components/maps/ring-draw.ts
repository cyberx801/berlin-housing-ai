// The ring draw-in runs once per browser session (DESIGN_SYSTEM §6, motion-ring).
// An inline script in <head> sets the attribute before first paint on later page loads;
// the plate sets it after the first draw so a re-shown route doesn't replay it.
export const RING_DRAWN_KEY = "bhai.ringDrawn.v1";
export const RING_DRAWN_ATTR = "data-ring-drawn";

export const ringDrawScript = `try{if(sessionStorage.getItem(${JSON.stringify(RING_DRAWN_KEY)}))document.documentElement.setAttribute(${JSON.stringify(RING_DRAWN_ATTR)},"")}catch(e){}`;

export function markRingDrawn() {
  document.documentElement.setAttribute(RING_DRAWN_ATTR, "");
  try {
    sessionStorage.setItem(RING_DRAWN_KEY, "1");
  } catch {
    // Storage blocked: the draw may replay on the next page load, which is harmless.
  }
}
