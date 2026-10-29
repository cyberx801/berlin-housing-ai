"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches. `serverValue` is used for the static HTML and during
 * hydration, so pick the value whose markup is safe before JavaScript runs.
 */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Below the `lg` breakpoint (64rem), where the rail and side panels collapse. */
export const NARROW_QUERY = "(width < 64rem)";
