# Design Direction

Status: **Selected: Concept B, "Atlas"**, pending client review · 2026-10-29
Tokens and components: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)

The three concepts differ in **structural metaphor**, not only in palette. Each answers one question: *what is a page in this product?*

---

## Concept A — "Raster" (the facade module)

**Metaphor.** Berlin's industrialised panel housing (WBS 70 and its relatives) is a city built from one repeated module. In this concept a page is a facade, the grid is the panel module, and data is drawn as windows.

- **Structure:** a rigid square module (96 px panel, 8 px joints). Every element snaps to whole panels. Text blocks are panels too.
- **Signature:** the *facade matrix*, 97 windows for the 97 Ortsteile, arranged by Bezirk. Each window lights up by attribute (inside the Ring, selected, compared). Unit charts replace most bar charts.
- **Type:** one heavy grotesk, tight, with very large numerals.
- **Color:** exposed-concrete greys and one renovated-panel pastel (pistachio). The selection is an ink-filled window.

```
┌──────┬──────┬──────┬──────┬──────┬──────┐
│ BERLIN HOUSING        │ ▢▢▢▢ ▢▢▢▢ ▢▢▢▢  │
│ (panel 1–3)           │ ▢▣▢▢ ▢▢▢▢ ▢▢▣▢  │ ← 97 windows
├──────┼──────┼──────┼──┤ ▢▢▢▢ ▢▣▢▢ ▢▢▢▢  │
│ form │ form │ form │  │ …                 │
└──────┴──────┴──────┴──┴──────────────────┘
```

**Risks.** The Plattenbau carries strong social and political associations (East/West, "mass housing"), and they could colour how users read neighborhoods. A rigid module fights long prose and complex forms. Unit charts handle counts well but continuous rent data poorly. And the look sits close to the current brutalist web trend.

## Concept B — "Atlas" (the survey plate)

**Metaphor.** An urban atlas. Each page is a **plate** (Tafel) with a **legend** (Legende) rail that says what you're looking at, in which units, and from which source. The city is drawn from the official survey geometry (ALKIS). The S-Bahn ring, here the official Umweltzone boundary, is the orientation line.

- **Structure:** an asymmetric 12-column grid. The legend rail holds provenance, units, filters and status. The plate holds the map, chart or form. Cartographic devices carry meaning: legend keys, scale notes, source lines and plate frames.
- **Signature:** the **Ring Plate**. The homepage hero is a live drawing of the 97 Ortsteile and the ring, and *inside / straddles / outside the Ring* becomes a real, computed attribute across the product.
- **Provenance as cartographic notation:** every data-bearing plate carries a **legend band**.
  - solid ink = official data
  - 45° hatch = demonstration
  - open dashed outline = not connected

  This turns the brief's honesty requirement into the visual system itself.
- **Type:** Archivo, using its width axis. Expanded widths set plate titles and figures, and condensed widths set map labels and dense tables. Source Serif 4 carries long-form methodology prose.
- **Color:** **Berliner Blau**, Prussian blue, a pigment first made in Berlin in the early 1700s, as ink on cool survey-paper grey. A highlighter yellow is used only as the fill for "what you marked".

```
┌ legend rail ─┬ plate ─────────────────────────────────┐
│ Source       │        ╭──╮                            │
│ Units        │   ╭───╯   ╰──╮   ← Umweltzone ring      │
│ Filters      │  │  97 Ortsteile │                       │
│ ▬ official   │   ╰──╮    ╭──╯                         │
│ ▨ demo       │      ╰──╯                              │
│ ┄ not conn.  │                                        │
└──────────────┴────────────────────────────────────────┘
```

**Risks.**
- A map-centric UI fails keyboard users unless it is paired with synchronized lists. The mitigation is designed in (PRD C4).
- "Editorial/Swiss/atlas" sits next to the broadsheet default: hairlines, zero radius, dense columns. That has to be actively countered (critique below).
- The geodata pipeline means more engineering.

## Concept C — "Grundriss" (the architect's drawing)

**Metaphor.** The apartment as a technical drawing. Each page is a drawing sheet with a **title block** (Schriftfeld) carrying date, source, scale and status. Values are annotated with **dimension lines** (Bemaßung). Validation errors appear as red-pencil revision clouds.

- **Signature:** as the user fills `/analyze`, a schematic **building section** and **plan block** update live: floor 3 of 5, lift shaft, balcony, a footprint proportional to m².
- **Type:** a technical condensed sans with drafting-style numerals.
- **Color:** a white sheet, graphite, light-blue construction lines and one correction red.

```
┌───────────────────────────────────────────┐
│ ├──────── 65 m² ────────┤                 │
│ ┌──────────┬─────┐      ▓ floor 3 / 5      │
│ │  room    │ room│      ▓                  │
│ └──────────┴─────┘      ▓                  │
│                     ┌ title block ───────┐ │
│                     │ source, scale, ver │ │
└─────────────────────┴────────────────────┘
```

**Risks.**
- A schematic floor plan suggests a layout we don't know, which is a quiet form of fabrication.
- The concept is strong at property scale and weak at city scale (`/explore`, `/market`).
- Blueprint/drafting aesthetics drift toward cliché, and toward monospace "technical" labels.

---

## Evaluation

Scores run 1–5, higher is better. Effort is scored inversely, so 5 means the least effort.

| Criterion | A Raster | B Atlas | C Grundriss |
|---|---|---|---|
| Usability (forms, dashboards, long text) | 2: rigid module fights forms and prose | 4: rail + plate fits every route | 3: great for analyze/compare, weak for market |
| Accessibility | 3: unit charts fine, low-contrast pastels risky | 4: needs a list twin for the map (planned) | 3: dimension-line labels get small and dense |
| Relevance to the product question | 3: counts, not prices or places | **5**: rent is about location, and geography is the backbone | 4: property-level relevance |
| Originality | 4 | 4: the provenance notation and the Ring as a real attribute are unusual | 4 |
| Integrity fit (honesty requirements) | 3 | **5**: provenance *is* the legend system | 2: an implied floor plan is invented detail |
| Implementation effort | 4 | 3: geodata pipeline, map | 3: custom drawing system |
| **Total** | 19 | **25** | 19 |

## Decision

**Choose B, "Atlas".** It is the only concept where:
1. the central data (location) is the visual backbone;
2. the hardest requirement, never mistaking demo for real, is solved by the visual language itself rather than by disclaimers; and
3. the signature (the ring) is backed by official data. It is not a decorative logo.

**Borrowed from C, in a limited way:** a *floor-position indicator* in the form. It is a vertical stack of `total_floors` segments with the chosen floor marked, and it shows only what the user typed, so it implies no unknown detail. No floor plans and no dimension-line chrome.

**Not borrowed from A:** the facade matrix. Its counting idea survives only where the data really is a count, as the Bezirk small multiples showing Ortsteil counts.

---

## Critique against generic patterns, and the revisions it produced

Checked against the frontend-design skill's catalog of generated-design defaults, and against the brief's "avoid" list.

| Generic default | Risk in Atlas | Revision |
|---|---|---|
| Cream paper, high-contrast serif display, terracotta accent | Medium: "atlas" invites antique-map cream | Paper is a **cool grey-green survey white `#F3F5F4`**, not cream. The display face is a **sans** (Archivo expanded). The serif is only for prose. The accent is **highlighter yellow**, used only as a selection fill. Brick appears only as chart series 2, never as a brand accent. |
| Near-black + acid accent | Low in light mode; dark mode is navy + yellow | Dark mode is secondary and derived. Yellow stays a fill, never text or glow. |
| Broadsheet: hairlines everywhere, zero radius, dense columns | **High** | Rules exist only where they **encode** something: the legend band (provenance), plate frames (where a figure starts and ends) and table rows. Radius is set by role: plates 0, controls 6 px, filter chips fully round. Prose runs as **one measured column** (≤ 68 ch), never newspaper multi-column. |
| SaaS card kit (identical rounded cards, one shadow) | Medium on home and the tools section | No card grids. Tools are a **ledger list**. Neighborhoods are **map + list**. There are no drop shadows at all: depth comes from paper planes (`paper` vs `sheet`). |
| Template chrome: caps eyebrows, `A · B · C` meta strings, mono data labels, `→` on links | Medium: cartography *does* use spaced caps for area names | **No all-caps anywhere, including map labels** (sentence-case condensed Archivo instead). Metadata goes in the legend rail as definition lists, not dot-joined strings. Figures use Archivo **tabular** numerals, not monospace. Links state their destination in words, with no arrow glyphs. |
| Purple–blue gradient hero, glowing brains, "AI-powered" badges | n/a | No gradients. The word "AI" appears only in the product name and in methodology. |
| Big number with a small label as the hero | Medium: tempting for "97 Ortsteile" | The hero is the plate plus a sentence. Counts appear only where they help navigation. |
| Fade-and-slide-up on every section | Medium | **One** orchestrated moment: the ring line draws once on first load (≤ 900 ms, skipped under reduced motion). Everything else moves only in response to an action. |
| Decorative charts | Low | Every chart module opens with the **question** it answers, and has a table view. |

Remove-one-accessory check: an earlier idea, a running "plate number" (Tafel I, II, III…) on each route, was **cut**. It numbered things that aren't a sequence.

---

## Wireframes

Columns refer to the 12-column grid (DESIGN_SYSTEM §4). Mobile wireframes are 375 px wide.

### `/` desktop (≥ 1024)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Berlin Housing AI        Analyze  Explore  Market  Neighborhoods  Compare  Method │  header (sticky, 64px)
├────────────────────────────────────────────────────────────────────────────────┤
│ c1–c6                              │ c6–c12 (bleeds to viewport edge)           │
│ Read a Berlin flat                 │            ╭─────╮                         │
│ against its city.                  │      ╭────╯ ring ╰────╮   97 Ortsteile     │
│ (Archivo wdth 125, wght 780)       │     │   ░ marked ░     │   official ALKIS   │
│                                    │      ╰────╮      ╭────╯   geometry         │
│ Map the 97 Ortsteile, compare      │            ╰─────╯                         │
│ listings side by side, and prepare │  legend key: ━ Umweltzone (S-Bahn ring)    │
│ an analysis for the rent model in  │              ─ Ortsteil boundary           │
│ development. (Serif, 20/32)        │  Source: ALKIS Berlin, dl-de/zero-2.0      │
│                                    │                                            │
│ ┌ Start an analysis ─────────────┐ │  hover/focus tooltip:                      │
│ │ Bezirk [Mitte ▾] Area [65] m²  │ │   Moabit, Mitte, Ring: {computed}         │
│ │ Rooms [2]   [Continue to form] │ │   (ring status shown = computed value)     │
│ └────────────────────────────────┘ │                                            │
├────────────────────────────────────┴────────────────────────────────────────────┤
│ c1–c3 legend rail      │ c4–c12 Tools ledger                                    │
│ "What each tool        │ Analyze      Describe a flat for the rent model.  ┄ not connected │
│  answers, and what     │ Explore      Find an Ortsteil and what borders it. ▬ official      │
│  backs it"             │ Market       District and period comparisons.     ▨ demo           │
│                        │ Neighborhoods Facts for each of the 97 Ortsteile. ▬ official      │
│                        │ Compare      Up to three listings side by side.   ▬ your entries  │
├────────────────────────┴───────────────────────────────────────────────────────┤
│ Twelve Bezirke (small multiples, real silhouettes, 6×2 grid)                   │
│ [Mitte 6 Ortsteile] [Friedrichshain-Kreuzberg 2] [Pankow 13] …  (counts from    │
│  ALKIS, verified 2026-10-29)                                                    │
├────────────────────────────────────────────────────────────────────────────────┤
│ Explorer preview: cropped plate with one marked Ortsteil + its facts panel      │
│                    (real data), link "Open the explorer"                        │
├────────────────────────────────────────────────────────────────────────────────┤
│ What the data can and can't tell you — ledger of the PRD §3 truth table         │
│ ▬ Live: geometry …   ▨ Demo: market figures …   ┄ Not connected: prediction …   │
├────────────────────────────────────────────────────────────────────────────────┤
│ Footer: sources and licenses, methodology, project status, repository           │
└────────────────────────────────────────────────────────────────────────────────┘
```

### `/` mobile (375)

```
┌─────────────────────────────┐
│ Berlin Housing AI      Menu │
├─────────────────────────────┤
│ Read a Berlin               │
│ flat against                │
│ its city.                   │
│ ╭───── ring plate ─────╮    │  (full-bleed, 4:3, tap = select, list link below)
│ ╰──────────────────────╯    │
│ Source line                 │
│ ┌ Start an analysis ──────┐ │
│ │ Bezirk  [Mitte       ▾] │ │
│ │ Area [65] m² Rooms [2]  │ │
│ │ [Continue to form]      │ │
│ └─────────────────────────┘ │
│ Tools ledger (stacked rows) │
│ Bezirke: 2-col silhouettes  │
│ Data truth ledger           │
└─────────────────────────────┘
```

### `/analyze` desktop

```
┌ rail c1–c4 (sticky) ─────────┬ form sheet c5–c12 ───────────────────────────────┐
│ Your flat                    │ Location                               2 of 3    │
│ Location        2 of 3  ●    │  Bezirk (required)   [Mitte            ▾]        │
│ The flat        1 of 5  ◐    │  Ortsteil            [Moabit           ▾] search │
│ Building        0 of 4  ○    │  Address or landmark (optional, not geocoded)    │
│ Features        0 of 2  ○    │                                                   │
│ Surroundings    0 of 1  ○    │ The flat                               1 of 5    │
│                              │  Property type (required)                        │
│ Required fields: 3 of 4      │   ( Apartment | Maisonette | Penthouse | Loft |… )│
│ [Prepare analysis]           │  Living area (required) [  65 ] m²  10–500        │
│                              │  Rooms (required)       [− 2.5 +] half rooms ok   │
│ ┄ Rent model: not connected  │  Floor [ 2 ] of [ 5 ]  ▥▥▥▣▥ (floor indicator)    │
│   What this means            │ Building, Features, Surroundings (same pattern)   │
└──────────────────────────────┴───────────────────────────────────────────────────┘
After submit (valid) → the sheet's top shows the result plate:
┌ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐
┆ Prediction engine not connected                                                ┆
┆ Your description is valid and ready. The rent model is still being built, so   ┆
┆ no estimate is shown. Nothing was sent anywhere.                                ┆
┆ Summary (definition list): Ortsteil Moabit, Mitte; Type apartment; 65 m²; 2.5 rms ┆
┆ ▸ Show the request the model will receive (JSON)                                ┆
┆ [Add to comparison]  [Open Moabit profile]                                      ┆
└┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘
```
Mobile: the rail collapses into a sticky top progress strip ("Required fields: 3 of 4", with the current section and its count beside it). Sections stack. "Prepare analysis" is sticky at the bottom.

### `/explore` desktop / mobile

```
Desktop
┌ rail c1–c3 ───────────┬ map c4–c12 (full height) ─────────────────┬ panel (slides over c10–c12) ┐
│ Search [moa_______]   │                                            │ Moabit                       │
│ Bezirk [All ▾]        │        MapLibre: Ortsteil polygons,        │ Mitte, Ortsteil 0102         │
│ Ring  (All|In|Partly| │        Bezirk outlines heavier,            │ Area {computed} km²          │
│        Out)           │        ring line in ink                    │ Ring: {computed}             │
│ ───────────────────── │                                            │ Borders: {computed}          │
│ 97 Ortsteile          │                                            │ ▨ Market: demo layer off     │
│ ▸ Adlershof           │                                            │ [Open profile] [Analyze here]│
│ ▸ Alt-Hohenschönhausen│                                            │ [Close]                      │
└───────────────────────┴────────────────────────────────────────────┴──────────────────────────────┘
Mobile
┌─────────────────────┐
│ map (55vh)          │
├─────────────────────┤
│ [List] [Details]    │  bottom sheet, draggable + buttons; not modal
│ list or panel       │
└─────────────────────┘
```

### `/market`

```
┌ rail c1–c3 ─────────────┬ c4–c12 ──────────────────────────────────────────────┐
│ ▨ Demo data             │ How have asking rents moved?  (question as title)    │
│ Not Berlin market       │ ▨▨ band: Demo data, not Berlin market statistics    │
│ statistics. Why?        │ [line chart, ≤4 Bezirke, crosshair tooltip] [Table]  │
│ Bezirke (≤4) [chips]    ├───────────────────────────────────────────────────────┤
│ Period [2019–2025]      │ Which districts cost most per m²? (12 bars, one hue, │
│ Type [Apartment ▾]      │   selected Bezirke marked; sorted)          [Table]  │
│                         ├──────────────────────────┬────────────────────────────┤
│ Method notes            │ How spread are prices?   │ Do property types differ?  │
│                         │ (histogram)              │ (dot plot)                 │
└─────────────────────────┴──────────────────────────┴────────────────────────────┘
```

### `/neighborhoods/[slug]`

```
┌ c1–c7 ───────────────────────────────┬ c8–c12 ───────────────────────┐
│ Moabit  (Archivo wdth 125, huge)     │ locator plate: Mitte outline,  │
│ An Ortsteil of Mitte                 │ Moabit marked, ring line        │
├ facts ledger (official) ─────────────┴───────────────────────────────┤
│ Area {computed} km² | Ring status {computed} ({share}% of area)       │  ← <dl> in UI, not a dot string
│ Ortsteil no. 0102 | Borders: {computed adjacency list}                │
├ ▨ Market (demo) ───────────────┬ ┄ Transit (not connected) ───────────┤
├ Character: pending — sourced notes only ──────────────────────────────┤
├ Nearby: adjacent Ortsteile compared (area, Ring status) ──────────────┤
│ [Analyze a flat in Moabit]  [See Moabit on the map]                   │
└───────────────────────────────────────────────────────────────────────┘
```
(`{computed}` values come from the geodata build. The Ortsteil number 0102 for Moabit is taken from the ALKIS `sch` key.)

### `/compare`

```
Desktop                                         Mobile (rows = attributes, 3 narrow columns)
┌ attribute ─┬ A: Turmstr. ─┬ B: …  ─┬ C: + ─┐  ┌ A ─┬ B ─┬ C ─┐ (sticky header)
│ Ortsteil   │ Moabit       │ Wedding│ Add a  │  │Moab│Wedd│ +  │ Ortsteil
│ Area       │ 65 m²        │ 58 m²  │ prop-  │  │65  │58  │    │ m²
│ Rooms      │ 2.5          │ Missing│ erty   │  │2.5 │ —  │    │ Rooms
│ Asking cold│ 1,150 €      │ 990 €  │        │  …
│ €/m² (from │ 17.69 €      │ 17.07 €│        │
│ your data) │              │        │        │
│ Predicted  │ Model not connected (spans row)│
└────────────┴──────────────┴────────┴────────┘
```
Note: the € values in this wireframe show the shape of user-entered data. They are not market claims.
