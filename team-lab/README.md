# TeamLab

TeamLab is a local-first Great, Ultra, and Master League inventory and team-planning
application with a Mega toggle for each league, built on the data and simulation
engine in this PvPoke fork. Owned inventory is shared across leagues.

It supports exact owned and planned builds, TeamLab-template CSV inventory
import, IV/build analysis, matchup-backed build planning, ordered saved teams,
real PvPoke TeamRanker matrices, full-inventory or anchored recommendations,
recommendation history, roster update review, and portable full-data JSON
backup and restore.

The **Battle** page (`/battle`, also in the mobile More menu) runs configurable
1v1 matchups in all six open and Mega formats. Choose species/forms, Shadow variants, moves,
level, IVs, and independent shield counts. Fit to league selects the highest
legal level for the entered IVs. Playback supports play/pause, speed, individual
turns, scrubbing, and a full event log with HP, energy, shields, and stat stages.
The replay observes the bundled PvPoke engine after each step; it does not
reimplement damage or decision logic. Both combatants start at full HP and zero
energy, with upstream default move/shield decisions and buff behavior.

Run the focused real-browser replay and engine-parity checks with
`npm run test:browser -- --duel`. The full browser suite also covers this page.

## Requirements

- Node.js `^22.22.0`, `^24.0.0`, or `>=26.0.0` (Node 25 is excluded);
- npm 11 or newer.

## Quick start

```bash
cd team-lab
npm ci
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

GitHub Actions runs **Verify public artifact** and CodeQL on PRs targeting any
branch, including stacked PRs. The gate installs the lockfile, audits and
validates source/data, and browser-tests the exact public artifact. A successful
push to `master` deploys those verified bytes to production. Trusted
same-repository PRs into `staging` or `master` can deploy a staging preview;
apply `staging-preview` to the top PR to preview a complete stack before its
parents land. Forks and Dependabot PRs never deploy; dependency author and
branch checks still apply when a maintainer triggers a run. Manual runs only
validate. See [stacking and preview selection](docs/DEPENDENCY-MAINTENANCE.md#stacking-related-pull-requests).

Deployments use the already verified `team-lab-public-<commit SHA>` artifact.
The deployed-origin check verifies release metadata, entry assets, and browser
workflows at the immutable URL; it does not build a second artifact.

The canonical production domain is also checked for the expected release and
indexable public pages. Cloudflare challenges fail with a Ray ID and an explicit
policy error; see [deployment troubleshooting](docs/CLOUDFLARE-DEPLOYMENT.md#cloudflare-challenges).

Verify the live application and its release
identity with:

```bash
TEAMLAB_EXPECTED_COMMIT_SHA=<commit SHA> \
  npm run test:deployment -- \
    --origin=https://pvpoke-team-lab.pages.dev/
```

The **Team Lab deployment check** GitHub workflow exposes the same verification
as both a manual action and the automatic post-deployment job.

Inventory, saved teams, and recommendation history live in IndexedDB for the
current browser profile and origin. Download JSON backups regularly.

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

TeamLab 1.3.0 uses Season 28, Twilight Trails. Runtime assets come from the
explicit active pin in `src/pvpoke/season.ts`, not automatically from the latest
fetch or the root `src/` tree. `UPSTREAM_COMPARISON_COMMIT` retains the outgoing
pin for the roster update review.

Follow the [complete upstream refresh runbook](docs/PVPOKE-DATA.md) to fetch and
review upstream, advance both pins, regenerate the six-format bundle and
artwork, adapt regressions, update release metadata, validate, and select the
correct staging preview. A fetch plus sync without advancing the pins
reproduces the current bundle; it does not adopt new upstream commits.

## Reviewing changes to your roster

Open **Inventory → More actions → Review roster updates**, **Saved teams →
Review roster updates**, or the dashboard reminder. `/updates` shows published
ranking/move changes and invalid references for the selected open/Mega format.
Team analysis records both the data date and upstream revision; successful
reruns clear freshness flags only if the team and its members are unchanged.
Dismissal hides a reminder for one update/format without hiding repair issues.

See the [roster implementation record](docs/implementation/phase-10-roster-updates/roster-review-and-freshness.md)
for comparison scope and persistence details.

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

- [Release notes archive and release workflow](docs/RELEASES.md)
- [1.3.0 release notes](docs/RELEASE-1.3.0.md)
- [1.2.4 release notes](docs/RELEASE-1.2.4.md)
- [1.2.3 release notes](docs/RELEASE-1.2.3.md)
- [Local user guide](docs/USER-GUIDE.md)
- [Deployment build targets](docs/DEPLOYMENT-BUILDS.md)
- [Cloudflare Pages deployment and cutover](docs/CLOUDFLARE-DEPLOYMENT.md)
- [PvPoke asset maintenance](docs/PVPOKE-DATA.md)
- [Product scope and project plan](docs/PROJECT-PLAN.md)
- [Implementation records](docs/implementation/README.md)
- [Roster update review](docs/implementation/phase-10-roster-updates/README.md)
- [Modern battle lab UI/UX](docs/implementation/phase-09-ui-ux-overhaul/README.md)
- [Style architecture and visual regression](docs/implementation/phase-09-ui-ux-overhaul/style-architecture.md)
