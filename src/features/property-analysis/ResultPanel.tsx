"use client";

import { CircleAlert, Unplug } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProvenanceLabel } from "@/components/provenance/ProvenanceLabel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { defaultCompareLabel } from "@/features/property-comparison/rows";
import { addCompareItem, MAX_COMPARE_ITEMS, useCompareSnapshot } from "@/features/property-comparison/store";
import type { RentEstimateOutcome } from "@/lib/api/prediction/types";
import type { RentPredictionRequestV1, RentPredictionResponseV1 } from "@/lib/contracts/rent-prediction.v1";
import { cx } from "@/lib/cx";
import { formatIsoDate } from "@/lib/formatting/date";
import { formatEUR, formatEURPerM2, formatPercent, formatSignedPercentPoints } from "@/lib/formatting/number";
import type { PropertyInput } from "@/lib/validation/property";
import { FIELD_LABELS, formFieldForWire } from "./fields";
import { InputSummary, type ResultPlace } from "./InputSummary";

interface ResultPanelProps {
  id: string;
  outcome: RentEstimateOutcome;
  input: PropertyInput;
  payload: RentPredictionRequestV1;
  place: ResultPlace;
  /** The form changed after this result was prepared. */
  stale?: boolean;
  onRetry?: () => void;
}

// The model's precision is not to the euro, so neither is the display. The range is widened,
// never narrowed, by the rounding.
const nearest10 = (v: number) => Math.round(v / 10) * 10;
const down10 = (v: number) => Math.floor(v / 10) * 10;
const up10 = (v: number) => Math.ceil(v / 10) * 10;

const linkClass = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";

const wireLabel = (field: string) => {
  const formField = formFieldForWire(field);
  return formField ? FIELD_LABELS[formField] : field;
};

/** Every outcome of PropertyAnalysisService.estimateRent(), designed (PREDICTION_API §7). */
export function ResultPanel({ id, outcome, input, payload, place, stale = false, onRetry }: ResultPanelProps) {
  const titleId = `${id}-title`;
  // Focus the heading once per result. Hidden routes re-run effects when shown again, so the
  // ref remembers that it already happened.
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current) return;
    focused.current = true;
    document.getElementById(titleId)?.focus();
  }, [titleId]);

  const status = outcome.status;
  const sent = status === "ok" || status === "rejected" || status === "unavailable" || status === "invalid_input";
  const titleClass = "flex items-start gap-2.5 type-title-2 stretch-wide";

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cx(
        "flex flex-col gap-4 bg-sheet p-5 md:p-6",
        status === "not_connected" && "frame-not-connected",
        status === "ok" && outcome.trainedOn === "observed" && "border-t-[3px] border-ink",
        (status === "rejected" || status === "unavailable" || status === "invalid_input") &&
          "border-l-4 border-critical",
      )}
    >
      {status === "ok" && outcome.trainedOn === "synthetic" ? (
        <div aria-hidden="true" className="band-hatch -mx-5 -mt-5 h-3 border-b border-line-strong md:-mx-6 md:-mt-6" />
      ) : null}
      {status === "not_connected" ? (
        <>
          <ProvenanceLabel provenance={{ kind: "not-connected", missing: "Rent prediction model" }} />
          <h2 id={titleId} tabIndex={-1} className={titleClass}>
            <Unplug aria-hidden="true" className="mt-1.5 size-5 shrink-0 text-ink-2" />
            <span>Prediction engine not connected</span>
          </h2>
          <p className="max-w-[68ch] text-ink-2">
            {outcome.reason === "disabled"
              ? "Your description is valid and ready. The rent model is still being built, so no estimate is shown. Nothing was sent anywhere."
              : outcome.reason === "unverified_data"
                ? "Your description is valid and ready. A model answered, but it did not say that it was trained on synthetic data, which is the only kind this site can label, so no estimate is shown."
                : "Your description is valid and ready. This site's server accepted it, but no rent model is configured behind it yet, so no estimate is shown."}
          </p>
        </>
      ) : status === "ok" ? (
        <EstimateView data={outcome.data} trainedOn={outcome.trainedOn} titleId={titleId} titleClass={titleClass} />
      ) : (
        <>
          <h2 id={titleId} tabIndex={-1} className={titleClass}>
            <CircleAlert aria-hidden="true" className="mt-1.5 size-5 shrink-0 text-critical" />
            <span>
              {status === "rejected"
                ? "This flat is outside what the model covers"
                : status === "unavailable"
                  ? "No estimate right now"
                  : "The model could not use some values"}
            </span>
          </h2>
          {status === "invalid_input" ? (
            <>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {outcome.issues.map((issue, i) => (
                  <li key={`${issue.field}-${i}`}>
                    {wireLabel(issue.field)}: {issue.issue}
                  </li>
                ))}
              </ul>
              <p className="text-ink-2">Correct them in the form and prepare the analysis again.</p>
            </>
          ) : status === "rejected" ? (
            <>
              <p className="max-w-[68ch]">{outcome.message}</p>
              <p className="max-w-[68ch] text-ink-2">
                No estimate is shown for it. Your description is still valid, and you can add it to the comparison.
              </p>
            </>
          ) : (
            <>
              <p className="max-w-[68ch]">{outcome.message}</p>
              {outcome.retryAfterMs !== undefined ? (
                <p className="text-ink-2">
                  The service asked to wait {Math.ceil(outcome.retryAfterMs / 1000)} seconds before trying again.
                </p>
              ) : null}
              {outcome.retryable && onRetry ? (
                <div>
                  <Button variant="secondary" onClick={onRetry}>
                    Try again
                  </Button>
                </div>
              ) : (
                <p className="text-ink-2">Trying again right away is unlikely to help.</p>
              )}
              <p className="type-small text-ink-3">
                Reference {outcome.requestId}, code {outcome.code}
              </p>
            </>
          )}
        </>
      )}

      {stale ? (
        <p className="border-l-4 border-ink-2 pl-3 type-small font-[560] text-ink">
          You changed the form after preparing this. Prepare the analysis again to update it.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-rule pt-4">
        <h3 className="type-body font-[620]">What you entered</h3>
        <InputSummary input={input} place={place} />
      </div>

      <Disclosure
        summary={sent ? "Show the request that was sent (JSON)" : "Show the request the model will receive (JSON)"}
      >
        <pre className="border border-rule bg-paper p-3 font-mono text-[0.8125rem] leading-relaxed break-words whitespace-pre-wrap">
          <code>{JSON.stringify(payload, null, 2)}</code>
        </pre>
      </Disclosure>

      {status === "invalid_input" ? null : <Actions input={input} place={place} />}
    </section>
  );
}

/** Fixed wording for a model trained on synthetic data (D-058). Never reworded. */
export const DEMO_MODEL_NOTICE = "Demo model, trained on synthetic data. Not a Berlin market estimate.";

const FACTOR_LABELS: Record<string, string> = {
  location: "Location (Ortsteil)",
  market_period: "Market period",
};
const factorLabel = (feature: string) => FACTOR_LABELS[feature] ?? wireLabel(feature);

function EstimateView({
  data,
  trainedOn,
  titleId,
  titleClass,
}: {
  data: RentPredictionResponseV1;
  trainedOn: "observed" | "synthetic";
  titleId: string;
  titleClass: string;
}) {
  const { estimate, model, inputs, warnings, explanation } = data;
  const demo = trainedOn === "synthetic";
  const filledIn = [...new Set([...inputs.missing, ...inputs.imputed.map((i) => i.field)])];
  const ignored = inputs.ignored ?? [];
  const period = model.training_data?.reference_period;

  return (
    <>
      <ProvenanceLabel
        provenance={{
          kind: "model",
          modelVersion: `${model.name} ${model.version}`,
          dataReferenceDate: formatIsoDate(data.data_reference_date),
          trainedOn,
        }}
      />
      <h2 id={titleId} tabIndex={-1} className={titleClass}>
        {demo ? "Demo estimate of the cold rent" : "Estimated cold rent"}
      </h2>
      {demo ? <p className="border-l-4 border-ink pl-3 font-[620]">{DEMO_MODEL_NOTICE}</p> : null}
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="type-figure">{formatEUR(nearest10(estimate.monthly_cold_rent.value))}</span>
        <span className="text-ink-2">per month, before heating and service charges</span>
      </p>
      {estimate.interval ? (
        <p>
          Range at the {formatPercent(estimate.interval.level)} level:{" "}
          <strong className="font-[620]">
            {formatEUR(down10(estimate.interval.lower))} to {formatEUR(up10(estimate.interval.upper))}
          </strong>
          .{" "}
          <Link href="/methodology#predictions" className={linkClass}>
            How to read this range
          </Link>
        </p>
      ) : (
        <p>No uncertainty range available.</p>
      )}
      {estimate.rent_per_m2 ? (
        <p className="text-ink-2">{formatEURPerM2(estimate.rent_per_m2.value)} of living area</p>
      ) : null}
      <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-1.5 type-small md:max-w-[36rem]">
        <div className="contents">
          <dt className="text-ink-2">Model</dt>
          <dd className="font-[560]">
            {model.name} {model.version}
          </dd>
        </div>
        {model.trained_at ? (
          <div className="contents">
            <dt className="text-ink-2">Trained</dt>
            <dd className="font-[560]">{formatIsoDate(model.trained_at)}</dd>
          </div>
        ) : null}
        <div className="contents">
          <dt className="text-ink-2">Reflects data up to</dt>
          <dd className="font-[560]">{formatIsoDate(data.data_reference_date)}</dd>
        </div>
        {model.training_data ? (
          <div className="contents">
            <dt className="text-ink-2">Training data</dt>
            <dd className="font-[560]">
              {model.training_data.source_id}
              {model.training_data.synthetic ? " (synthetic)" : ""}
              {period ? `, ${formatIsoDate(period.start)} to ${formatIsoDate(period.end)}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>
      {filledIn.length > 0 ? (
        <p className="max-w-[68ch] text-ink-2">
          Not given, so the model filled them in: {filledIn.map(wireLabel).join(", ")}.
        </p>
      ) : null}
      {ignored.length > 0 ? (
        <p className="max-w-[68ch] text-ink-2">
          Sent, but this model does not use them: {ignored.map(wireLabel).join(", ")}.
        </p>
      ) : null}
      {explanation && explanation.factors.length > 0 ? (
        <Disclosure summary="What moved the estimate">
          <p className="max-w-[68ch] text-ink-2">
            Effect of each factor on the rent per m² against the average listing the model was trained on (
            {formatEURPerM2(explanation.baseline_rent_per_m2)}). It describes this model, not Berlin.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {explanation.factors.map((f) => (
              <li key={f.feature} className="flex flex-wrap justify-between gap-x-6 md:max-w-[28rem]">
                <span>{factorLabel(f.feature)}</span>
                <span className="font-[560]">{formatSignedPercentPoints(f.effect_pct)}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
      {warnings.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="type-body font-[620]">Notes from the model</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

type CompareStatus = "idle" | "added" | "full";

function Actions({ input, place }: { input: PropertyInput; place: ResultPlace }) {
  const { items, persisted } = useCompareSnapshot();
  const [status, setStatus] = useState<CompareStatus>("idle");

  function add() {
    if (status === "added") return;
    const result = addCompareItem({
      label: defaultCompareLabel(place.ortsteilName ?? place.bezirkName, input.areaM2),
      property: input,
      askingColdRent: null,
      listingUrl: null,
      source: "analysis",
    });
    setStatus(result.ok ? "added" : "full");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={add} aria-disabled={status === "added" ? true : undefined}>
          {status === "added" ? "Added to comparison" : "Add to comparison"}
        </Button>
        <ButtonLink
          variant="secondary"
          href={place.ortsteilSlug ? `/neighborhoods/${place.ortsteilSlug}` : `/neighborhoods?bezirk=${place.bezirkSlug}`}
        >
          {place.ortsteilName ? `Open the ${place.ortsteilName} profile` : `Browse Ortsteile in ${place.bezirkName}`}
        </ButtonLink>
      </div>
      {/* Always rendered so the status is announced when its text appears. */}
      <p role="status" className="type-small text-ink-2">
        {status === "added" ? (
          <>
            {persisted
              ? `Saved in this browser, ${items.length} of ${MAX_COMPARE_ITEMS} places used. `
              : "This browser blocks storage, so the comparison lasts only until you leave the page. "}
            <Link href="/compare" className={linkClass}>
              Open the comparison
            </Link>
          </>
        ) : status === "full" ? (
          <>
            The comparison already holds {MAX_COMPARE_ITEMS} properties.{" "}
            <Link href="/compare" className={linkClass}>
              Remove one in the comparison
            </Link>
            , then add this one.
          </>
        ) : null}
      </p>
    </div>
  );
}
