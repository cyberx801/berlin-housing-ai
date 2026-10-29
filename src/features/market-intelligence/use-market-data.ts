"use client";

import { useEffect, useState } from "react";
import type { MarketResponse } from "@/types/market";
import { fetchModule, type ModuleSpec } from "./api";

export type ModuleStatus = "ready" | "loading" | "error";

export interface ModuleData<T> {
  status: ModuleStatus;
  /** The last answer received. While a new one loads it stays on screen, dimmed. */
  response: MarketResponse<T>;
  retry: () => void;
}

/**
 * One module's data for the current filters. The server-rendered answer for the default
 * filters is used as is; any other query is fetched, and a stale request is aborted. Showing
 * a route again re-runs effects, so a query that is already loaded is never fetched twice, and
 * a query that failed stays failed until the reader asks to try again.
 */
export function useMarketData<T>(
  spec: ModuleSpec<T>,
  search: string,
  initial: { search: string; response: MarketResponse<T> },
): ModuleData<T> {
  const [loaded, setLoaded] = useState(initial);
  const [failure, setFailure] = useState<{ search: string; attempt: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadedSearch = loaded.search;
  const failedNow = failure !== null && failure.search === search && failure.attempt === attempt;

  useEffect(() => {
    if (loadedSearch === search || failedNow) return;
    const controller = new AbortController();
    fetchModule(spec, search, controller.signal).then(
      (response) => setLoaded({ search, response }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(`Market module ${spec.path} failed:`, error);
        setFailure({ search, attempt });
      },
    );
    return () => controller.abort();
  }, [spec, search, loadedSearch, attempt, failedNow]);

  return {
    status: loadedSearch === search ? "ready" : failedNow ? "error" : "loading",
    response: loaded.response,
    retry: () => setAttempt((n) => n + 1),
  };
}
