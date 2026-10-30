# Berlin Housing AI — working rules

The spec docs in `docs/` are the source of truth. Read the relevant one before changing behavior. Update `docs/implementation/TASKS.md` and `DECISIONS.md` as part of every slice.

## Integrity (never break these)
- No rent estimate, "fair price" or prediction-like number is rendered unless it came from a real prediction API response (`provenance.kind === "model"`). No pricing formulas, no simulated inference, no paid AI or LLM APIs.
- The only model that exists is trained on synthetic data (D-058). Its response is `model` with `trainedOn: "synthetic"` and is always shown under the demo band and the words "Demo model, trained on synthetic data. Not a Berlin market estimate." Never in titles, meta text, previews, or beside real figures as a comparison.
- Every data-bearing component takes a typed `provenance` prop and shows its legend band (`Plate` or `ProvenanceLabel`).
- Demo fixtures (`src/lib/fixtures/demo/`) are imported only by `src/lib/data/market/demo-source.ts`. Contract fixtures (`tests/contracts/fixtures/`) are never imported by `src/`.
- Neighborhood facts come from the geodata derivations only. No ratings, indices or unsourced prose.
- Kaggle CSVs aren't used by any screen until they pass the intake protocol (DATA_BOUNDARIES §4).
- Don't compute areas from ALKIS `gdf` (it's unreliable). Don't group Ortsteile by `bezeich`. Use `sch`.

## Workflow
- Skills: `design-system` before UI work, `frontend-quality` before calling a slice done, `accessibility-review` for interactive components.
- Report checks truthfully: command, result, output. A skipped check is stated as skipped.
- No deploys, paid services, or commits/pushes unless the owner asks.
