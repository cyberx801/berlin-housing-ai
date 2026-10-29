---
name: design-system
description: Keep Berlin Housing AI's "Atlas" visual identity consistent. Use before creating or restyling any page, component, chart, map layer or copy in this repo, and when reviewing screenshots. Covers tokens, typography (Archivo width axis + Source Serif 4), grid and legend rail, provenance notation, motion, chart palette caps and voice.
---

# Atlas design system: apply and review

The source of truth is `docs/design/DESIGN_SYSTEM.md`, with rationale in `docs/design/DESIGN_DIRECTION.md`. Read the relevant sections before building. This skill is the working checklist. If this file and the doc disagree, the doc wins, so fix this file.

## Before building
1. Identify the plate: what question does this screen or module answer? Write it as the plate title.
2. Identify the provenance of every value shown: official, user, demo, not connected, or pending (DESIGN_SYSTEM §7, DATA_BOUNDARIES §1). Every data-bearing module gets a `ProvenanceBand` with its fixed copy.
3. Place it in the grid: legend rail (columns 1–3 at `lg`+) and plate (4–12). Decide how the rail collapses at `md` (strip) and `sm` (disclosure).

## Hard rules (a violation means it isn't done)
- Use role tokens only (`--color-ink`, `--color-sheet`…). No raw hex values in components. No new colors without a DESIGN_SYSTEM change and a contrast check.
- `--color-marker` (yellow) is only a fill behind ink, always with a 2 px ink outline and a text or ARIA state. Never text, never a glow.
- No shadows, gradients, blur or glassmorphism. Depth comes from the paper → sheet planes.
- Radius by role: plates 0, controls 6 px, chips fully round. Don't apply one radius to everything.
- Typography:
  - Archivo for UI. Expanded `wdth` 110–125 for titles and figures, condensed `wdth` 75 for map labels and table headers.
  - Source Serif 4 only for prose (≤ 68 ch).
  - **No all-caps** (map labels included).
  - No single-word accent in headlines.
  - No eyebrow labels.
  - No monospace for data. Use `tabular-nums` in columns and axes.
- No card grids of identical rounded boxes. Use a ledger, a list, a plate, or small multiples of real geometry.
- No `→`/arrow glyphs appended to link text, and no `A · B · C` meta strings in the UI. Use definition lists in the rail.
- Motion: only in response to an action, except the single ring draw-in on `/`. All motion is 0 ms under `prefers-reduced-motion`.
- Charts:
  - Categorical slots in the fixed order (Prussian, Brick, Canal, Lilac, Pine, Rose).
  - All-pairs forms ≤ 3 series, trend lines ≤ 4.
  - The district comparison uses one hue.
  - One y-axis.
  - Legend for 2+ series.
  - A table view always.
  - Demo label drawn inside the SVG.
- Copy:
  - Sentence case and plain verbs.
  - The button names the outcome. Fixed vocabulary is in DESIGN_SYSTEM §12.
  - Never "AI-powered". Never a number that looks like a rent estimate unless it came from a real `model` response.

## Review pass (on screenshots at 375 / 768 / 1440)
1. Squint test: is there exactly **one** bold thing on the screen? Remove one accessory if not.
2. Does any section read like a generic template (hero + three feature cards, stat-tile row, gradient band)? Redesign it as a plate, ledger or list.
3. Are the provenance bands present and legible, with their words? Do the demo charts still say "Demo data" when cropped?
4. Grid: does the content align to columns, is text left-aligned, and is the measure respected? Is there horizontal scroll at 375 px?
5. Typography: is the width axis used deliberately, is the hierarchy clear without color, and do the figures align?
6. Write findings into `docs/implementation/TASKS.md` under the slice. Fix them, or record why not.
