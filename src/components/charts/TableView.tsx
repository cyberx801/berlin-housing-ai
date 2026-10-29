import type { ReactNode } from "react";
import { PROVENANCE_COPY } from "@/components/provenance/provenance-copy";
import { Disclosure } from "@/components/ui/Disclosure";
import { cx } from "@/lib/cx";
import type { Provenance } from "@/types/provenance";

export interface TableColumn<Row> {
  key: string;
  header: string;
  /** Numbers align right (DESIGN_SYSTEM §4). */
  numeric?: boolean;
  cell: (row: Row) => ReactNode;
}

interface TableViewProps<Row> {
  /** What the table shows, including its scope; the provenance words are appended. */
  caption: string;
  provenance: Provenance;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** The disclosure label. The first column is the row header. */
  summary?: string;
}

/**
 * The chart's data as a real table, behind a native "Show table" disclosure, so it works
 * before JavaScript and for anyone who can't use the chart (PRD D4).
 */
export function TableView<Row>({ caption, provenance, columns, rows, rowKey, summary = "Show table" }: TableViewProps<Row>) {
  return (
    <Disclosure summary={summary} className="mt-3">
      <div className="max-h-[28rem] overflow-auto border-y border-rule" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full border-collapse type-small">
          <caption className="px-2 py-2 text-left text-ink-2">
            {caption} <span className="font-[620] text-ink">{PROVENANCE_COPY[provenance.kind].label}.</span>
          </caption>
          <thead className="sticky top-0 bg-sheet">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cx(
                    "border-b border-line-strong px-2 py-1.5 type-label font-[650] text-ink",
                    c.numeric ? "text-right" : "text-left",
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-rule last:border-b-0">
                {columns.map((c, i) => {
                  const Cell = i === 0 ? "th" : "td";
                  return (
                    <Cell
                      key={c.key}
                      {...(i === 0 ? { scope: "row" } : {})}
                      className={cx(
                        "px-2 py-1.5 align-top",
                        i === 0 ? "font-[560] text-ink" : "text-ink-2",
                        c.numeric ? "text-right tabular whitespace-nowrap" : "text-left",
                      )}
                    >
                      {c.cell(row)}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Disclosure>
  );
}
