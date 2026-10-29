"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { Dialog } from "@/components/ui/Dialog";
import { Field, inputClasses } from "@/components/ui/Field";
import { peekDraft } from "@/features/property-analysis/draft";
import { FIELD_ORDER, SECTIONS, type FormField } from "@/features/property-analysis/fields";
import { focusPropertyField, PropertyFields } from "@/features/property-analysis/PropertyFields";
import {
  COMPARE_LIMITS,
  createCompareExtrasSchema,
  EMPTY_COMPARE_EXTRAS,
  rentToField,
  type CompareExtras,
  type CompareExtrasValues,
} from "@/lib/validation/compare";
import {
  createPropertySchema,
  EMPTY_PROPERTY_FORM,
  isAnswered,
  toFormValues,
  type PropertyFormValues,
  type PropertyInput,
} from "@/lib/validation/property";
import type { BezirkOption, OrtsteilOption } from "@/types/geo";
import { defaultLabelFor, type PlaceNames } from "./rows";
import { addCompareItem, MAX_COMPARE_ITEMS, replaceCompareItem, type CompareItem } from "./store";

export type EditorMode = { kind: "add" } | { kind: "edit"; item: CompareItem; focus?: "askingColdRent" };

/** Unsaved entries of a closed "Add" dialog, offered again when it reopens. */
export interface AddDraft {
  property: PropertyFormValues;
  extras: CompareExtrasValues;
  fromAnalysis: boolean;
}

export type SaveResult =
  | { kind: "added"; id: string; label: string }
  | { kind: "replaced"; id: string; label: string; replacedLabel: string }
  | { kind: "edited"; id: string; label: string };

type ExtrasField = keyof CompareExtrasValues;
const EXTRAS_ORDER: ExtrasField[] = ["replace", "label", "askingColdRent", "listingUrl"];
const EXTRAS_LABELS: Record<ExtrasField, string> = {
  replace: "Property to replace",
  label: "Name in the comparison",
  askingColdRent: "Asking cold rent",
  listingUrl: "Link to the listing",
};

interface CompareEditorProps {
  id: string;
  mode: EditorMode;
  /** The add draft to continue from, if the last "Add" dialog was closed without saving. */
  draft: AddDraft | null;
  items: readonly CompareItem[];
  bezirke: readonly BezirkOption[];
  ortsteile: readonly OrtsteilOption[];
  names: PlaceNames;
  /** Closed without saving. In add mode it hands back the entries, so closing never loses input. */
  onCancel: (draft: AddDraft | null) => void;
  onSaved: (result: SaveResult) => void;
}

/**
 * The add/edit dialog (PRD F1, USER_FLOWS Flow 5): the same fields, rules and messages as
 * `/analyze`, plus the listing's name, asking cold rent and link. Mounted per opening, so each
 * one starts from its own values; the parent keeps unsaved "Add" entries between openings.
 */
export function CompareEditor({ id, mode, draft, items, bezirke, ortsteile, names, onCancel, onSaved }: CompareEditorProps) {
  const idOf = useCallback((field: FormField | ExtrasField) => `${id}-${field}`, [id]);

  // An edited property can disappear in another tab; the entries then become a new one.
  const [orphaned, setOrphaned] = useState(false);
  const kind = mode.kind === "edit" && !orphaned ? "edit" : "add";
  const replaceIds = kind === "add" && items.length >= MAX_COMPARE_ITEMS ? items.map((item) => item.id) : [];

  const initial = useMemo(() => {
    if (mode.kind === "edit") {
      const { item } = mode;
      return {
        property: toFormValues(item.property),
        extras: {
          // A title the dialog made up stays empty, so it follows the place and area when they change.
          label: item.label === defaultLabelFor(item.property, names) ? "" : item.label,
          askingColdRent: rentToField(item.askingColdRent),
          listingUrl: item.listingUrl ?? "",
          replace: "",
        },
        fromAnalysis: item.source === "analysis",
      };
    }
    return draft ?? { property: EMPTY_PROPERTY_FORM, extras: EMPTY_COMPARE_EXTRAS, fromAnalysis: false };
  }, [draft, mode, names]);

  const schema = useMemo(() => createPropertySchema(bezirke, ortsteile), [bezirke, ortsteile]);
  const propertyForm = useForm<PropertyFormValues, unknown, PropertyInput>({
    resolver: zodResolver(schema) as Resolver<PropertyFormValues, unknown, PropertyInput>,
    defaultValues: initial.property,
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });

  // The replace choice depends on the live comparison, so the resolver reads the current ids.
  const replaceIdsRef = useRef<readonly string[]>(replaceIds);
  useLayoutEffect(() => {
    replaceIdsRef.current = replaceIds;
  });
  const extrasResolver = useCallback<Resolver<CompareExtrasValues, unknown, CompareExtras>>(
    (values, context, options) =>
      (zodResolver(createCompareExtrasSchema(replaceIdsRef.current)) as Resolver<CompareExtrasValues, unknown, CompareExtras>)(
        values,
        context,
        options,
      ),
    [],
  );
  const extrasForm = useForm<CompareExtrasValues, unknown, CompareExtras>({
    resolver: extrasResolver,
    defaultValues: initial.extras,
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });

  const [fromAnalysis, setFromAnalysis] = useState(initial.fromAnalysis);
  const [restoredDraft, setRestoredDraft] = useState(mode.kind === "add" && draft !== null);
  // Read once when the dialog opens; it is the tab's own /analyze draft (WCAG 3.3.7).
  const [analysisDraft] = useState(() => {
    if (mode.kind !== "add") return null;
    const values = peekDraft();
    return values && FIELD_ORDER.some((f) => isAnswered(f, values)) ? values : null;
  });
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback(
    (message: string) => setAnnouncement((prev) => (prev === message ? `${message} ` : message)),
    [],
  );

  // ---- Focus on open: the rent field when the table asked for it ----
  const focusOnOpen = mode.kind === "edit" ? mode.focus : undefined;
  useEffect(() => {
    if (focusOnOpen) document.getElementById(idOf(focusOnOpen))?.focus();
  }, [focusOnOpen, idOf]);

  // ---- Error summary, focused after each failed save ----
  const [attempt, setAttempt] = useState(0);
  const summaryRef = useRef<HTMLElement>(null);
  const lastAttempt = useRef(0);
  const propertyErrors = propertyForm.formState.errors;
  const extrasErrors = extrasForm.formState.errors;
  const errorList: { field: FormField | ExtrasField; message: string; property: boolean }[] = [
    ...EXTRAS_ORDER.flatMap((field) => {
      const message = extrasErrors[field]?.message;
      return message ? [{ field, message, property: false }] : [];
    }),
    ...FIELD_ORDER.flatMap((field) => {
      const message = propertyErrors[field]?.message;
      return message ? [{ field, message, property: true }] : [];
    }),
  ];
  const showSummary = attempt > 0 && errorList.length > 0;
  useEffect(() => {
    if (attempt === lastAttempt.current) return;
    lastAttempt.current = attempt;
    if (showSummary) summaryRef.current?.focus();
  }, [attempt, showSummary]);

  function focusErrorField(field: FormField | ExtrasField, property: boolean) {
    if (property) {
      focusPropertyField(field as FormField, idOf);
      return;
    }
    const el = document.getElementById(idOf(field));
    const target = field === "replace" ? el?.querySelector<HTMLInputElement>("input") : el;
    el?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  }

  // ---- Close and save ----
  // Set once the dialog has saved or been closed; the Dialog also reports its own unmount.
  const done = useRef(false);
  function close() {
    if (done.current) return;
    done.current = true;
    onCancel(
      kind === "add"
        ? { property: propertyForm.getValues(), extras: extrasForm.getValues(), fromAnalysis }
        : null,
    );
  }

  async function submit() {
    const parsed: { property?: PropertyInput; extras?: CompareExtras } = {};
    await propertyForm.handleSubmit((value) => {
      parsed.property = value;
    })();
    await extrasForm.handleSubmit((value) => {
      parsed.extras = value;
    })();
    const { property, extras } = parsed;
    if (!property || !extras) {
      setAttempt((n) => n + 1);
      return;
    }

    const label = extras.label ?? defaultLabelFor(property, names);
    const entry = { label, property, askingColdRent: extras.askingColdRent, listingUrl: extras.listingUrl };

    if (kind === "edit" && mode.kind === "edit") {
      if (replaceCompareItem(mode.item.id, { ...entry, source: mode.item.source })) {
        done.current = true;
        onSaved({ kind: "edited", id: mode.item.id, label });
      } else {
        setOrphaned(true);
        announce("This property is no longer in the comparison. Save again to add your entries as a new one.");
      }
      return;
    }

    const source = fromAnalysis ? "analysis" : "manual";
    if (extras.replace) {
      const replacedLabel = items.find((item) => item.id === extras.replace)?.label ?? "";
      if (replaceCompareItem(extras.replace, { ...entry, source })) {
        done.current = true;
        onSaved({ kind: "replaced", id: extras.replace, label, replacedLabel });
        return;
      }
    }
    const result = addCompareItem({ ...entry, source });
    if (result.ok) {
      done.current = true;
      onSaved({ kind: "added", id: result.id, label });
      return;
    }
    // The comparison filled up after the dialog opened (another tab); the choice now appears.
    extrasForm.setError("replace", {
      type: "manual",
      message: "The comparison is now full. Choose the property this one replaces.",
    });
    setAttempt((n) => n + 1);
  }

  function fillFromAnalysis() {
    if (!analysisDraft) return;
    propertyForm.reset(analysisDraft);
    setFromAnalysis(true);
    setRestoredDraft(false);
    announce("Filled in from your analysis. Add the asking rent from the listing.");
    document.getElementById(idOf("askingColdRent"))?.focus();
  }

  function startEmpty() {
    propertyForm.reset(EMPTY_PROPERTY_FORM);
    extrasForm.reset(EMPTY_COMPARE_EXTRAS);
    setFromAnalysis(false);
    setRestoredDraft(false);
    setAttempt(0);
    announce("The form was cleared.");
    document.getElementById(idOf("label"))?.focus();
  }

  const { register } = extrasForm;
  const title = kind === "edit" && mode.kind === "edit" ? `Edit ${mode.item.label}` : "Add a property to the comparison";
  const summaryTitle = `Fix ${errorList.length === 1 ? "1 field" : `${errorList.length} fields`} to ${
    kind === "edit" ? "save the changes" : "add this property"
  }`;

  return (
    <Dialog
      id={id}
      open
      onClose={close}
      title={title}
      description="Saved in this browser only. The Bezirk, property type, living area and rooms are required."
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-labelledby={`${id}-title`}
        className="flex flex-col gap-8"
      >
        {orphaned ? (
          <Notice>
            This property is no longer in the comparison, perhaps removed in another tab. Your entries are still
            here: save them to add it again.
          </Notice>
        ) : null}

        {showSummary ? (
          <section
            ref={summaryRef}
            id={`${id}-errors`}
            tabIndex={-1}
            aria-labelledby={`${id}-errors-title`}
            className="flex flex-col gap-3 border-l-4 border-critical bg-paper p-4"
          >
            <h3 id={`${id}-errors-title`} className="flex items-start gap-2.5 type-title-3">
              <CircleAlert aria-hidden="true" className="mt-1 size-5 shrink-0 text-critical" />
              <span>{summaryTitle}</span>
            </h3>
            <ul className="flex flex-col gap-1.5">
              {errorList.map(({ field, message, property }) => (
                <li key={field}>
                  <a
                    href={`#${idOf(field)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      focusErrorField(field, property);
                    }}
                    className="font-[560] text-critical underline underline-offset-4"
                  >
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {restoredDraft ? (
          <Notice>
            <p>Your unsaved entries from before are still here.</p>
            <Button variant="quiet" onClick={startEmpty}>
              Start with an empty form
            </Button>
          </Notice>
        ) : null}

        {kind === "add" && analysisDraft ? (
          fromAnalysis ? (
            <Notice>Filled in from your analysis in this tab. Check the details, then add the asking rent.</Notice>
          ) : (
            <Notice>
              <p>You described a property on Analyze in this tab.</p>
              <Button variant="secondary" onClick={fillFromAnalysis}>
                Fill in from your analysis
              </Button>
            </Notice>
          )
        ) : null}

        {replaceIds.length > 0 ? (
          <ChoiceGroup
            id={idOf("replace")}
            name="replace"
            legend="Which property does this one replace?"
            hint={`The comparison holds up to ${MAX_COMPARE_ITEMS} properties and is full.`}
            required
            options={items.map((item) => ({ value: item.id, label: item.label }))}
            error={extrasErrors.replace?.message}
            inputProps={register("replace")}
          />
        ) : null}

        <EditorSection id={`${id}-section-listing`} title="The listing">
          <Field
            id={idOf("label")}
            label={EXTRAS_LABELS.label}
            hint="The column title. Leave it empty to use the Ortsteil and living area."
            error={extrasErrors.label?.message}
          >
            {(c) => (
              <input
                type="text"
                autoComplete="off"
                maxLength={COMPARE_LIMITS.label.max * 2}
                className={inputClasses}
                {...c}
                {...register("label")}
              />
            )}
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              id={idOf("askingColdRent")}
              label={EXTRAS_LABELS.askingColdRent}
              unit="€ a month"
              hint="The Kaltmiete from the listing, before heating and service charges. For example 1150 or 1.150,50."
              error={extrasErrors.askingColdRent?.message}
            >
              {(c) => (
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClasses}
                  {...c}
                  {...register("askingColdRent")}
                />
              )}
            </Field>
            <Field
              id={idOf("listingUrl")}
              label={EXTRAS_LABELS.listingUrl}
              hint="The full address, starting with https://"
              error={extrasErrors.listingUrl?.message}
            >
              {(c) => (
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  className={inputClasses}
                  {...c}
                  {...register("listingUrl")}
                />
              )}
            </Field>
          </div>
        </EditorSection>

        <PropertyFields
          form={propertyForm}
          idOf={idOf}
          bezirke={bezirke}
          ortsteile={ortsteile}
          announce={announce}
          renderSection={(group, children) => (
            <EditorSection id={`${id}-section-${group}`} title={SECTIONS.find((s) => s.key === group)?.title ?? group}>
              {children}
            </EditorSection>
          )}
        />

        <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-6">
          <Button type="submit">{kind === "edit" ? "Save changes" : "Add to comparison"}</Button>
          <Button variant="secondary" onClick={close}>
            {kind === "edit" ? "Cancel" : "Close and keep my entries"}
          </Button>
          {kind === "add" ? (
            <p className="type-small text-ink-2">They are kept until you leave the page.</p>
          ) : null}
        </div>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </form>
    </Dialog>
  );
}

function EditorSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-5 border-t border-rule pt-6 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <h3 id={`${id}-title`} className="type-title-3 stretch-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 border-l-4 border-ink-2 bg-paper px-4 py-3 type-small">
      {children}
    </div>
  );
}

