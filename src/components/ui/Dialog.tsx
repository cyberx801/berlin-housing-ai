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

/**
 * Modal built on the native <dialog>: showModal() makes the rest of the page inert, traps
 * focus and closes on Esc; the browser returns focus to the opener on close.
 */
export function Dialog({ open, onClose, title, description, children, id, size = "lg" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
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
    return () => {
      if (!dialog?.open) return;
      dialog.close();
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
