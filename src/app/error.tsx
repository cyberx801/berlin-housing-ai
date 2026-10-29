"use client";

import { Button, ButtonLink } from "@/components/ui/Button";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-grid py-16 lg:py-24">
      <div className="col-span-4 flex flex-col gap-6 md:col-span-6 lg:col-span-7" role="alert">
        <h1 className="type-display-2 stretch-wide">This page could not be shown</h1>
        <p className="type-prose text-ink-2">
          Something failed while drawing this page. Your saved entries are kept in your browser and are not
          affected. Try again, or go back to the start.
        </p>
        {error.digest ? <p className="type-small text-ink-3">Reference: {error.digest}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Back to the start
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
