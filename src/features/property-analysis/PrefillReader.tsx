"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Reports the current query string. Kept apart from the form so only this component sits in
 * the Suspense boundary that `useSearchParams` needs; the form itself stays in the static shell.
 */
export function PrefillReader({ onSearch }: { onSearch: (search: string) => void }) {
  const search = useSearchParams().toString();
  useEffect(() => {
    onSearch(search);
  }, [search, onSearch]);
  return null;
}
