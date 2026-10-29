import { Fragment, type ReactNode } from "react";
import { ProvenanceMark } from "@/components/provenance/ProvenanceMark";
import { formatIsoDate } from "@/lib/formatting/date";
import type { DatasetEntry } from "@/types/registry";

const linkClass = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";

/** The registry as a ledger: one entry per dataset, its facts in a definition list. */
export function DatasetRegistry({ entries }: { entries: readonly DatasetEntry[] }) {
  return (
    <ol className="flex flex-col border-t border-ink">
      {entries.map((entry) => (
        <li key={entry.id} className="border-b border-rule py-5">
          <h3 id={`dataset-${entry.id}`} className="type-title-3">
            {entry.name}
          </h3>
          <p className="mt-1 flex items-center gap-2 type-small font-[620] text-ink">
            <ProvenanceMark kind={entry.mark} className="shrink-0" />
            {entry.status}
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 type-small md:grid-cols-[9rem_minmax(0,1fr)] md:gap-y-2">
            <Row term="Contents">{entry.contents}</Row>
            {entry.publisher ? <Row term="Publisher">{entry.publisher}</Row> : null}
            {entry.service ? (
              <Row term="Service">
                <a href={entry.service} className={`${linkClass} [overflow-wrap:anywhere]`}>
                  <BreakAtSlashes text={entry.service} />
                </a>
              </Row>
            ) : null}
            <Row term="License">
              {entry.license ? (
                <LicenseText license={entry.license} />
              ) : (
                <span className="text-ink-2">Unknown</span>
              )}
            </Row>
            {entry.retrieved ? (
              <Row term="Downloaded">
                <time dateTime={entry.retrieved}>{formatIsoDate(entry.retrieved)}</time>
              </Row>
            ) : null}
            {entry.sha256 ? (
              <Row term="SHA-256 checksum">
                <span className="tabular [overflow-wrap:anywhere]">{entry.sha256}</span>
              </Row>
            ) : null}
            <Row term="Used for">{entry.use}</Row>
            {entry.notes.length > 0 ? (
              <Row term="Notes">
                <ul className="flex flex-col gap-1">
                  {entry.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </Row>
            ) : null}
          </dl>
        </li>
      ))}
    </ol>
  );
}

function LicenseText({ license }: { license: NonNullable<DatasetEntry["license"]> }) {
  // The licence id must not break at its hyphens on narrow screens.
  const text = (
    <>
      {license.name} (<span className="whitespace-nowrap">{license.id}</span>)
    </>
  );
  return license.href ? (
    <a href={license.href} className={linkClass}>
      {text}
    </a>
  ) : (
    text
  );
}

/** A web address that wraps after its slashes before it breaks inside a word. */
function BreakAtSlashes({ text }: { text: string }) {
  const parts = text.split("/");
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? (
        <>
          /<wbr />
        </>
      ) : null}
    </Fragment>
  ));
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-2 font-[620] text-ink md:pt-0">{term}</dt>
      <dd className="max-w-[68ch] min-w-0 text-ink-2">{children}</dd>
    </>
  );
}
