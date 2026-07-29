# TeamLab

TeamLab is a local-first Open Great League inventory and team-planning
application built on the data and simulation engine in this PvPoke fork.

It supports exact owned and planned builds, IV/build analysis, ordered saved
teams, real PvPoke TeamRanker matrices, anchor-based recommendations, and
portable full-data JSON backup and restore.

## Requirements

- Node.js 22.12 or newer;
- npm 11 or newer.

## Quick start

```bash
cd team-lab
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. Confirm the
home-page data card says **Ready** before entering inventory.

TeamLab serves its validated PvPoke-derived data and classic simulation engine
from `public/vendor/pvpoke/`. It does not need Apache, PHP, Docker, or a second
PvPoke application at development or deployment time.

## Deployment builds

The standard production build excludes engine diagnostics from its routes,
navigation, and JavaScript chunks. It also emits `release.json` with the app
version, source commit, schema versions, capabilities, and PvPoke bundle
identity:

```bash
npm run build
```

Maintainers can create a separate diagnostics-enabled artifact in
`dist-admin/`:

```bash
npm run build:admin
```

The admin artifact does not provide authentication by itself and must only be
served locally or behind deployment-level access control. Development mode
keeps diagnostics enabled. See
[deployment build targets](docs/DEPLOYMENT-BUILDS.md).

GitHub Actions runs the **Verify public artifact** release gate on pull
requests, pushes to `master`, and manual dispatches. Feature-branch pushes with
an open pull request produce only the pull-request run. The gate installs the
locked dependencies, runs the complete static/unit/data checks, builds and
browser-tests the exact public artifact, rejects `dist-admin/`, and uploads
`team-lab-public-<commit SHA>`. After a successful push to `master`, those exact
verified bytes deploy to the static-only Cloudflare Pages project. The
post-deployment gate waits for the immutable release metadata and entry assets,
then browser-tests that URL against the expected commit. Its initial remote
navigation has bounded retries and reports document, network, console, and
runtime evidence on failure. Pull requests never deploy.

Verify the live application and its release
identity with:

```bash
TEAMLAB_EXPECTED_COMMIT_SHA=<commit SHA> \
  npm run test:deployment -- \
    --origin=https://pvpoke-team-lab.pages.dev/
```

The **Team Lab deployment check** GitHub workflow exposes the same verification
as both a manual action and the automatic post-deployment job.

Inventory and saved teams live only in IndexedDB for the current browser
profile and origin. Download JSON backups regularly.

Read the complete [local user guide](docs/USER-GUIDE.md) for alternate ports,
inventory and analysis workflows, teams, recommendations, backup/recovery,
troubleshooting, and MVP limitations.

## Pokémon artwork

Optimized local Pokémon artwork is checked into
`public/assets/pokemon/`, so normal development and builds do not download
anything from PokeAPI.

When the bundled Game Master gains species/forms or the pinned artwork
revision is intentionally changed, refresh the assets after syncing PvPoke:

```bash
npm run sync:sprites
```

The script generates the typed manifest and attribution/fallback report. See
the [sprite pipeline record](docs/implementation/phase-09-ui-ux-overhaul/sprite-pipeline.md)
for its mapping and review contract.

## Updating PvPoke data and engine files

After updating the upstream checkout, regenerate TeamLab’s owned copy:

```bash
npm run sync:pvpoke
npm run validate:data
npm test
npm run build
```

The sync command reads `../src` by default, validates all JSON inputs before
overwriting anything, and records file hashes in
`public/vendor/pvpoke/manifest.json`. To import from another checkout, set
`PVPOKE_SOURCE_DIR` to its `src` directory. The upstream source tree is never
modified. See [PvPoke asset maintenance](docs/PVPOKE-DATA.md).

## Validation

```bash
npm test
npm run test:scale
npm run test:browser
npm run test:production
npm run test:visual
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

The browser and visual suites require a Chromium-compatible browser. After an
intentional visual change, inspect the generated diff before running
`npm run update:visual`. Normal development and validation commands run from
`team-lab/`.

`npm test` runs the deterministic unit suite. The wall-clock MVP scale
characterization runs separately through `npm run test:scale`, where it uses
three cache-cold recommendation samples and gates on their median. Release CI
runs both commands as separate steps so parallel unit workers cannot distort
the performance budget.

## Documentation

- [Local user guide](docs/USER-GUIDE.md)
- [Deployment build targets](docs/DEPLOYMENT-BUILDS.md)
- [Cloudflare Pages deployment and cutover](docs/CLOUDFLARE-DEPLOYMENT.md)
- [PvPoke asset maintenance](docs/PVPOKE-DATA.md)
- [Product scope and project plan](docs/PROJECT-PLAN.md)
- [Implementation records](docs/implementation/README.md)
- [Modern battle lab UI/UX](docs/implementation/phase-09-ui-ux-overhaul/README.md)
- [Style architecture and visual regression](docs/implementation/phase-09-ui-ux-overhaul/style-architecture.md)
