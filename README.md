# Berlin Housing AI

A research tool for Berlin housing. You can explore the 12 Bezirke and 97 Ortsteile on a map, compare listings you've found, and prepare a structured property description for a rent-prediction model that a separate ML workflow is building.

> **Current state (2026-10-29): specification phase.**
> - Live: official geodata (ALKIS Berlin, Umweltzone), retrieved and checksummed in `data/raw/geo/`.
> - Not yet built: the application code. Implementation starts with slice 0 in `docs/implementation/TASKS.md`.
> - Not connected: rent prediction. No model exists and none is simulated.

## Documentation (source of truth)

| Doc | What it decides |
|---|---|
| [docs/product/PRD.md](docs/product/PRD.md) | Scope, capability truth table, acceptance criteria |
| [docs/product/USER_FLOWS.md](docs/product/USER_FLOWS.md) | Journeys and screen states |
| [docs/design/DESIGN_DIRECTION.md](docs/design/DESIGN_DIRECTION.md) | Three concepts, evaluation, the selected "Atlas" direction, wireframes |
| [docs/design/DESIGN_SYSTEM.md](docs/design/DESIGN_SYSTEM.md) | Tokens (contrast-checked), type, grid, provenance notation, chart palette (validated) |
| [docs/architecture/FRONTEND_ARCHITECTURE.md](docs/architecture/FRONTEND_ARCHITECTURE.md) | Stack, layout, routes, state, geo pipeline, testing |
| [docs/architecture/DATA_BOUNDARIES.md](docs/architecture/DATA_BOUNDARIES.md) | Provenance kinds, demo vs real rules, Kaggle intake protocol |
| [docs/contracts/PREDICTION_API.md](docs/contracts/PREDICTION_API.md) | Draft `POST /api/v1/predictions/rent` contract for the FastAPI service |
| [docs/implementation/TASKS.md](docs/implementation/TASKS.md) | Vertical slices and status |
| [docs/implementation/DECISIONS.md](docs/implementation/DECISIONS.md) | Decision log |
| [data/PROVENANCE.md](data/PROVENANCE.md) | Dataset registry: sources, licenses, checksums |

## Setup

Requirements: Node.js ≥ 20.9 (developed on 22.16) and npm ≥ 10. No API keys are needed.

```bash
npm install
npm run geo:build     # derive simplified geometry + metadata from data/raw/geo
npm run dev           # http://localhost:3000
npm run check         # typecheck + lint + unit tests + production build
npm run test:e2e      # Playwright (first run: npx playwright install chromium)
```

*These scripts arrive in slices 0–1. This section is verified on a clean install once they exist.*

### Configuration

Copy `.env.example` to `.env.local`. Prediction is **disabled** by default. See [PREDICTION_API §7](docs/contracts/PREDICTION_API.md) for the `direct` and `proxy` modes. Never put a backend secret in a `NEXT_PUBLIC_` variable.

## Data and licenses

- Bezirk and Ortsteil boundaries: ALKIS Berlin (Geoportal Berlin), Datenlizenz Deutschland – Zero – Version 2.0.
- Umweltzone (area within the S-Bahn ring): Geoportal Berlin, dl-de/zero-2.0.
- Market figures shown in the app are **demo data** until a validated source is connected. See `DATA_BOUNDARIES.md`.
