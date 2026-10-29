import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Some suites run in the node environment (e.g. the proxy route), where there is no DOM.
const hasDom = typeof window !== "undefined";

if (hasDom) {
  // jsdom implements neither scrolling nor modal dialogs; the app relies on both.
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }

  // jsdom has no matchMedia. Width queries ("(width < 64rem)", "(min-width: 1024px)") are
  // answered from window.innerWidth so tests can resize; anything else does not match.
  window.matchMedia ??= (query: string) => {
    const evaluate = () => {
      const px = (value: string, unit: string) => Number(value) * (unit === "rem" ? 16 : 1);
      const below = /width\s*<\s*([\d.]+)(rem|px)/.exec(query) ?? /max-width:\s*([\d.]+)(rem|px)/.exec(query);
      if (below?.[1] && below[2]) return window.innerWidth < px(below[1], below[2]);
      const above = /width\s*>=\s*([\d.]+)(rem|px)/.exec(query) ?? /min-width:\s*([\d.]+)(rem|px)/.exec(query);
      if (above?.[1] && above[2]) return window.innerWidth >= px(above[1], above[2]);
      return false;
    };
    return {
      media: query,
      get matches() {
        return evaluate();
      },
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  };

  // jsdom can't draw; without this stub it logs "Not implemented" for every canvas probe.
  // Returning null is what a browser without WebGL2 does, so the map's fallback path runs.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
