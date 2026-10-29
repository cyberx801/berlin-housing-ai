# Design System — "Atlas"

Status: v0.1 · 2026-10-29 · Direction: [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md)
Enforced by the project skill [`design-system`](../../.claude/skills/design-system/SKILL.md).

All contrast ratios below were **computed** on 2026-10-29 with the dataviz skill's `contrast()` (WCAG 2.x relative luminance). They were not estimated. Categorical chart palettes were validated with `validate_palette.js`; results are in §8.

Tokens are implemented as CSS custom properties in `src/styles/tokens.css` and exposed to Tailwind v4 through `@theme`. Components use **role tokens only**. Raw hex values in components are a review failure.

---

## 1. Principles

1. **Legend before figure.** Every plate says what it shows, in which units and from which source *before* the user has to interpret it. The legend rail is structure, not decoration.
2. **Provenance is notation.** Official, demo and not-connected each have a fixed visual mark (§7), always paired with words.
3. **One bold thing per screen.** On `/` it's the Ring Plate. On other routes it's the plate itself. Everything else stays quiet.
4. **Ink, not glow.** Depth comes from paper planes and ink weight. No shadows, gradients, blur or glass.
5. **Motion answers actions.** The one exception is the ring drawing in on first load of `/`.

## 2. Color

### 2.1 Base palette

| Name | Hex | Role |
|---|---|---|
| Berliner Blau (ink) | `#003153` | Primary text, ring line, primary buttons, focus ring |
| Survey paper | `#F3F5F4` | Page plane |
| Sheet | `#FBFCFB` | Raised plane: plates, form sheet, chart surface |
| Slate ink | `#3D5468` | Secondary text |
| Survey grey | `#5D6F7F` | Muted text (captions, axis labels) |
| Line strong | `#6B7C8A` | Field borders, Ortsteil boundaries, hatch strokes |
| Rule | `#D3DADE` | Decorative separators only (never the sole state cue) |
| Marker | `#F2D43A` | Selection/marked **fill only**. Never text, never alone. |

### 2.2 Role tokens (light, the primary identity)

| Token | Value | Computed contrast | Use |
|---|---|---|---|
| `--color-paper` | `#F3F5F4` | — | page background |
| `--color-sheet` | `#FBFCFB` | 1.06 vs paper | plates, panels, chart surface |
| `--color-ink` | `#003153` | 12.26 on paper / 13.05 on sheet | body text, headings, ring |
| `--color-ink-2` | `#3D5468` | 7.19 paper / 7.66 sheet | secondary text |
| `--color-ink-3` | `#5D6F7F` | 4.74 paper / 5.05 sheet | captions, axis ticks (≥ 13 px) |
| `--color-line-strong` | `#6B7C8A` | 3.93 paper / 4.19 sheet | input borders, map boundaries (≥ 3:1 for UI and graphics) |
| `--color-rule` | `#D3DADE` | 1.29 (decorative) | separators that carry no state |
| `--color-marker` | `#F2D43A` | ink on marker 9.11; marker vs paper 1.35 | selection fill, always with an ink outline (2 px) and a text state |
| `--color-on-ink` | `#FBFCFB` | 13.05 on ink | text on primary buttons |
| `--color-ink-hover` | `#0A456E` | white text 9.77 | primary button hover |
| `--color-critical` | `#B3261E` | 6.36 sheet | errors (with icon + text) |
| `--color-warning-ink` | `#7A5200` | 6.32 paper | warnings text (with icon) |
| `--color-success-ink` | `#1E6B3A` | 5.96 paper | confirmations (with icon) |
| `--color-focus` | `#003153` | 12.26 | focus ring (§9) |

### 2.3 Dark mode (secondary; shipped in slice 9 only if it passes the same checks)

| Token | Value | Contrast |
|---|---|---|
| `--color-paper` | `#08131F` | — |
| `--color-sheet` | `#0C1A29` | — (chart surface) |
| `--color-ink` | `#E6ECEF` | 14.73 on sheet / 15.68 on paper |
| `--color-ink-2` | `#A9B8C4` | 8.65 on sheet |
| `--color-ink-3` | `#8396A6` | 5.75 sheet / 6.12 paper |
| `--color-line-strong` | `#7D90A1` | 5.33 |
| `--color-marker` | `#F2D43A` | 11.92 (it may appear as a stroke in dark mode) |
| `--color-critical` | `#FF8A7A` | 7.67 |
| `--color-warning-ink` | `#F0B85A` | 9.79 |
| `--color-success-ink` | `#6FCF8F` | 9.20 |
| `--color-focus` | `#F2D43A` | 11.92 |

Implement it with `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, plus a `:root[data-theme="dark"]` scope. If dark mode isn't fully QA'd, ship `color-scheme: light` only. A half-finished dark mode is worse than none.

## 3. Typography

### 3.1 Families
| Family | License | Axes used | Role |
|---|---|---|---|
| **Archivo** (variable) | OFL 1.1 | `wdth` 62–125, `wght` 100–900 (axes verified on Google Fonts on 2026-10-29) | Everything in the UI: display, headings, controls, tables, map labels |
| **Source Serif 4** (variable) | OFL 1.1 | `opsz` 8–60, `wght` 200–900 | Long-form prose only: hero sub-copy, methodology, neighborhood notes |

The fonts are self-hosted through `next/font/google`, which downloads them at build time, so no runtime requests go to Google. `font-display: swap`. Fallbacks: `"Archivo", "Arial Narrow", Arial, sans-serif` and `"Source Serif 4", Georgia, serif`.

**The width axis is the typographic signature.** Expanded (`wdth` 112–125) is monumental and horizontal, like Berlin's post-war facade lettering, and is used for titles and figures. Condensed (`wdth` 68–80) is dense and cartographic, and is used for map labels and table headers. Body text stays at `wdth` 100.

### 3.2 Scale

Major third (1.25) for UI text, with fluid display sizes. Sizes are in rem at 16 px.

| Token | Size | Line height | Family / axes | Use |
|---|---|---|---|---|
| `display-1` | `clamp(2.75rem, 1.6rem + 5.2vw, 6.5rem)` | 0.95 | Archivo wdth 125, wght 780, tracking −0.02em | Home hero, neighborhood name |
| `display-2` | `clamp(2rem, 1.4rem + 2.6vw, 3.5rem)` | 1.0 | Archivo wdth 115, wght 720 | Route titles |
| `title-1` | 1.953rem | 1.1 | Archivo wdth 110, wght 680 | Plate titles (the question a module answers) |
| `title-2` | 1.563rem | 1.2 | Archivo wdth 100, wght 640 | Section headings, form groups |
| `title-3` | 1.25rem | 1.3 | Archivo wdth 100, wght 600 | Sub-sections, panel headings |
| `body` | 1rem | 1.55 | Archivo wdth 100, wght 420 | UI text |
| `prose` | 1.125rem | 1.65 | Source Serif 4 opsz auto, wght 400 | Long text, ≤ 68 ch |
| `small` | 0.875rem | 1.45 | Archivo wdth 100, wght 450 | Hints, legend text |
| `label-condensed` | 0.8125rem | 1.3 | Archivo wdth 75, wght 560 | Map labels, table headers. **Sentence case.** |
| `figure-l` | 2.441rem | 1.0 | Archivo wdth 118, wght 650, `tabular-nums` only in columns | User-entered prices, areas |

Rules:
- No all-caps anywhere, including map labels.
- Don't emphasize a single word in headlines.
- No eyebrow labels above headings.
- Figures in tables and on axes use `font-variant-numeric: tabular-nums`. Standalone figures use proportional numerals.
- Units are set in `small` next to the value, with a narrow no-break space (`65 m²`, `1,150 €`). See `lib/formatting`.

## 4. Grid and layout

| Breakpoint | Range | Columns | Margin | Gutter | Legend rail |
|---|---|---|---|---|---|
| `sm` | < 640 | 4 | 16 px | 16 px | becomes a disclosure ("Legend and sources") above the plate |
| `md` | 640–1023 | 8 | 24 px | 20 px | becomes a horizontal strip above the plate |
| `lg` | 1024–1439 | 12 | 32 px | 24 px | columns 1–3, sticky |
| `xl` | ≥ 1440 | 12 (max 1440 content) | auto | 24 px | columns 1–3, sticky |

- **Asymmetry:** the legend rail sits on the left and the plate takes the remaining 9 columns. On `/` the Ring Plate **bleeds** off the right edge of the viewport. That's the one deliberate break of the grid.
- **Alignment:** text is left-aligned throughout. Never center body copy. Numbers in tables align right.
- **Measure:** prose is capped at 68 ch and UI text at 80 ch.
- **Density:** this is a research tool. Spacing serves scanning, not luxury. Section rhythm is 64–96 px, not 160 px+.

## 5. Spacing, radius, borders, elevation

- **Spacing scale (4 px base):** `1`=4, `2`=8, `3`=12, `4`=16, `6`=24, `8`=32, `12`=48, `16`=64, `24`=96.
- **Radius, set by role:** plates and panels 0, because they are sheets of a survey. Inputs and buttons 6 px. Filter chips and segmented items fully round. Focus rings follow the element's radius.
- **Borders:** inputs use 1 px `line-strong`, becoming 2 px `ink` on focus or hover. Plate frames use 1 px `ink` at the top edge only, which is the legend band (§7). Separators use `rule`.
- **Elevation:** there are no shadows. Dialogs and popovers are sheets on a 40 % ink scrim, with a 1 px ink border.

## 6. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `motion-state` | 120 ms | `cubic-bezier(0.2, 0, 0, 1)` | hover/press color, toggles |
| `motion-panel` | 200 ms | same | panels, disclosures, bottom sheet |
| `motion-map` | 600 ms | MapLibre ease | map fly-to on selection |
| `motion-ring` | 900 ms, once per session | `ease-out` | Ring Plate draw-in on `/` (stroke-dashoffset) |

`prefers-reduced-motion: reduce` sets every token to 0 ms. Map transitions jump. The ring is drawn complete.

No scroll-triggered entrance animations. No looping animations. Use CSS transitions and the View Transitions API where supported. No motion library (D-013).

## 7. Provenance notation (the system's core device)

Every data-bearing module, whether a plate, chart, map layer or facts ledger, has a **legend band** along its top edge. The band always contains **words**. The pattern is only a second cue.

| State | Band | Label (fixed copy) | Links to |
|---|---|---|---|
| Official | solid 3 px `ink` rule | "Official data", then the source short name | `/methodology#sources` |
| User | solid 3 px `ink-2` rule | "From your entries" | `/methodology#your-data` |
| Demo | 12 px band, 45° hatch in `line-strong` (1 px lines, 6 px pitch) | "Demo data, not Berlin market statistics" | `/methodology#market-data` |
| Not connected | 1.5 px dashed `line-strong` outline around the whole module | "Not connected", then what is missing | `/methodology#in-development` |
| Pending | no band; a muted panel | "Not written yet", then the reason | `/methodology#neighborhood-content` |

For demo charts, the label is also rendered **inside the SVG** (top-left, `small`, `ink-3`), so exported or screenshotted figures keep it.

The hatch is a *frame* device. It never fills data marks, because data-mark texture is reserved for the accessibility channel (§8.5).

## 8. Data visualization

Method: the `dataviz` skill. The form comes first, color last, and every palette is validated.

### 8.1 Categorical (identity). Fixed order, never cycled.

| Slot | Name | Light | Dark |
|---|---|---|---|
| 1 | Prussian | `#2A6FB0` | `#4D8FD6` |
| 2 | Brick | `#D0603A` | `#D4643F` |
| 3 | Canal | `#17A08A` | `#2AA37A` |
| 4 | Lilac | `#8B62D0` | `#A07FE0` |
| 5 | Pine | `#4C8A2B` | `#5A9A35` |
| 6 | Rose | `#D9709A` | `#CF6890` |

Validation results (2026-10-29), against sheet `#FBFCFB` (light) and `#0C1A29` (dark):
- **Adjacent pairs (lines, bars, stacks), all 6 slots:** PASS in both modes. Light worst CVD ΔE 10.9, normal-vision ΔE 24.6. Dark worst CVD ΔE 9.8, normal-vision ΔE 22.2.
- **All pairs (maps, scatter, small multiples):** the **first 3 slots** PASS in both modes. Four slots FAIL (Lilac vs Prussian), so **all-pairs forms are capped at 3 series**. Past that, fold into "Other" or facet.
- The dark Canal step was moved from `#1D9A86` to `#2AA37A` to clear the normal-vision floor.

Product rules that follow from this:
- Trend lines compare **at most 4 Bezirke**, since lines use the adjacent-pair rule.
- The district comparison uses **one hue** (slot 1) for all 12 bars, and marks the selected Bezirke with an ink outline plus a label, not a new hue.

### 8.2 Sequential (magnitude), one hue (Prussian)
- Light, 5 discrete bins: `#84AED2 → #5A8FBF → #3672A8 → #1D578C → #0B3D66`. The ordinal check PASSED: monotone L, ΔL ≥ 0.06, light-end contrast 2.28:1.
- Continuous light ramp: prepend `#DBE7F1` and `#B3CDE3` for near-zero values.
- Dark, 5 bins: `#1D4F7C → #2F6AA0 → #4B88C2 → #74A8DA → #A8CBEB`. Anchors are flipped. The ordinal check PASSED with a light-end contrast of 2.06:1.

### 8.3 Diverging (polarity)
Prussian (slot-1 ramp) and Brick (slot-2 ramp), with a neutral midpoint of `#E4E8EA` (light) or `#2A3846` (dark), and equal steps on each arm. Use it only when a meaningful baseline exists. It isn't used in this phase.

### 8.4 Marks and anatomy
- Lines 2 px. Markers ≥ 8 px. Bars have 4 px rounded data-ends anchored to the baseline, with a 2 px surface gap between adjacent fills.
- Gridlines in `rule`. Baseline in `line-strong`. Axis text in `ink-3`, `label-condensed`, tabular numerals.
- Text always uses text tokens, never the series color.
- A legend whenever there are 2 or more series. Up to 4 series are also labeled directly at the line ends.
- A hover/focus tooltip on every chart: a crosshair for lines, per-mark for bars and dots. Hit targets are larger than the marks.
- Every chart has a **"Show table"** toggle that renders a real `<table>` with a caption.
- **One y-axis, always.**

### 8.5 Accessibility texture
The 45° and 135° line fill on data marks appears only when `forced-colors` is active, when printing, or when the user enables "patterns" (planned for slice 9). It is never on by default and never decorative.

## 9. Focus, states, and interaction tokens

- **Focus:** a 2 px `--color-focus` outline with a 2 px offset, on **every** interactive element including map list items and SVG paths. Never remove the outline without a replacement. The focused element must not be hidden by sticky headers (WCAG 2.4.11): use `scroll-margin-top` of at least the header height plus 16 px.
- **Hover:** inputs get a 2 px border. Ledger rows get a `paper` → `sheet` plane shift. Map polygons get a 1.5 px ink outline.
- **Pressed:** buttons shift `translateY(1px)` and darken (`ink-hover`).
- **Selected:** a marker fill, plus a 2 px ink outline, plus a text state such as "Selected" (or `aria-selected` / `aria-pressed`).
- **Disabled:** ink-3 text, a dashed border and `aria-disabled`, with the reason given nearby in text. Avoid disabled submit buttons. Prefer validation on submit.
- **Touch targets:** at least 44 × 44 px for primary controls and at least 24 × 24 px everywhere (WCAG 2.5.8).

## 10. Components (inventory and contracts)

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (ink fill), `secondary` (1 px ink outline), `quiet` (text with underline on hover). Sizes `md` (44 px) and `sm` (36 px, in dense rails only). Labels name the outcome ("Prepare analysis", not "Submit"). |
| `Field` | A wrapper that provides the label, `required`/`optional` text, hint, error (`aria-describedby`), and unit suffix. |
| `NumberField` | Native `input inputmode="decimal"`, with the unit suffix outside the input and optional stepper buttons (rooms, floors). Parsing is locale-aware. |
| `Select` | Native `<select>` for Bezirk and other short lists. It is the best mobile UX. |
| `Combobox` | Ortsteil search on `/analyze` and `/explore`. Built on React Aria Components (D-007). |
| `SegmentedControl` | A radio group with the visual style of joined pills, for property type and condition. |
| `TriState` | Yes / No / Not sure, for lift and balcony. A radio group, never a checkbox. |
| `FloorIndicator` | A vertical stack of `total_floors` segments with the chosen floor marked. Decorative twin of the inputs, `aria-hidden`, because the inputs carry the meaning. |
| `LegendRail` | The left rail. A `<aside aria-label="Legend and sources">` with definition lists. |
| `Plate` | A figure container: `<figure>` with the question title, legend band, body, and caption/source line. |
| `ProvenanceBand` | The five states from §7. Copy is fixed and the link is required. |
| `Ledger` | Rows of term, description and status, used for the tools index and the truth table. Not cards. |
| `StatusPanel` | Not-connected, empty and error states: a title, an explanation, what to do next, and actions. |
| `Dialog` | React Aria `Modal`/`Dialog`. Focus trap, Esc to close, returns focus. |
| `Disclosure` | Native `<details>`/`<summary>`, styled. |
| `RingPlate`, `LocatorPlate`, `BezirkSilhouette` | d3-geo SVG, server-rendered (see FRONTEND_ARCHITECTURE §6). |
| Chart primitives | `LineChart`, `BarChart`, `Histogram`, `DotPlot`, each with `TableView`. visx and d3 inside, tokens outside. |

Icons: `lucide-react`, utility glyphs only (check, alert, info, x, chevron, search, plus, minus). 1.5 px stroke, 20 px, `currentColor`. Icons are never decorative illustrations and never stand alone without an accessible name.

## 11. Map styling (MapLibre on `/explore`; SVG elsewhere)

- Background `sheet`. No basemap by default (D-004).
- Ortsteil fill: transparent, with 0.75 px `line-strong` boundaries. Bezirk boundaries are 1.5 px `ink`. The Umweltzone ring is 2.5 px `ink` with a 1 px `sheet` casing.
- Hover: a 1.5 px ink outline. Selected: a `marker` fill at 0.85 opacity, a 2 px ink outline, the label in bold.
- Labels: Archivo `label-condensed`, sentence case, `ink-2`, with a 1.5 px `sheet` halo. Bezirk names appear only at low zoom and Ortsteil names at higher zoom.
- Attribution control, always visible: "Geometry: ALKIS Berlin, Umweltzone (Geoportal Berlin), dl-de/zero-2.0", plus OSM/OpenFreeMap credit if the optional basemap is on.

## 12. Voice and copy

- English UI. Official German place names are kept exactly (Neukölln, not Neukoelln), with a German term explained the first time it appears ("Bezirk (borough)").
- Sentence case. Plain verbs. Active voice. No filler. No "AI-powered". No exclamation marks.
- Fixed vocabulary:
  - *Prepare analysis*, followed by *Prediction engine not connected*.
  - *Add to comparison*, followed by *Added to comparison*.
  - *Demo data*, *Official data*, *From your entries*, *Not connected*.
- Errors say what happened and how to fix it ("Floor 7 is above the building's 5 floors. Lower the floor or raise total floors."). Never apologize.
- Empty states invite action.
