/**
 * The sections of /methodology, in page order: the PRD §3 rows in their order, then limitations
 * and the dataset registry. Links across the site point at these ids,
 * and a unit test fails on any `/methodology#…` link that isn't listed here (D-052).
 * `sources`, `census-rent`, `your-data`, `market-data`, `predictions`, `in-development`, `neighborhood-content`
 * and `ring` are fixed by the provenance bands and page links; don't rename them.
 */
export interface MethodologySection {
  id: string;
  title: string;
  children?: readonly { id: string; title: string }[];
}

export const METHODOLOGY_SECTIONS = [
  { id: "what-works", title: "What works today" },
  {
    id: "geodata",
    title: "Geography: official data",
    children: [
      { id: "areas", title: "Areas" },
      { id: "ring", title: "Ring status" },
      { id: "adjacency", title: "Neighbors" },
      { id: "drawing", title: "Simplified drawing, full-detail facts" },
    ],
  },
  { id: "census-rent", title: "Rents in 2022: official census data" },
  {
    id: "market-data",
    title: "Market figures: demo data",
    children: [{ id: "market-vs-predictions", title: "Market figures and predictions" }],
  },
  { id: "research-data", title: "The Kaggle dataset: synthetic, demo only" },
  {
    id: "in-development",
    title: "In development",
    children: [
      { id: "predictions", title: "The rent model" },
      { id: "model-comparison", title: "What was compared" },
      { id: "uncertainty", title: "Why an estimate carries uncertainty" },
      { id: "transit", title: "Transit access" },
    ],
  },
  { id: "your-data", title: "Your entries" },
  { id: "neighborhood-content", title: "Neighborhood descriptions: not written yet" },
  { id: "limitations", title: "Known limitations" },
  { id: "sources", title: "Data sources and licenses" },
] as const satisfies readonly MethodologySection[];

type Section = (typeof METHODOLOGY_SECTIONS)[number];
type Child = Section extends infer S ? (S extends { children: readonly (infer C)[] } ? C : never) : never;
export type MethodologyId = Section["id"] | Child["id"];

export const METHODOLOGY_IDS: readonly MethodologyId[] = METHODOLOGY_SECTIONS.flatMap((s) => [
  s.id,
  ...("children" in s ? s.children.map((c) => c.id) : []),
]);

const titles = new Map<string, string>(
  METHODOLOGY_SECTIONS.flatMap((s) => [[s.id, s.title] as const, ...("children" in s ? s.children.map((c) => [c.id, c.title] as const) : [])]),
);

export function sectionTitle(id: MethodologyId): string {
  return titles.get(id)!;
}
