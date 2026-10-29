"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { ProvenanceMark } from "@/components/provenance/ProvenanceMark";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";
import { ATTRIBUTE_ROWS, DETAIL_ROWS, formatRent, formatRentPerM2, listingHost, type PlaceNames } from "./rows";
import type { CompareItem } from "./store";

const linkClass = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";

export const columnId = (prefix: string, id: string) => `${prefix}-col-${id}`;
export const rentButtonId = (prefix: string, item: CompareItem) => `${prefix}-rent-${item.id}`;

interface CompareTableProps {
  idPrefix: string;
  items: readonly CompareItem[];
  names: PlaceNames;
  onEdit: (item: CompareItem, focus?: "askingColdRent") => void;
  onRemove: (item: CompareItem) => void;
}

function Missing({ children = "Missing" }: { children?: ReactNode }) {
  return <span className="text-ink-3">{children}</span>;
}

/**
 * One table, attributes as rows and properties as columns (PRD F2, F5). From md the attribute
 * names are row headers; below md they move to a label row above each value row, so three
 * properties keep a third of the width each. Only `display` changes between the two: every value
 * cell names its headers explicitly, so both arrangements read the same to assistive tech.
 */
export function CompareTable({ idPrefix, items, names, onEdit, onRemove }: CompareTableProps) {
  const span = items.length;
  const cols = items.map((item) => columnId(idPrefix, item.id));

  function attributeRow(key: string, label: ReactNode, cells: (item: CompareItem) => ReactNode, groupStart = false) {
    const rowId = `${idPrefix}-row-${key}`;
    const labelId = `${rowId}-label`;
    const border = groupStart ? "border-t-2 border-ink-2" : "border-t border-rule";
    return (
      <Fragment key={key}>
        <tr className="md:hidden">
          <th id={labelId} colSpan={span} className={cx(border, "px-2 pt-2.5 text-left type-small font-[620] text-ink-2")}>
            {label}
          </th>
        </tr>
        <tr>
          <th
            id={rowId}
            scope="row"
            className={cx(border, "hidden py-2.5 pr-4 text-left align-baseline type-small font-[620] text-ink-2 md:table-cell")}
          >
            {label}
          </th>
          {items.map((item, i) => (
            <td
              key={item.id}
              headers={`${cols[i]} ${rowId} ${labelId}`}
              className={cx(
                "px-2 pt-1 pb-2.5 align-baseline break-words hyphens-auto md:py-2.5 md:pr-4 md:pl-0",
                groupStart ? "md:border-t-2 md:border-ink-2" : "md:border-t md:border-rule",
              )}
            >
              {cells(item)}
            </td>
          ))}
        </tr>
      </Fragment>
    );
  }

  const plain = (rows: typeof ATTRIBUTE_ROWS) =>
    rows.map((row, index) =>
      attributeRow(
        row.key,
        row.label,
        (item) => {
          const value = row.value(item, names);
          return value === null ? <Missing /> : <span lang={row.key === "ortsteil" || row.key === "bezirk" ? "de" : undefined}>{value}</span>;
        },
        index === 0,
      ),
    );

  return (
    <table data-sticky-thead className="w-full table-fixed border-separate border-spacing-0">
      <caption className="sr-only">
        {span === 1 ? "One property" : `${span} properties`} side by side. Each column is a property, each row one of its details.
      </caption>
      <colgroup>
        <col className="hidden md:table-column md:w-[11rem] lg:w-[12rem]" />
        {items.map((item) => (
          <col key={item.id} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {/* Sticks with the names so the row headers scroll under it, not beside them. */}
          <td className="sticky top-[var(--header-height)] z-10 hidden bg-sheet md:table-cell" />
          {items.map((item, i) => (
            <th
              key={item.id}
              id={cols[i]}
              scope="col"
              tabIndex={-1}
              className="sticky top-[var(--header-height)] z-10 border-b-2 border-ink bg-sheet px-2 pt-2 pb-2.5 text-left align-bottom md:pr-4 md:pl-0"
            >
              <span className="line-clamp-3 type-body font-[650] break-words text-ink stretch-condensed md:stretch-wide">
                {item.label}
              </span>
            </th>
          ))}
        </tr>
        <tr>
          <td className="hidden md:table-cell" />
          {items.map((item, i) => (
            <td key={item.id} headers={cols[i]} className="px-2 pt-2 pb-3 align-top md:pr-4 md:pl-0">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Button variant="quiet" onClick={() => onEdit(item)} aria-label={`Edit ${item.label}`}>
                  Edit
                </Button>
                <Button variant="quiet" onClick={() => onRemove(item)} aria-label={`Remove ${item.label}`}>
                  Remove
                </Button>
              </div>
            </td>
          ))}
        </tr>
      </thead>
      <tbody className="type-small md:type-body">
        {plain(ATTRIBUTE_ROWS)}
        {attributeRow(
          "askingColdRent",
          "Asking cold rent",
          (item) =>
            item.askingColdRent === null ? (
              <div className="flex flex-col items-start gap-1">
                <Missing />
                <Button
                  id={rentButtonId(idPrefix, item)}
                  variant="quiet"
                  className="text-left hyphens-manual"
                  onClick={() => onEdit(item, "askingColdRent")}
                  aria-label={`Add the asking rent for ${item.label}`}
                >
                  Add the asking rent
                </Button>
              </div>
            ) : (
              <span className="font-[620]">
                {formatRent(item.askingColdRent)}
                <span className="font-[450] text-ink-2"> a month</span>
              </span>
            ),
          true,
        )}
        {attributeRow(
          "rentPerM2",
          <>
            €/m² <span className="font-[450]">from your entries</span>
          </>,
          (item) => formatRentPerM2(item) ?? <Missing>Needs the asking rent</Missing>,
        )}
        <Fragment key="predicted">
          <tr className="md:hidden">
            <th
              id={`${idPrefix}-row-predicted-label`}
              colSpan={span}
              className="border-t border-rule px-2 pt-2.5 text-left type-small font-[620] text-ink-2"
            >
              Predicted rent
            </th>
          </tr>
          <tr>
            <th
              id={`${idPrefix}-row-predicted`}
              scope="row"
              className="hidden border-t border-rule py-2.5 pr-4 text-left align-baseline type-small font-[620] text-ink-2 md:table-cell"
            >
              Predicted rent
            </th>
            <td
              colSpan={span}
              headers={`${cols.join(" ")} ${idPrefix}-row-predicted ${idPrefix}-row-predicted-label`}
              className="px-2 pt-1 pb-2.5 align-baseline md:border-t md:border-rule md:py-2.5 md:pl-0"
            >
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-2 font-[620] text-ink">
                  <ProvenanceMark kind="not-connected" className="shrink-0" />
                  Model not connected
                </span>
                <Link href="/methodology#in-development" className={cx(linkClass, "type-small text-ink-2")}>
                  What this means
                </Link>
              </span>
            </td>
          </tr>
        </Fragment>
        {plain(DETAIL_ROWS)}
        {attributeRow(
          "address",
          "Your note",
          (item) => (item.property.address ? item.property.address : <Missing>No note</Missing>),
          true,
        )}
        {attributeRow("listing", "Listing", (item) =>
          item.listingUrl ? (
            <a href={item.listingUrl} target="_blank" rel="noreferrer" className={cx(linkClass, "[overflow-wrap:anywhere]")}>
              {listingHost(item.listingUrl)} <span className="whitespace-nowrap text-ink-2">(new tab)</span>
            </a>
          ) : (
            <Missing>No link</Missing>
          ),
        )}
      </tbody>
    </table>
  );
}
