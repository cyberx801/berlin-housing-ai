// Shared by ExploreView and the lazily loaded ExploreMap. Kept apart so importing a type never
// pulls MapLibre into the page's first-load bundle.

export type Bbox = [number, number, number, number];

export type MapTarget = { kind: "berlin" } | { kind: "ortsteil"; code: string } | { kind: "bezirk"; code: string };

/** A camera request. A new `id` moves the camera once; `instant` skips the animation. */
export interface MapView {
  id: number;
  target: MapTarget;
  instant: boolean;
}

/** `lost`: the WebGL context dropped (MapLibre restores it); the plate stands in meanwhile. */
export type MapStatus = "loading" | "ready" | "error" | "unsupported" | "lost";
