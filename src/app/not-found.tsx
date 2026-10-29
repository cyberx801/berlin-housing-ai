import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="page-grid py-16 lg:py-24">
      <div className="col-span-4 flex flex-col gap-6 md:col-span-6 lg:col-span-7">
        <p className="type-label text-ink-2">404</p>
        <h1 className="type-display-2 stretch-wide">This page is not on the map</h1>
        <p className="type-prose text-ink-2">
          The address may be mistyped, or the page may have moved. Neighborhood pages use the Ortsteil name, for
          example <span className="font-[600] text-ink">/neighborhoods/moabit</span>.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/">Back to the start</ButtonLink>
          <ButtonLink href="/neighborhoods" variant="secondary">
            Browse all 97 Ortsteile
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
