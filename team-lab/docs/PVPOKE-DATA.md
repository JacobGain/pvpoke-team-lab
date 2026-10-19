# PvPoke Asset Maintenance

TeamLab contains the PvPoke-derived data and classic JavaScript modules it
uses at runtime. Development, browser tests, production builds, and deployed
applications therefore run without Apache, PHP, Docker, or a second PvPoke
host.

## Runtime bundle

`public/vendor/pvpoke/` contains:

- the full and minified Game Master files;
- Great, Ultra, and Master League overall rankings and meta groups, including their Mega variants;
- the classic jQuery, GameMaster, Pokémon, Battle, action, timeline, and
  TeamRanker modules required by TeamLab simulations;
- generated dashboard data and the outgoing/current roster comparison;
- PvPoke’s MIT license;
- a deterministic manifest with the data version, byte sizes, source paths,
  and SHA-256 hashes.

The full Game Master payload is preserved. New Pokémon, forms, moves, cups,
and move changes are not projected into a TeamLab-specific format. The
ranking and group files are likewise copied byte-for-byte for TeamLab’s
three supported open leagues and their Mega variants.

## Current pins and supported scope

The active season is **Season 28 — Twilight Trails**. `src/pvpoke/season.ts`
sets the active branch to `master` and the reviewed source revision to
`bdbb22c6888d0999f9bee1712a0296309dcab3fb` (Game Master dated October 17, 2026).
`UPSTREAM_COMPARISON_COMMIT` is the outgoing revision,
`e87448291024aff808f21a2e5f74e69f68b521df` (September 28, 2026).

These pins have different jobs: the active revision supplies runtime assets;
the outgoing revision supplies the baseline for roster update comparisons.
Fetching upstream does not advance either pin. Running sync without editing
these constants intentionally reproduces the existing bundle.

TeamLab exposes Great, Ultra, and Master League and their Mega variants.
Preserve new species, forms, moves, and upstream cup definitions in the full
Game Master, including unreleased entries. Their presence does not enable a
new UI format or make an unreleased Pokémon available. Little Cup and other
limited formats remain outside the supported format list.

## Refresh from upstream

### 1. Prepare the working branch

Use a clean working tree. For a standalone refresh, run from the repository
root, replacing the sample version and branch name with the next release:

```bash
git switch staging
git pull --ff-only origin staging
git switch -c 1.4.0/upstream-data-refresh
git fetch upstream master
git rev-parse upstream/master
git show HEAD:team-lab/src/pvpoke/season.ts
```

The `upstream` remote should point to `https://github.com/pvpoke/pvpoke.git`.
If it is not configured, add it with `git remote add upstream` and that URL.
For an existing PR stack, branch from its reviewed parent instead of starting
from `staging`; preserve the parent relationship described in
[dependency maintenance](DEPENDENCY-MAINTENANCE.md#stacking-related-pull-requests).
Do not use `git pull upstream master` as the TeamLab refresh procedure: fetching
Git objects and regenerating the owned bundle are sufficient. Updating the
retained root `src/` tree is a separate, deliberate upstream-source merge.

### 2. Review the upstream delta

Record the old active SHA before changing it. Replace `<outgoing-sha>` below
with that full SHA:

```bash
git log --oneline <outgoing-sha>..upstream/master
git diff --stat <outgoing-sha> upstream/master -- src
git diff <outgoing-sha> upstream/master -- src/data/gamemaster.json src/js/battle src/js/pokemon src/js/GameMaster.js
```

Review new/removed species and forms, release flags, stat and move changes,
rankings for all six supported formats, meta groups, and engine changes.
`src/pvpoke/assetPaths.ts` is the runtime data/engine allowlist. Changes to an
upstream PHP interface or its separate ranking generator do not automatically
require porting those interfaces into TeamLab. Changes to bundled battle
modules require reviewing TeamLab adapters and browser characterization.

### 3. Advance the two pins

Edit `team-lab/src/pvpoke/season.ts`:

- set `UPSTREAM_COMPARISON_COMMIT` to the **old active** full SHA;
- set `ACTIVE_SEASON.upstreamCommit` to the full SHA returned for the reviewed
  upstream revision;
- change season number, title, and branch only when the season itself changes.

Do not replace the outgoing pin with the new active pin: that would erase the
comparison. Keep both revisions available in Git. If source lookup fails,
fetch the configured upstream branch/history before retrying; do not substitute
an arbitrary local `src/` tree.
Fetch either pinned revision explicitly if a shallow/local checkout lacks it:

```bash
git fetch upstream <outgoing-sha>
git fetch upstream <active-sha>
```


### 4. Regenerate the runtime bundle and artwork

Use a Node line supported by `package.json`: `^22.22.0`, `^24.0.0`, or `>=26.0.0`.
Node 25 is excluded. Run from `team-lab/`:

```bash
npm ci
npm run sync:pvpoke
npm run sync:sprites
npm run validate:data
```

Sync reads all required source files and validates the JSON before overwriting
the bundle. It checks full/minified Game Master agreement, copies allowlisted
assets and the license, regenerates dashboard leaders and the roster comparison,
and writes byte sizes and SHA-256 hashes to `manifest.json`. It never writes
to the upstream checkout. Sync is deterministic for the same pins.

Artwork sync reads the **bundled** Game Master and refreshes local WebP files,
`src/generated/pokemonSprites.ts`, and the attribution/fallback report. It needs
network access to PokeAPI/artwork sources; ordinary development and production
builds use checked-in assets. Review new mappings and intentional fallbacks.

For an isolated maintenance experiment, the explicit override remains:

```bash
PVPOKE_SOURCE_DIR=/absolute/path/to/pvpoke/src npm run sync:pvpoke
```

This compares the override against the configured outgoing pin and records no
pinned destination commit. Restore a normal pinned sync before preparing a
standard release; do not describe an override bundle as the reviewed active
revision.

### 5. Adapt regressions and release metadata

Review the generated diff rather than assuming a successful copy proves
compatibility. Check missing catalog references, move legality, league/Mega
projection, rank entries/exits, dashboard leaders, and comparison dates.
`src/pvpoke/season.test.ts` contains seasonal expectations. The browser workflow
also contains deliberate dataset expectations, including the Mega Great target
count and the Zoroark roster-review example. Update those fixtures when their
reviewed upstream facts change; keep their behavioral assertions intact.

For a versioned release, run `npm version <next-version> --no-git-tag-version`
from `team-lab/` to update both package manifests. Update favicon cache versions
in `index.html`, `scripts/validate-cloudflare-artifact.ts`, and
`scripts/browser-workflows.ts`, the latest-release assertions in
`src/domain/releases/releaseNotes.test.ts`, current-version README/user-guide
text, and `docs/RELEASE-<next-version>.md`. Preserve historical release notes.
Build-generated `release.json` obtains app and data identity automatically;
do not hand-edit `dist/` or generated deployment metadata.

### 6. Validate and review visuals

From `team-lab/`:

```bash
npm run audit:security
npm run validate:workflows
npm run lint
npm run typecheck
npm test
npm run test:scale
npm run validate:data
npm run build
npm run test:production:artifact
npm run test:visual
```

The visual suite also exercises development browser workflows; the production
suite exercises the exact `dist/` artifact. Both include battle replay, the
six formats, and roster update review. Set `TEAMLAB_CHROME_PATH` if Chrome
cannot be found. See [visual review](../tests/visual/README.md).

If an expected ranking, data-date, or release-note change produces a visual
difference, inspect `artifacts/visual/*.actual.png` and `*.diff.png`. After
reviewing the change, run `npm run update:visual`, inspect changed baselines,
and rerun `npm run test:visual`. Do not refresh baselines to hide unexplained
layout or simulation changes.

### 7. Commit, open the PR, and verify the chosen preview

Commit source pins/generation changes, copied data and manifests, new artwork,
regression updates, release metadata, and documentation in reviewable groups.
Keep unrelated dependency maintenance identifiable. Push the branch and open
a PR against `staging` or its immediate stack parent.

Every PR layer runs artifact and CodeQL checks. A visual PR stack does not
select a deployment. For a complete-stack preview, apply `staging-preview` to
the top same-repository PR:

```bash
gh pr edit <top-pr-number> --add-label staging-preview
```

Dependabot-authored PRs and `dependabot/` heads are excluded even when manually
triggered by a maintainer. A successful selected preview updates
`https://staging.pvpoke-team-lab.pages.dev`; production requires a push to
`master`. Verify `release.json` identifies the expected **PR merge preview
commit**, app version, and upstream pin, and require the deployed browser check
to pass. The immutable deployment URL identifies the exact tested artifact.
See [deployment builds](DEPLOYMENT-BUILDS.md) and
[Cloudflare deployment](CLOUDFLARE-DEPLOYMENT.md).

## Adding another format

Before exposing another cup or league in the UI:

1. add its ranking and group paths to `src/pvpoke/assetPaths.ts` and the sync
   script’s validation/generation logic;
2. add the corresponding typed model/configuration;
3. extend validation and catalog tests;
4. run the full refresh and validation sequence above.

Keeping the file allowlist explicit prevents the deployment bundle from
silently growing to include PvPoke datasets that TeamLab cannot use.

## Deployment contract

The Vite build copies `public/vendor/pvpoke/` into `dist/vendor/pvpoke/`.
All data and engine URLs are resolved beneath Vite’s configured base path, so
subpath deployments only need `VITE_BASE_PATH`. No PvPoke URL, reverse proxy,
or second service is part of the runtime configuration.

PvPoke attribution remains in TeamLab’s footer, and the redistributed source
license is included at `public/vendor/pvpoke/LICENSE`.

## Advancing the active season

Update `src/pvpoke/season.ts` to the reviewed upstream branch and full commit
SHA, and set `UPSTREAM_COMPARISON_COMMIT` to the outgoing pinned revision.
Then sync data, engine, and sprites together. The manifest records the
pinned season and source revision; release metadata also identifies the season.
Update seasonal regression expectations and review visual diffs when rankings
change. Keep browser simulations in the release gate: season transitions can
change battle timing as well as move stats. Asset URLs include the pinned
revision to invalidate outgoing-season browser caches.

## 1.3.0 refresh review

The October 17 snapshot adds nine Shadow forms and Hisuian Sliggoo/Goodra,
marks Bramblin, Brambleghast, and Mega Camerupt released, and adds elite Sucker
Punch to Zoroark. Upstream also removes the duplicate `golisopodsh` entry;
`golisopod` and `golisopod_shadow` are the canonical entries in this snapshot.
The catalog now contains 1,751 entries and 352 moves. Move definitions are
unchanged from the preceding pin.

All six supported overall ranking files changed. Open Great/Ultra/Master
contain 1,153/850/409 entries; Mega Great/Ultra/Master contain 1,210/912/470.
Dashboard leaders are regenerated from those files. All six meta groups and
all ten bundled engine scripts are unchanged byte-for-byte. Upstream changes
to its ranking generator and Little Cup interfaces do not require changes to
TeamLab’s simulation adapters or supported format list.

Sprite synchronization adds exact artwork for the three newly released
Pokémon; existing Hisuian artwork and shared base artwork cover the other
additions. The artwork manifest contains 1,134 species/form mappings.

The release also patches Sharp to 0.35.5 (including its transitive override)
and source-map-js to 1.2.2 to satisfy the security audit gate. Run maintenance
commands on a supported Node release, as declared in `package.json`.

The original upstream-only refresh validation on Node 24.21.0 passed: 174 unit tests, the 120-record scale
characterization, lint, TypeScript, workflow validation, data/hash validation,
security audit (zero vulnerabilities), and the public production build.
Chrome workflows passed against both the production artifact and development
server, including all six formats, Top-250 Mega targeting, recommendations,
battle replay, persistence, and backup/restore. All 15 reviewed visual
snapshots passed verification. These counts precede the roster-review and CI
policy additions; use current command output for the present suite size.

## Roster update comparison artifact

`npm run sync:pvpoke` also generates `data/update-review.json`, covered by the
bundle manifest and `validate:data`. It compares the explicit outgoing pin with
the active pin across all six supported overall rankings and the Game Master.
It records ranking entries/exits, position changes, recommended moves, species
additions/removals, release state, base stats, typing, level bounds, default IVs,
move availability, Elite TM availability, and combat move-stat changes.

The outgoing pin must remain available in local Git objects. Repeated syncs do
not choose a new baseline from the working directory, so the comparison remains
deterministic. A source-directory override compares that checkout against the
same outgoing pin and records a null destination commit rather than claiming
that the override matches the production revision.

The UI matches this public comparison against local inventory and validates
current references using the selected league catalog. It does not upload roster
data or infer missing historical snapshots. Team analysis freshness uses both
the Game Master data version and pinned upstream commit, because rankings can
change without a new Game Master timestamp.

For a focused Chrome check (also included in the full browser workflows):

```bash
npm run test:browser -- --roster-updates
npm run test:production:artifact -- --roster-updates
npm run test:visual -- --roster-updates
```
