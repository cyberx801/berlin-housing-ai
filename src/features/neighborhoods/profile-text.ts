// Sentences for `/neighborhoods/[slug]`, built only from geometry derivations (DATA_BOUNDARIES §7).
import { formatKm2, formatRingShare } from "@/lib/formatting/number";
import type { ExplorePlace, NeighborhoodProfile } from "@/types/geo";

/**
 * "Mitte", or "the Bezirk Mitte" where the Ortsteil shares its Bezirk's name (Mitte, Pankow,
 * Spandau, Neukölln, Lichtenberg, Reinickendorf), so "an Ortsteil of Mitte" doesn't read as circular.
 */
export function bezirkPhrase(place: Pick<ExplorePlace, "name" | "bezirkName">): string {
  return place.name === place.bezirkName ? `the Bezirk ${place.bezirkName}` : place.bezirkName;
}

/** "inside the S-Bahn ring", "partly inside the S-Bahn ring (34 % of its area)", … */
export function ringPhrase(place: Pick<ExplorePlace, "ringStatus" | "ringShare">): string {
  switch (place.ringStatus) {
    case "inside":
      return "inside the S-Bahn ring";
    case "outside":
      return "outside the S-Bahn ring";
    case "partly":
      return `partly inside the S-Bahn ring (${formatRingShare(place.ringShare)} of its area)`;
  }
}

export function namesList(names: readonly string[]): string {
  return new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format(names);
}

/** The meta description: official facts only, never market values (DATA_BOUNDARIES §5). */
export function profileDescription({ place, neighbors }: NeighborhoodProfile): string {
  const borders =
    neighbors.length === 0
      ? ""
      : ` It borders ${neighbors.length === 1 ? "one Ortsteil" : `${neighbors.length} Ortsteile`}: ${namesList(neighbors.map((n) => n.name))}.`;
  return `${place.name} is an Ortsteil of ${bezirkPhrase(place)}, ${formatKm2(place.areaKm2)} in area and ${ringPhrase(place)}.${borders} From the official ALKIS boundaries.`;
}
