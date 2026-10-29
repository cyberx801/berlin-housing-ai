# User Flows

Status: Draft v0.1 · 2026-10-29 · Requirements IDs refer to [PRD §5](PRD.md).

Each flow lists its steps, the states every screen must design for, and its edge cases. A flow is done when its E2E journey (see `tests/e2e/`) passes at 375 px and 1440 px.

---

## Flow 1 — "Is this asking rent normal?" (newcomer, renter)

```
/ (hero entry: Bezirk, m², rooms)
  └─▶ /analyze?bezirk=mitte&area=65&rooms=2   (prefilled, focus on first empty required field)
        ├─ fills Ortsteil (filtered by Bezirk), floor 2 of 5, balcony yes, lift not sure
        └─▶ "Prepare analysis"
              ├─ invalid → error summary (links to fields), focus moves to the summary
              └─ valid → PropertyAnalysisService.estimateRent()
                    └─ result: not_connected
                          ├─ "Prediction engine not connected" panel
                          ├─ input summary + "Show request payload" disclosure
                          ├─ [Add to comparison] ─▶ /compare (slot filled, asking rent prompt)
                          └─ [Open Moabit profile] ─▶ /neighborhoods/moabit
```

States: pristine, partially complete, invalid on submit, submitting (short; the button shows progress), not_connected, and later ok, unavailable and rejected (all designed now; see PREDICTION_API §7).

Edge cases:
- URL params that are invalid (`area=abc`) are ignored with a notice. They never crash the page.
- A changed Bezirk invalidates the Ortsteil. The Ortsteil is cleared, and the live region announces it.
- Floor greater than total floors → a field-level error on *floor*.
- A session reload restores the draft. "Start over" asks for confirmation.

## Flow 2 — "Where is this neighborhood, and what's next to it?"

```
/ (Bezirk silhouettes) ─▶ /neighborhoods?bezirk=mitte
  └─ filter: Ring = partly inside (Moabit is 83 % inside) · search "moa"
       └─▶ /neighborhoods/moabit
             ├─ facts ledger (Bezirk, area, Ring status, adjacent Ortsteile — official)
             ├─ market module (demo, hatched) · transit (not connected) · character (pending)
             ├─ adjacent Ortsteil link ─▶ /neighborhoods/tiergarten
             └─ [See on map] ─▶ /explore?o=moabit
```

States: directory with results, directory with no results (suggest clearing filters, list the active filters), and an unknown slug (404 with a search box and the full A–Z list link).

## Flow 3 — Map exploration

```
/explore
  ├─ map loads (lazy) · list renders immediately (SSR)
  ├─ select via: map click | list (arrow keys + Enter) | search field (filters the list)
  │     └─ panel opens · URL ?o=<slug> · map fits bounds (instant if reduced motion)
  ├─ filter Bezirk / Ring status → list + map styling update · URL updates (replace, not push)
  └─ panel actions: [Open profile] [Analyze a flat here] [Close (Esc)]
```

States: map loading (the list is usable meanwhile), WebGL unavailable (falls back to the SVG plate and states why), no matches, and a selection hidden by the active filter (the panel stays open and notes "Hidden by current filter").

Mobile: the map takes the top 55 % of the viewport, and a bottom sheet holds two tabs, *List* and *Details*. The sheet is a regular region, not a modal, so the map stays operable.

## Flow 4 — Reading the market dashboard (researcher)

```
/market
  ├─ demo notice (once, persistent band — not a dismissible toast)
  ├─ filters: Bezirke (≤4 for trend lines), period, property type → URL
  ├─ modules update together · each: question → chart → "Show table" → method note
  └─ "How this is calculated" ─▶ /methodology#market-data
```

States: a filter combination with no fixture data ("No demo series for this combination", with a reset action), a 5th Bezirk selection is blocked and the reason is given, and the table view is always available.

## Flow 5 — Comparing up to three listings

```
/compare
  ├─ empty: explains the tool; [Add a property] · [Start from an analysis]
  ├─ add manually (dialog with the same schema as /analyze + asking cold rent + label + optional listing URL)
  ├─ from /analyze (slot pre-filled; asking rent left empty and flagged)
  ├─ table: rows = attributes; missing → "Missing" in text; €/m² calculated from user entries
  ├─ replace / remove a slot · [Clear all] → confirm dialog
  └─ persisted (localStorage, versioned) — reload restores
```

Edge cases: a 4th add when 3 slots are full (the user must replace one, and the dialog says so), a corrupt or old storage version (data dropped with a notice), and a listing URL that isn't http(s) (rejected).

## Flow 6 — Trust and methodology (anyone)

Every provenance band ("Official data", "Demo data", "Not connected") links to its methodology anchor. `/methodology` opens on a contents list. Its sections match the PRD §3 truth table one-for-one.

---

## Screen × state matrix

| Screen | Empty | Loading | Partial | Error | Not connected | Demo |
|---|---|---|---|---|---|---|
| `/` | — | none (SSR) | — | route error boundary | ledger row | ledger row |
| `/analyze` | pristine form | submit pending | progress counts | field + summary | result panel | — |
| `/explore` | no matches | map loading | — | WebGL fallback | transit module | opt-in layer only |
| `/market` | no fixture for filter | skeleton per module | — | module-level error | — | every module |
| `/neighborhoods` | no results | none (SSG) | — | 404 | transit | market module |
| `/compare` | no properties | — | missing fields | storage corrupt | predicted rent row | — |
| `/methodology` | — | none (SSG) | — | — | described | described |
