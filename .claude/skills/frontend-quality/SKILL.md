---
name: frontend-quality
description: Verify a Berlin Housing AI change actually works — TypeScript, lint, tests, build, component boundaries, data-integrity boundaries, responsive layout and real interaction behavior. Use after finishing any implementation slice or non-trivial UI change, before reporting it as done.
---

# Frontend quality gate

Run the gate in order. Report each step's **actual** result: command, pass or fail, and the relevant output. Never claim a check passed if it wasn't run. If a step can't run, say why.

## 1. Static checks
```bash
npm run typecheck   # tsc --noEmit, strict
npm run lint        # eslint . (includes boundary rules)
npm run test        # vitest run
npm run build       # next build — must succeed
```
Fix the failures, don't silence them. No `// @ts-ignore`, no `eslint-disable` without a written reason on the same line, and no widening types to `any`.

## 2. Boundaries (architecture and data integrity)
Check `docs/architecture/FRONTEND_ARCHITECTURE.md` §2 and `DATA_BOUNDARIES.md` §5:
- `app → features → components → lib`. `components/` does no data access and imports nothing from `features/`.
- `lib/fixtures/**` is imported only by `lib/data/market/demo-source.ts`.
- `tests/contracts/fixtures/**` is never imported from `src/`.
- `lib/data/geo/**` is server-only.
- There are no `NEXT_PUBLIC_*` variables holding secrets, and no fetches to third-party origins except the optional, flagged basemap.
- Every data-bearing component receives a `provenance` prop, and nothing renders a rent-like number without a `model` provenance.
- `"use client"` sits at the smallest possible leaf. Server components stay server components.

## 3. Behavior (run the app)
1. `npm run dev`, or `npm run build && npm run start` for production behavior.
2. Run the relevant Playwright journeys: `npx playwright test tests/e2e/<flow>.spec.ts`.
3. For the changed screens, capture screenshots at **375×812, 768×1024 and 1440×900** and **look at them**. Check for overflow, horizontal scroll, clipped text, overlapping labels and focus visibility.
4. Exercise every control you touched by mouse **and** keyboard. Check hover, focus, pressed, loading, empty, error and success states. A control with no working behavior is removed or labeled. It is never left as a fake.
5. Check that URL state round-trips: reload and back/forward keep the filters and selection.
6. Check storage edge cases where relevant: empty, corrupt JSON, old version key.

## 4. Performance spot-check
- Note route first-load JS from the `next build` output against the budgets in ARCH §10.
- MapLibre must not appear in any chunk except `/explore`'s lazy chunk.

## 5. Report
Update `docs/implementation/TASKS.md`: tick done items and list known gaps. Add any new decision to `DECISIONS.md`. Summarize for the user with the commands run and their results.
