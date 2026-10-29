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
}

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
