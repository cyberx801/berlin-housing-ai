"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LegendBlock, LegendRail } from "@/components/layout/LegendRail";
import { Plate } from "@/components/provenance/Plate";
import { ProvenanceMark } from "@/components/provenance/ProvenanceMark";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { FIELD_ORDER } from "@/features/property-analysis/fields";
import { randomId } from "@/lib/id";
import { isAnswered } from "@/lib/validation/property";
import type { BezirkOption, OrtsteilOption } from "@/types/geo";
import { rentModelConnected } from "@/lib/api/prediction/connected";
import type { AddDraft, EditorMode, SaveResult } from "./CompareEditor";
import { columnId, CompareTable } from "./CompareTable";
import type { PlaceNames } from "./rows";
import {
  acknowledgeCompareDiscard,
  clearCompareItems,
  getCompareSnapshot,
  MAX_COMPARE_ITEMS,
  removeCompareItem,
  useCompareSnapshot,
  type CompareItem,
} from "./store";

const ID = "compare";
const TABLE_ID = `${ID}-table`;
const EMPTY_ID = `${ID}-empty`;
const linkClass = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";

const subscribeNothing = () => () => {};

// The dialog brings the form library and the full field set; it loads when first opened.
const loadEditor = () => import("./CompareEditor").then((m) => m.CompareEditor);
const CompareEditor = dynamic(loadEditor, { ssr: false });

const placesText = (n: number) => `${n} of ${MAX_COMPARE_ITEMS} places used.`;

function hasEntries(draft: AddDraft) {
  return FIELD_ORDER.some((f) => isAnswered(f, draft.property)) || Object.values(draft.extras).some((v) => v.trim() !== "");
}

/** Focuses a heading or other non-interactive target, making it focusable first if needed. */
function focusTarget(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!el.matches("a[href], button, input, select, textarea, [tabindex]")) el.setAttribute("tabindex", "-1");
  el.focus();
}

/**
 * `/compare` (PRD F1–F5): up to three properties from the user's own entries, kept in this browser.
 * Until hydration the saved comparison can't be read, so the page shows a neutral state
 * instead of an empty one.
 */
export function CompareView({
  bezirke,
  ortsteile,
}: {
  bezirke: readonly BezirkOption[];
  ortsteile: readonly OrtsteilOption[];
}) {
  const { items, discarded, persisted } = useCompareSnapshot();
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const names = useMemo<PlaceNames>(() => {
    const bezirkByCode = new Map(bezirke.map((b) => [b.code, b.name]));
    const ortsteilByCode = new Map(ortsteile.map((o) => [o.code, o.name]));
    return { bezirkName: (code) => bezirkByCode.get(code), ortsteilName: (code) => ortsteilByCode.get(code) };
  }, [bezirke, ortsteile]);

  const [editor, setEditor] = useState<{ key: string; mode: EditorMode } | null>(null);
  const [addDraft, setAddDraft] = useState<AddDraft | null>(null);
  const [removing, setRemoving] = useState<CompareItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Fetch the dialog once the page is interactive, so the first "Add" doesn't wait on the network.
  useEffect(() => {
    void loadEditor();
  }, []);

  // Focus and announcement after a dialog closes. Run after the dialog's own close (child
  // effects first), so the page is no longer inert and the message is read.
  const after = useRef<{ focus: string | null; message: string } | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const next = after.current;
    if (!next) return;
    after.current = null;
    if (next.focus) focusTarget(next.focus);
    const live = liveRef.current;
    // A trailing no-break space makes a repeated message a new one, so it is read again.
    if (live) live.textContent = live.textContent === next.message ? `${next.message} ` : next.message;
  });

  const openEditor = (mode: EditorMode) => setEditor({ key: randomId(), mode });

  function onSaved(result: SaveResult) {
    const used = placesText(getCompareSnapshot().items.length);
    const column = columnId(ID, result.id);
    if (result.kind === "added") {
      setAddDraft(null);
      after.current = { focus: column, message: `Added to comparison: ${result.label}. ${used}` };
    } else if (result.kind === "replaced") {
      setAddDraft(null);
      after.current = { focus: column, message: `${result.label} replaced ${result.replacedLabel}.` };
    } else {
      // A plain edit returns focus to its Edit button; "Add the asking rent" is gone once a rent is set.
      const fromRent = editor?.mode.kind === "edit" && editor.mode.focus === "askingColdRent";
      after.current = { focus: fromRent ? column : null, message: `Saved changes to ${result.label}.` };
    }
    setEditor(null);
  }

  function onCancel(draft: AddDraft | null) {
    if (editor?.mode.kind === "add") setAddDraft(draft && hasEntries(draft) ? draft : null);
    setEditor(null);
  }

  function confirmRemove() {
    if (!removing) return;
    removeCompareItem(removing.id);
    const left = getCompareSnapshot().items.length;
    after.current = {
      focus: left > 0 ? `${TABLE_ID}-title` : `${EMPTY_ID}-title`,
      message: `Removed ${removing.label}. ${placesText(left)}`,
    };
    setRemoving(null);
  }

  function confirmClearAll() {
    clearCompareItems();
    after.current = { focus: `${EMPTY_ID}-title`, message: "The comparison was cleared." };
    setConfirmClear(false);
  }

  const addButton = (variant: "primary" | "secondary") => (
    <Button variant={variant} onClick={() => openEditor({ kind: "add" })}>
      Add a property
    </Button>
  );

  const legend = (
    <>
      <LegendBlock title="Saved in this browser">
        <p>{hydrated ? placesText(items.length) : `Up to ${MAX_COMPARE_ITEMS} properties.`}</p>
        <p>Nothing you enter here is sent anywhere. Clearing your browser data removes it.</p>
      </LegendBlock>
      <LegendBlock title="€/m²">
        <p>The asking cold rent divided by the living area. Both come from your entries.</p>
      </LegendBlock>
      <LegendBlock title="Missing">
        <p>Not entered, or answered &ldquo;Not sure&rdquo;. Edit a property to fill it in.</p>
      </LegendBlock>
      <LegendBlock title="Predicted rent">
        <p className="flex items-center gap-2 font-[620] text-ink">
          <ProvenanceMark kind="not-connected" className="shrink-0" />
          {rentModelConnected ? "Not run here" : "Not connected"}
        </p>
        <p>
          {rentModelConnected
            ? "Compare does not run the rent model, so no property here has a predicted rent. The demo model answers on Analyze only."
            : "The rent model is still being built, so no property has a predicted rent."}
        </p>
        <Link href="/methodology#in-development" className={linkClass}>
          What this means
        </Link>
      </LegendBlock>
    </>
  );

  return (
    <div id={`${ID}-view`} data-hydrated={hydrated ? "" : undefined} className="page-grid gap-y-8 pb-16">
      {/* The rail comes first in the DOM, as on every route, so focus follows the drawing. Below lg
          it is a closed disclosure above the table (DESIGN_SYSTEM §4, D-053). */}
      <aside aria-label="Legend and sources" className="col-span-full lg:hidden">
        <Disclosure summary="Legend and sources">
          <div className="grid gap-x-6 gap-y-4 pb-2 md:grid-cols-2">{legend}</div>
        </Disclosure>
      </aside>
      <div className="hidden lg:col-span-3 lg:block">
        <LegendRail>{legend}</LegendRail>
      </div>

      <div className="col-span-full flex min-w-0 flex-col gap-6 lg:col-span-9">
        {discarded ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 border-ink bg-sheet px-4 py-3">
            <p className="type-small text-ink">
              The comparison saved in this browser couldn&rsquo;t be read, perhaps because it is from an older
              version, so it was removed.
            </p>
            <Button variant="quiet" onClick={acknowledgeCompareDiscard}>
              Dismiss
            </Button>
          </div>
        ) : null}
        {hydrated && !persisted ? (
          <p className="border-l-4 border-ink bg-sheet px-4 py-3 type-small text-ink">
            This browser blocks storage, so the comparison lasts only until you reload or leave the site.
          </p>
        ) : null}

        {!hydrated ? (
          <div className="flex flex-col gap-2 border border-rule bg-sheet p-5 md:p-6">
            <p className="text-ink-2">Reading the comparison saved in this browser.</p>
            <noscript>
              <p className="text-ink">
                The comparison needs JavaScript: it is kept in this browser&rsquo;s storage, which only a script can
                read.
              </p>
            </noscript>
          </div>
        ) : items.length === 0 ? (
          <StatusPanel
            id={EMPTY_ID}
            tone="empty"
            title="Add the properties you are weighing up"
            actions={
              <>
                {addButton("primary")}
                <ButtonLink variant="secondary" href="/analyze">
                  Start from an analysis
                </ButtonLink>
              </>
            }
          >
            <p>
              Put up to {MAX_COMPARE_ITEMS} properties side by side: the asking cold rent, €/m² worked out from your numbers,
              and every detail you know. A property you describe on Analyze can be added from its result.
            </p>
          </StatusPanel>
        ) : (
          <Plate
            id={TABLE_ID}
            title="How do your properties compare?"
            provenance={{ kind: "user" }}
            bodyClassName="px-0 md:px-5"
            actions={
              <>
                {addButton("secondary")}
                <Button variant="quiet" onClick={() => setConfirmClear(true)}>
                  Clear all
                </Button>
              </>
            }
            caption="€/m² is the asking cold rent divided by the living area, both as you entered them. Nothing on this page is a market estimate."
          >
            <CompareTable
              idPrefix={ID}
              items={items}
              names={names}
              onEdit={(item, focus) => openEditor({ kind: "edit", item, focus })}
              onRemove={setRemoving}
            />
          </Plate>
        )}
      </div>

      {editor ? (
        <CompareEditor
          key={editor.key}
          id={`${ID}-editor`}
          mode={editor.mode}
          draft={editor.mode.kind === "add" ? addDraft : null}
          items={items}
          bezirke={bezirke}
          ortsteile={ortsteile}
          names={names}
          onCancel={onCancel}
          onSaved={onSaved}
        />
      ) : null}

      <Dialog
        id={`${ID}-remove`}
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.label}?` : "Remove the property?"}
        description="It is deleted from this browser and can't be brought back."
        size="sm"
      >
        <div className="flex flex-wrap gap-3">
          <Button onClick={confirmRemove}>Remove the property</Button>
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Keep it
          </Button>
        </div>
      </Dialog>

      <Dialog
        id={`${ID}-clear`}
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear the comparison?"
        description={`${items.length === 1 ? "This property is" : `All ${items.length} properties are`} deleted from this browser and can't be brought back.`}
        size="sm"
      >
        <div className="flex flex-wrap gap-3">
          <Button onClick={confirmClearAll}>Clear the comparison</Button>
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>
            Keep them
          </Button>
        </div>
      </Dialog>

      <p ref={liveRef} aria-live="polite" className="sr-only" />
    </div>
  );
}

