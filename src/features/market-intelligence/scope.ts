// The sentence each module prints under its title, so the scope of every chart is explicit
// and the modules never silently disagree with the filters (D-040).
import type { MarketPeriod, MarketType, MarketTypeFilter } from "@/types/market";

const TYPE_PLURALS: Record<MarketType, string> = {
  apartment: "apartments",
  maisonette: "maisonettes",
  penthouse: "penthouses",
  loft: "lofts",
  house: "houses",
};

const list = new Intl.ListFormat("en-GB", { type: "conjunction" });

export function typePlural(type: MarketTypeFilter): string {
  return type === "all" ? "all property types" : TYPE_PLURALS[type];
}

export function periodText({ from, to }: MarketPeriod): string {
  return from === to ? String(from) : `${from} to ${to}`;
}

export function namesText(names: readonly string[]): string {
  return list.format(names);
}

/** "All of Berlin", "Mitte", "Mitte and Pankow combined". */
export function areaText(names: readonly string[], combined: boolean): string {
  if (names.length === 0) return "All of Berlin";
  return combined && names.length > 1 ? `${namesText(names)} combined` : namesText(names);
}

interface ScopeInput extends MarketPeriod {
  names: readonly string[];
  type: MarketTypeFilter;
}

export function trendScope(s: ScopeInput): string {
  return `${areaText(s.names, false)}, ${typePlural(s.type)}, ${periodText(s)}.`;
}

export function districtScope(s: ScopeInput): string {
  const chosen = s.names.length > 0 ? " Your chosen Bezirke are outlined." : "";
  return `All 12 Bezirke, ${typePlural(s.type)}, ${periodText(s)}.${chosen}`;
}

export function distributionScope(s: ScopeInput): string {
  return `${areaText(s.names, true)}, ${typePlural(s.type)}, ${periodText(s)}.`;
}

export function typesScope(s: ScopeInput): string {
  const outlined = s.type === "all" ? "" : `, with ${TYPE_PLURALS[s.type]} outlined`;
  return `${areaText(s.names, true)}, ${periodText(s)}. Every property type is shown${outlined}.`;
}

/** What the live region says once every module has its answer. */
export function summaryText(s: ScopeInput): string {
  const area = s.names.length === 0 ? "all of Berlin" : namesText(s.names);
  return `Charts show ${area}, ${typePlural(s.type)}, ${periodText(s)}.`;
}
