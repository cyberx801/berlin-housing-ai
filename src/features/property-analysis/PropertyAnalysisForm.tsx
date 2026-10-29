"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type ReactNode,
} from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { ProvenanceLabel } from "@/components/provenance/ProvenanceLabel";
import { ProvenanceMark } from "@/components/provenance/ProvenanceMark";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { createTransport, PropertyAnalysisService, type PreparedRequest } from "@/lib/api/prediction/service";
import type { FieldIssue, RentEstimateOutcome } from "@/lib/api/prediction/types";
import { SearchParamsReader } from "@/lib/url-state/SearchParamsReader";
import { PREFILL_LABELS, readAnalyzePrefill, type PrefillField } from "@/lib/validation/prefill";
import {
  createPropertySchema,
  EMPTY_PROPERTY_FORM,
  FIELD_GROUPS,
  isAnswered,
  REQUIRED_FIELDS,
  type FieldGroup,
  type PropertyFormValues,
  type PropertyInput,
} from "@/lib/validation/property";
import type { BezirkOption, OrtsteilOption } from "@/types/geo";
import { clearDraft, readDraft, writeDraft } from "./draft";
import {
  ANALYZE_ID,
  FIELD_LABELS,
  FIELD_ORDER,
  fieldId,
  fingerprint,
  formFieldForWire,
  SECTIONS,
  sectionId,
  type FormField,
} from "./fields";
import type { ResultPlace } from "./InputSummary";
import { focusPropertyField, PropertyFields } from "./PropertyFields";
import { ResultPanel } from "./ResultPanel";

const FORM_ID = `${ANALYZE_ID}-form`;
const PREFILL_PARAMS: PrefillField[] = ["bezirk", "ortsteil", "type", "area", "rooms"];

type Notice =
  | { kind: "restored" }
  | { kind: "draft-discarded" }
  | { kind: "prefilled"; used: PrefillField[]; ignored: PrefillField[]; earlier: PropertyFormValues | null };

interface Analysis {
  input: PropertyInput;
  prepared: PreparedRequest;
  outcome: RentEstimateOutcome;
  /** Form values at submit, to tell when the result no longer matches the form. */
  fingerprint: string;
  attempt: number;
}

const linkClass = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";

const subscribeNothing = () => () => {};

const listLabels = (fields: PrefillField[]) => fields.map((f) => PREFILL_LABELS[f]).join(", ");

const focusField = (field: FormField) => focusPropertyField(field, fieldId);

/**
 * The full property form (PRD B1–B7). Validates with the shared Zod schema, keeps a session
 * draft, accepts the homepage's URL prefill once, and renders every prediction outcome.
 */
export function PropertyAnalysisForm({
  bezirke,
  ortsteile,
}: {
  bezirke: readonly BezirkOption[];
  ortsteile: readonly OrtsteilOption[];
}) {
  const schema = useMemo(() => createPropertySchema(bezirke, ortsteile), [bezirke, ortsteile]);
  const bezirkByCode = useMemo(() => new Map(bezirke.map((b) => [b.code, b])), [bezirke]);
  const ortsteilByCode = useMemo(() => new Map(ortsteile.map((o) => [o.code, o])), [ortsteile]);
  const service = useMemo(
    () =>
      new PropertyAnalysisService(createTransport(), {
        bezirkName: (code) => bezirkByCode.get(code)?.name,
        ortsteilName: (code) => ortsteilByCode.get(code)?.name,
      }),
    [bezirkByCode, ortsteilByCode],
  );

  const { control, register, handleSubmit, reset, setValue, getValues, setError, formState } = useForm<
    PropertyFormValues,
    unknown,
    PropertyInput
  >({
    resolver: zodResolver(schema) as Resolver<PropertyFormValues, unknown, PropertyInput>,
    defaultValues: EMPTY_PROPERTY_FORM,
    // Errors first appear on submit, then update as the user types (D-033). Validating on blur
    // inserts an error as the pointer goes down on "Prepare analysis", moves the button, and
    // the click is lost (measured: 27 px at 1440 px).
    mode: "onSubmit",
    reValidateMode: "onChange",
    // Focus goes to the error summary instead (FRONTEND_ARCHITECTURE §5, D-032).
    shouldFocusError: false,
  });
  const { errors, isSubmitted, isSubmitting, submitCount } = formState;
  const values: PropertyFormValues = { ...EMPTY_PROPERTY_FORM, ...useWatch({ control }) };

  // False in the static HTML and during hydration. Submits before then are dropped by React,
  // so `data-hydrated` tells tests (and anyone debugging) when the form is live.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [serverIssues, setServerIssues] = useState<FieldIssue[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback(
    // A trailing no-break space makes a repeated message a new one, so it is read again.
    (message: string) => setAnnouncement((prev) => (prev === message ? `${message} ` : message)),
    [],
  );

  // ---- Entry: session draft, then URL prefill (each applied once) ----
  const entryHandled = useRef(false);
  const draftReady = useRef(false);

  const onSearch = useCallback(
    (search: string) => {
      const params = new URLSearchParams(search);
      const hasPrefill = PREFILL_PARAMS.some((p) => params.has(p));
      const firstVisit = !entryHandled.current;
      entryHandled.current = true;

      if (!hasPrefill) {
        if (firstVisit) {
          const draft = readDraft();
          if (draft.status === "ok") {
            reset(draft.value);
            setNotice({ kind: "restored" });
            announce("Restored your entries from earlier in this session.");
          } else if (draft.status === "discarded") {
            setNotice({ kind: "draft-discarded" });
          }
        }
        draftReady.current = true;
        return;
      }

      // A link from the homepage starts a new description; earlier entries stay one click away.
      const draft = firstVisit ? readDraft() : null;
      const earlier = firstVisit ? (draft?.status === "ok" ? draft.value : null) : getValues();
      const { values: prefill, ignored } = readAnalyzePrefill(params, bezirke, ortsteile);
      reset({ ...EMPTY_PROPERTY_FORM, ...prefill });
      setAnalysis(null);
      setServerIssues([]);
      setNotice({
        kind: "prefilled",
        used: PREFILL_PARAMS.filter((p) => params.get(p)?.trim() && !ignored.includes(p)),
        ignored,
        earlier: earlier && FIELD_ORDER.some((f) => isAnswered(f, earlier)) ? earlier : null,
      });
      if (ignored.length > 0) announce(`Some values in the link were not valid and were left empty: ${listLabels(ignored)}.`);
      draftReady.current = true;
      // The values now live in the form and its draft. Dropping them from the URL means a
      // reload restores the user's edits instead of re-applying the link.
      window.history.replaceState(null, "", window.location.pathname);
      const firstEmpty = REQUIRED_FIELDS.find((f) => !isAnswered(f, getValues()));
      if (firstEmpty) focusField(firstEmpty);
    },
    // setNotice is a stable setter; the React Compiler infers it as a dependency, so it is listed.
    [announce, bezirke, getValues, ortsteile, reset, setNotice],
  );

  // ---- Session draft: written on every change once the entry step has run ----
  const currentFingerprint = fingerprint(values);
  useEffect(() => {
    if (!draftReady.current) return;
    const current = getValues();
    if (FIELD_ORDER.some((f) => isAnswered(f, current))) writeDraft(current);
    else clearDraft();
  }, [currentFingerprint, getValues]);

  // ---- Error summary: focused after each failed submit ----
  const summaryRef = useRef<HTMLElement>(null);
  const lastSubmit = useRef(0);
  const errorList = FIELD_ORDER.flatMap((field) => {
    const message = errors[field]?.message;
    return message ? [{ field, message, server: errors[field]?.type === "server" }] : [];
  });
  const showSummary = isSubmitted && (errorList.length > 0 || serverIssues.length > 0);
  useEffect(() => {
    // Hidden routes re-run effects when shown again; only a new submit moves focus.
    if (submitCount === lastSubmit.current) return;
    lastSubmit.current = submitCount;
    if (showSummary) summaryRef.current?.focus();
  }, [submitCount, showSummary]);

  // ---- Submit ----
  const inFlight = useRef(false);

  async function estimate(input: PropertyInput, prepared: PreparedRequest, attempt: number, submitted: string) {
    const outcome = await service.estimateRent(prepared);
    if (outcome.status === "invalid_input") {
      // The model's own checks disagreed with ours: mark the fields it named.
      const unmapped: FieldIssue[] = [];
      for (const issue of outcome.issues) {
        const field = formFieldForWire(issue.field);
        if (field) setError(field, { type: "server", message: `${FIELD_LABELS[field]}: ${issue.issue}` });
        else unmapped.push(issue);
      }
      setServerIssues(unmapped);
      setAnalysis(null);
      return;
    }
    setAnalysis({ input, prepared, outcome, fingerprint: submitted, attempt });
    setNotice(null); // the result supersedes "restored" and "filled in from the link"
    announce("Analysis prepared.");
  }

  const onValid = async (input: PropertyInput) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setServerIssues([]);
      await estimate(input, service.prepare(input), 1, fingerprint(getValues()));
    } finally {
      inFlight.current = false;
    }
  };

  async function retry() {
    if (!analysis || inFlight.current) return;
    inFlight.current = true;
    try {
      await estimate(analysis.input, analysis.prepared, analysis.attempt + 1, analysis.fingerprint);
    } finally {
      inFlight.current = false;
    }
  }

  function startOver() {
    reset(EMPTY_PROPERTY_FORM);
    clearDraft();
    setAnalysis(null);
    setServerIssues([]);
    setNotice(null);
    setConfirmReset(false);
    announce("The form was cleared.");
  }

  function restoreEarlier(earlier: PropertyFormValues) {
    reset(earlier);
    setAnalysis(null);
    setNotice({ kind: "restored" });
    announce("Your earlier entries are back.");
  }

  function placeOf(input: PropertyInput): ResultPlace {
    const bezirk = bezirkByCode.get(input.bezirkCode);
    const ortsteil = input.ortsteilCode ? ortsteilByCode.get(input.ortsteilCode) : undefined;
    return {
      bezirkName: bezirk?.name ?? input.bezirkCode,
      bezirkSlug: bezirk?.slug ?? "",
      ortsteilName: ortsteil?.name ?? null,
      ortsteilSlug: ortsteil?.slug ?? null,
    };
  }

  // ---- Progress ----
  const answeredIn = (group: FieldGroup) => FIELD_GROUPS[group].filter((f) => isAnswered(f, values)).length;
  const requiredAnswered = REQUIRED_FIELDS.filter((f) => isAnswered(f, values)).length;
  const requiredText = `Required fields: ${requiredAnswered} of ${REQUIRED_FIELDS.length}`;
  const serverErrorCount = errorList.filter((e) => e.server).length + serverIssues.length;
  const summaryTitle =
    serverErrorCount > 0
      ? `The rent model could not use ${serverErrorCount === 1 ? "1 value" : `${serverErrorCount} values`}`
      : `Fix ${errorList.length === 1 ? "1 field" : `${errorList.length} fields`} to prepare the analysis`;

  // WCAG 2.4.11: the strip's scroll-margin keeps focused fields clear of it, but WebKit
  // ignores scroll-margin when focus moves; there the page is scrolled by the difference.
  const stripRef = useRef<HTMLDivElement>(null);
  function keepClearOfStrip(event: FocusEvent<HTMLDivElement>) {
    const target = event.target;
    const strip = stripRef.current;
    if (!(target instanceof HTMLElement) || !strip || strip.contains(target)) return;
    requestAnimationFrame(() => {
      const bottom = strip.getBoundingClientRect().bottom;
      if (strip.offsetHeight === 0 || document.activeElement !== target) return;
      const top = target.getBoundingClientRect().top;
      if (top < bottom) window.scrollBy({ top: top - bottom - 8 });
    });
  }

  const submitButton = (size?: "sm") => (
    <Button type="submit" form={FORM_ID} size={size} aria-busy={isSubmitting || undefined}>
      Prepare analysis
    </Button>
  );

  return (
    <div data-sticky-strip className="pb-16" onFocus={keepClearOfStrip}>
      {/* Below lg the rail becomes a sticky strip under the header (DESIGN_DIRECTION /analyze mobile). */}
      <div ref={stripRef} className="sticky top-[var(--header-height)] z-30 border-b border-rule bg-paper lg:hidden">
        <div className="page-gutter flex min-h-[var(--progress-strip-height)] items-center justify-between gap-3 py-2">
          <p className="type-small font-[620] tabular">{requiredText}</p>
          {submitButton("sm")}
        </div>
      </div>

      <div className="page-grid gap-y-6 pt-6 lg:pt-0">
        <aside aria-label="Form progress" className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-[calc(var(--header-height)+1.5rem)] flex flex-col gap-6">
            <nav aria-labelledby={`${ANALYZE_ID}-rail-title`} className="flex flex-col gap-3">
              <h2 id={`${ANALYZE_ID}-rail-title`} className="type-title-3 stretch-wide">
                Your flat
              </h2>
              <ol className="flex flex-col border-t border-rule">
                {SECTIONS.map(({ key, title }) => (
                  <li key={key} className="border-b border-rule">
                    <a
                      href={`#${sectionId(key)}`}
                      className="flex min-h-11 items-center justify-between gap-3 px-1 transition-state hover:bg-sheet"
                    >
                      <span className="font-[560]">{title}</span>
                      <span className="type-small text-ink-2 tabular">
                        {answeredIn(key)} of {FIELD_GROUPS[key].length}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <p className="font-[620] tabular">{requiredText}</p>
            <div className="flex flex-wrap items-center gap-4">
              {submitButton()}
              <Button variant="quiet" onClick={() => setConfirmReset(true)}>
                Start over
              </Button>
            </div>
            <div className="flex flex-col gap-1.5 border-t border-rule pt-4 type-small text-ink-2">
              <p className="flex items-center gap-2 font-[620] text-ink">
                <ProvenanceMark kind="not-connected" className="shrink-0" />
                Rent model: not connected
              </p>
              <p>Preparing an analysis checks your description and shows the request a model would receive.</p>
              <Link href="/methodology#in-development" className={linkClass}>
                What this means
              </Link>
            </div>
          </div>
        </aside>

        <div className="col-span-full flex min-w-0 flex-col gap-6 lg:col-span-8">
          {analysis ? (
            <ResultPanel
              key={`${analysis.prepared.requestId}-${analysis.attempt}`}
              id={`${ANALYZE_ID}-result`}
              outcome={analysis.outcome}
              input={analysis.input}
              payload={analysis.prepared.payload}
              place={placeOf(analysis.input)}
              stale={analysis.fingerprint !== currentFingerprint}
              onRetry={retry}
            />
          ) : null}

          {showSummary ? (
            <section
              ref={summaryRef}
              id={`${ANALYZE_ID}-errors`}
              tabIndex={-1}
              aria-labelledby={`${ANALYZE_ID}-errors-title`}
              className="flex flex-col gap-3 border-l-4 border-critical bg-sheet p-5"
            >
              <h2 id={`${ANALYZE_ID}-errors-title`} className="flex items-start gap-2.5 type-title-3">
                <CircleAlert aria-hidden="true" className="mt-1 size-5 shrink-0 text-critical" />
                <span>{summaryTitle}</span>
              </h2>
              <ul className="flex flex-col gap-1.5">
                {errorList.map(({ field, message }) => (
                  <li key={field}>
                    <a
                      href={`#${fieldId(field)}`}
                      onClick={(event) => {
                        event.preventDefault();
                        focusField(field);
                      }}
                      className="font-[560] text-critical underline underline-offset-4"
                    >
                      {message}
                    </a>
                  </li>
                ))}
                {serverIssues.map((issue, i) => (
                  <li key={`${issue.field}-${i}`} className="font-[560] text-critical">
                    {issue.field}: {issue.issue}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {notice ? (
            <NoticeView
              notice={notice}
              onRestoreEarlier={restoreEarlier}
              onStartOver={() => setConfirmReset(true)}
              onDismiss={() => setNotice(null)}
            />
          ) : null}

          <form
            id={FORM_ID}
            data-hydrated={hydrated ? "" : undefined}
            noValidate
            onSubmit={(event) => void handleSubmit(onValid)(event)}
            aria-labelledby={`${ANALYZE_ID}-form-title`}
            className="flex flex-col gap-8 border-t-[3px] border-ink-2 bg-sheet px-4 pt-4 pb-6 md:px-8 md:pb-8"
          >
            <div className="flex flex-col gap-1">
              <ProvenanceLabel provenance={{ kind: "user" }} />
              <h2 id={`${ANALYZE_ID}-form-title`} className="sr-only">
                Property description
              </h2>
            </div>

            <PropertyFields
              form={{ control, register, setValue, getValues }}
              idOf={fieldId}
              bezirke={bezirke}
              ortsteile={ortsteile}
              announce={announce}
              renderSection={(group, children) => (
                <FormSection group={group} answered={answeredIn(group)}>
                  {children}
                </FormSection>
              )}
            />

            <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-6">
              {submitButton()}
              <Button variant="quiet" onClick={() => setConfirmReset(true)}>
                Start over
              </Button>
            </div>
          </form>
        </div>
      </div>

      <Dialog
        id={`${ANALYZE_ID}-reset`}
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Start over?"
        description="This clears every field and the draft saved in this tab."
        size="sm"
      >
        <div className="flex flex-wrap gap-3">
          <Button onClick={startOver}>Clear the form</Button>
          <Button variant="secondary" onClick={() => setConfirmReset(false)}>
            Keep my entries
          </Button>
        </div>
      </Dialog>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Suspense fallback={null}>
        <SearchParamsReader onSearch={onSearch} />
      </Suspense>
    </div>
  );
}

function FormSection({ group, answered, children }: { group: FieldGroup; answered: number; children: ReactNode }) {
  const id = sectionId(group);
  const title = SECTIONS.find((s) => s.key === group)?.title ?? group;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-5 border-t border-rule pt-6 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-title`} className="type-title-3 stretch-wide">
          {title}
        </h2>
        <p className="type-small text-ink-2 tabular">
          {answered} of {FIELD_GROUPS[group].length} answered
        </p>
      </div>
      {children}
    </section>
  );
}

function NoticeView({
  notice,
  onRestoreEarlier,
  onStartOver,
  onDismiss,
}: {
  notice: Notice;
  onRestoreEarlier: (earlier: PropertyFormValues) => void;
  onStartOver: () => void;
  onDismiss: () => void;
}) {
  const earlier = notice.kind === "prefilled" ? notice.earlier : null;
  return (
    <div className="flex flex-col gap-2 border-l-4 border-ink-2 bg-sheet px-4 py-3 type-small">
      {notice.kind === "restored" ? <p>Restored your entries from earlier in this session.</p> : null}
      {notice.kind === "draft-discarded" ? (
        <p>A saved draft couldn&rsquo;t be read, so it was removed. The form starts empty.</p>
      ) : null}
      {notice.kind === "prefilled" ? (
        <>
          {notice.used.length > 0 ? <p>Filled in from the link: {listLabels(notice.used)}.</p> : null}
          {notice.ignored.length > 0 ? (
            <p className="font-[560]">
              Left empty because the link&rsquo;s value wasn&rsquo;t valid: {listLabels(notice.ignored)}.
            </p>
          ) : null}
        </>
      ) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {earlier ? (
          <Button variant="quiet" onClick={() => onRestoreEarlier(earlier)}>
            Bring back your earlier entries
          </Button>
        ) : null}
        {notice.kind === "restored" ? (
          <Button variant="quiet" onClick={onStartOver}>
            Start over
          </Button>
        ) : null}
        <Button variant="quiet" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
