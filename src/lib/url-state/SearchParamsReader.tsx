"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Reports the current query string. Render it inside `<Suspense fallback={null}>`: only this
 * component then waits for the URL, and the page around it stays in the static shell (D-027).
 * The effect also runs when a hidden route is shown again, so `onSearch` must be idempotent.
 */
export function SearchParamsReader({ onSearch }: { onSearch: (search: string) => void }) {
  const search = useSearchParams().toString();
  useEffect(() => {
    onSearch(search);
  }, [search, onSearch]);
  return null;
}
