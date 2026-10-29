import type { Metadata } from "next";
import Form from "next/form";
import { Button, ButtonLink } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/Field";
import { QUERY_MAX_LENGTH } from "@/features/neighborhood-explorer/filters";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="page-grid py-16 lg:py-24">
      <div className="col-span-4 flex flex-col gap-6 md:col-span-6 lg:col-span-7">
        <h1 className="type-display-2 stretch-wide">This page is not on the map</h1>
        <p className="type-prose text-ink-2">
          The address may be mistyped, or the page may have moved. Neighborhood pages use the Ortsteil name, for
          example <span className="font-[600] text-ink">/neighborhoods/moabit</span>.
        </p>
        {/* A plain GET form: it works before JavaScript loads, and the directory reads `q`. */}
        <Form action="/neighborhoods" role="search" aria-label="Ortsteile" className="flex max-w-[32rem] flex-col gap-1.5">
          <label htmlFor="not-found-q" className="type-body font-[600]">
            Search the Ortsteile by name
          </label>
          <div className="flex flex-wrap gap-3">
            <input
              id="not-found-q"
              name="q"
              type="search"
              required
              maxLength={QUERY_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className={`${inputClasses} min-w-0 flex-1 basis-56`}
            />
            <Button type="submit" variant="secondary">
              Find Ortsteile
            </Button>
          </div>
        </Form>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/">Back to the start</ButtonLink>
          <ButtonLink href="/neighborhoods" variant="secondary">
            Browse all 97 Ortsteile, A–Z
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
