"use client";

import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Unique id base (hidden routes stay mounted, so ids must be page-unique). */
  id: string;
  size?: "sm" | "lg";
}

// Safari doesn't focus a button on click: focus goes to <body> or to a focusable ancestor
// (here <main tabindex=-1>), and the dialog returns it there. The control last pressed
// stands in for the opener then.
let lastPressed: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      lastPressed = event.target instanceof Element ? event.target.closest<HTMLElement>("button, a[href], [tabindex]") : null;
    },
    true,
  );
}

/**
 * After close: focus the opener where the browser put focus on <body> or an ancestor instead.
 * Owners that move focus elsewhere (D-050) run their effects after the dialog's.
 */
function returnFocus(target: HTMLElement | null) {
  const active = document.activeElement;
  if (target?.isConnected && target !== active && (!active || active.contains(target))) target.focus();
}

/**
 * Modal built on the native <dialog>: showModal() makes the rest of the page inert, traps
 * focus and closes on Esc; the browser returns focus to the opener on close, and where it
 * doesn't (Safari after a click) the dialog does.
 */
export function Dialog({ open, onClose, title, description, children, id, size = "lg" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const active = document.activeElement;
      opener.current =
        lastPressed && (!(active instanceof HTMLElement) || active.contains(lastPressed)) ? lastPressed : (active as HTMLElement);
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
      returnFocus(opener.current);
    }
  }, [open]);

  // Routes stay mounted (hidden) after navigation; never leave a modal open behind. The owner
  // hears about it a task later, so a cleanup that is set up again at once (StrictMode in
  // development) doesn't close a dialog that was mounted open.
  const pendingClose = useRef<number | null>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (pendingClose.current !== null) {
      window.clearTimeout(pendingClose.current);
      pendingClose.current = null;
    }
    const returnTo = opener;
    return () => {
      if (!dialog?.open) return;
      dialog.close();
      returnFocus(returnTo.current);
      pendingClose.current = window.setTimeout(() => {
        pendingClose.current = null;
        onCloseRef.current();
      }, 0);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      // A close queued by that cleanup can arrive after the dialog was shown again.
      onClose={() => {
        if (!ref.current?.open) onCloseRef.current();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      className={cx(
        "m-auto max-h-[min(90dvh,56rem)] w-[calc(100%-2rem)] overflow-y-auto border border-ink bg-sheet p-0 text-ink",
        "backdrop:bg-ink/40",
        size === "lg" ? "max-w-3xl" : "max-w-md",
      )}
    >
      {open ? (
        <div className="flex flex-col">
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-rule bg-sheet px-5 py-4 md:px-6">
            <div className="flex flex-col gap-1">
              <h2 id={`${id}-title`} className="type-title-2">
                {title}
              </h2>
              {description ? (
                <p id={`${id}-description`} className="type-small text-ink-2">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink hover:bg-paper"
            >
              <X aria-hidden="true" className="size-5" />
              <span className="sr-only">Close</span>
            </button>
          </header>
          <div className="px-5 py-5 md:px-6">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
