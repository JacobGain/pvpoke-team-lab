# TeamLab

TeamLab is a local-first Open Great League inventory and team-planning
application built on the data and simulation engine in this PvPoke fork.

It supports exact owned and planned builds, IV/build analysis, ordered saved
teams, real PvPoke TeamRanker matrices, anchor-based recommendations, and
portable full-data JSON backup and restore.

## Requirements

- the complete PvPoke fork checkout;
- Docker with Docker Compose;
- Node.js 22.12 or newer;
- npm 11 or newer.

## Quick start

Start the inherited PvPoke server from the repository root:

```bash
make up
```

In another terminal, start TeamLab:

```bash
cd team-lab
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. Confirm the
home-page data card says **Connected** before entering inventory.

TeamLab reads the existing PvPoke data through `/pvpoke/src` by default. During
development, Vite proxies that path to `http://localhost`. Copy `.env.example`
to `.env.local` if either path differs in your environment. Upstream UI links
use this same base path.

Inventory and saved teams live only in IndexedDB for the current browser
profile and origin. Download JSON backups regularly.

Read the complete [local user guide](docs/USER-GUIDE.md) for alternate ports,
inventory and analysis workflows, teams, recommendations, backup/recovery,
troubleshooting, and MVP limitations.

## Validation

```bash
npm test
npm run test:scale
npm run test:browser
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

`npm run test:browser` requires a Chromium-compatible browser. Normal
development and validation commands run from `team-lab/`.

## Documentation

- [Local user guide](docs/USER-GUIDE.md)
- [Product scope and project plan](docs/PROJECT-PLAN.md)
- [Implementation records](docs/implementation/README.md)
