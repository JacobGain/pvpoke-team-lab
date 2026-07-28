# Fork Structure Breakdown

## Purpose

This repository contains two conceptually separate applications:

1. The original open-source PvPoke application.
2. The fork-specific Team Lab application for inventory management, team recommendations, and meta simulation.

The goal of this structure is to let the original project continue receiving upstream updates while the Team Lab application evolves independently. New application code should be additive and should not require routine edits to upstream-owned files.

The central rule is:

> Treat the existing `src/` directory as upstream-owned code and place all new product code under `team-lab/`.

This separation minimizes merge conflicts, makes ownership immediately visible, and prevents fork-specific storage or UI concerns from leaking into the original application.

## Repository-level structure

```text
pvpoke-team-lab/
├── src/                            # Existing upstream PvPoke application
│   ├── js/
│   ├── data/
│   ├── modules/
│   ├── train/
│   ├── gm-editor/
│   ├── articles/
│   └── ...
│
├── team-lab/                       # New fork-specific application
│   ├── public/
│   │   └── assets/
│   │
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   │   ├── inventory/
│   │   │   ├── recommendations/
│   │   │   ├── teams/
│   │   │   ├── simulations/
│   │   │   ├── meta/
│   │   │   └── settings/
│   │   │
│   │   ├── domain/
│   │   │   ├── inventory/
│   │   │   ├── pokemon/
│   │   │   ├── teams/
│   │   │   └── recommendations/
│   │   │
│   │   ├── pvpoke/
│   │   │   ├── bootstrap/
│   │   │   ├── adapters/
│   │   │   ├── repositories/
│   │   │   ├── serializers/
│   │   │   └── types/
│   │   │
│   │   ├── components/
│   │   ├── storage/
│   │   ├── workers/
│   │   └── styles/
│   │
│   ├── tests/
│   │   ├── adapters/
│   │   ├── fixtures/
│   │   ├── integration/
│   │   └── unit/
│   │
│   ├── scripts/
│   │
│   └── docs/
│       ├── architecture/
│       ├── data-model/
│       └── Fork-Structure-Breakdown.md
│
├── docker/                         # Existing upstream Docker setup
├── Makefile                        # Fork-owned convenience commands
├── FULL-SUMMARY.md                 # Existing-codebase reference
└── README.md                       # Existing upstream project documentation
```

No application scaffolding, configuration, package manifest, or placeholder source files are implied by the presence of these directories. Tooling and implementation choices can be made later without needing to reorganize the ownership boundary.

## Ownership boundaries

### Upstream-owned area

The following paths should be treated as belonging to the original PvPoke project:

```text
src/**
docker/Dockerfile
docker/docker-compose.yml
README.md
LICENSE
```

Upstream-owned does not mean these files can never be changed. It means changes to them should be exceptional, deliberate, minimal, and documented. Routine Team Lab development should not require edits to these paths.

In particular, avoid:

- placing new Team Lab pages directly in `src/`;
- adding inventory fields to upstream Game Master records;
- storing user inventory under `src/data/`;
- rewriting upstream interface files for the new UI;
- copying and modifying `Pokemon.js`, `Battle.js`, or `TeamRanker.js`;
- adding Team Lab styling to upstream CSS;
- using upstream PHP modules as the main layout system for the new application.

Keeping `src/` close to upstream means Git can normally apply future changes there without encountering unrelated Team Lab edits.

### Fork-owned area

The following paths belong to this fork:

```text
team-lab/**
Makefile
FULL-SUMMARY.md
```

Future fork-specific Docker overrides, top-level documentation, scripts, or automation should also be clearly named and kept outside upstream-owned paths.

### Generated upstream-derived assets

The authoritative upstream artifacts remain under:

```text
src/data/gamemaster.min.json
src/data/rankings/**
src/data/groups/**
src/data/training/**
```

Team Lab never modifies those files. Its deterministic sync command validates
and copies the runtime subset it consumes into:

```text
team-lab/public/vendor/pvpoke/**
```

These generated copies are fork-owned deployment inputs and can be overwritten
after a future upstream pull. The source tree remains upstream-owned and free
of Team Lab changes.

Fork-specific persistent data must not be written into those directories. User inventory, recommendation preferences, saved teams, cached calculations, and application migrations belong to Team Lab’s own storage layer.

## `team-lab/public/`

```text
team-lab/public/
└── assets/
```

This is the future browser-facing application root.

It can eventually contain:

- the HTML entry point or generated build output;
- favicons and application manifest;
- images unique to Team Lab;
- static files that do not pass through the source build;
- generated frontend bundles, depending on the selected toolchain.

`public/assets/` contains fork-owned artwork. `public/vendor/pvpoke/` is the
explicit exception for generated, licensed runtime inputs copied by
`scripts/sync-pvpoke-assets.ts`. Its manifest records exact hashes and source
paths so duplication is deliberate and refreshable rather than ad hoc.

The public directory should not contain domain logic, source components, or
database code.

## `team-lab/src/app/`

This directory will contain application-wide composition:

- startup/bootstrap code;
- routing;
- top-level layouts and navigation;
- dependency construction;
- application providers;
- global error handling;
- feature registration;
- environment/configuration access.

The `app` layer may connect features, but it should not own inventory rules, battle calculations, or PvPoke compatibility details.

Keeping composition here prevents the eventual entry point from becoming a mixture of routing, persistence, simulation, and UI code.

## `team-lab/src/features/`

Feature directories organize code by user-visible capability. Each feature may eventually contain its own screens, view models, components, hooks/controllers, validation, and feature-specific tests.

### `features/inventory/`

The inventory experience:

- adding and editing owned Pokémon;
- bulk import;
- search and filtering;
- tagging, favoriting, and grouping;
- league readiness;
- move ownership;
- upgrade requirements and cost presentation.

This feature consumes the inventory domain and storage interfaces. It should not persist upstream `Pokemon` objects directly.

### `features/recommendations/`

The recommendation experience:

- selecting a league or cup;
- choosing recommendation objectives;
- producing candidate teams from owned Pokémon;
- presenting multiple trade-offs;
- explaining threats, alternatives, and assumptions;
- identifying missing moves or upgrades;
- linking recommendations to detailed simulations.

Recommendation UI should consume immutable recommendation results from the domain/application layer. It should not directly manipulate `TeamRanker` globals.

### `features/teams/`

Saved and constructed team workflows:

- manual team building;
- saved teams;
- team comparison;
- role assignment;
- legality checks;
- import/export;
- opening teams in upstream PvPoke tools.

### `features/simulations/`

Simulation-specific UI:

- exact owned-build matchups;
- team-versus-meta analysis;
- shield and energy assumptions;
- simulation progress;
- result inspection;
- links to the existing PvPoke Battle and Team Builder pages.

The feature calls a fork-owned simulation interface. The implementation of that interface belongs behind the `pvpoke/` boundary or in workers.

### `features/meta/`

Meta selection and exploration:

- loading published PvPoke groups and rankings;
- custom threat groups;
- cup/format selection;
- meta snapshots;
- usage or ranking weights;
- choosing the field against which recommendations are evaluated.

### `features/settings/`

Fork-specific preferences:

- recommendation defaults;
- storage/export controls;
- simulation performance settings;
- cost assumptions;
- preferred leagues;
- application theme and accessibility choices;
- data/version information.

These settings are distinct from the upstream PvPoke settings cookie. Team Lab can expose upstream-compatible options through adapters where needed, but its product state should not be coupled to the old cookie schema.

## `team-lab/src/domain/`

The domain directories hold fork-owned business concepts. This layer should be as independent as practical from UI frameworks, browser globals, PHP routes, and mutable PvPoke engine objects.

### `domain/inventory/`

The authoritative model of owned Pokémon and inventory operations.

A future inventory record will likely need:

```text
InventoryPokemon
├── inventoryId
├── speciesId
├── formId
├── shadowState
├── nickname
├── level
├── cp
├── attackIv
├── defenseIv
├── hpIv
├── fastMove
├── chargedMoves
├── secondMoveUnlocked
├── tags
├── favorite
├── acquiredAt
└── updatedAt
```

`inventoryId` must be distinct from `speciesId`. A player can own multiple specimens and multiple builds of one species.

Calculated values such as effective stats, league eligibility, stat product, and XL requirements should generally be derived from game data rather than treated as permanent truth.

### `domain/pokemon/`

Fork-owned, engine-neutral Pokémon concepts:

- species references;
- owned build definitions;
- IV values;
- levels and league limits;
- move selections;
- Shadow/Purified state;
- calculated build summaries.

These objects should not include temporary battle state such as current HP, current energy, shields, cooldown, or stat stages.

### `domain/teams/`

Team concepts and rules:

- team identity;
- members and positions;
- role labels;
- format legality;
- duplicate restrictions;
- team comparison;
- saved-team metadata.

### `domain/recommendations/`

Recommendation inputs, objectives, and outputs:

- recommendation request;
- eligible candidate set;
- scored team candidate;
- optimization objective;
- required upgrades;
- uncovered threats;
- explanation/evidence;
- ranking and simulation assumptions.

This layer should distinguish:

- the strongest theoretical species;
- the strongest build the user owns;
- the strongest immediately usable team;
- the strongest team after affordable upgrades.

## `team-lab/src/pvpoke/`

This is the most important future-proofing boundary.

Only code in this directory should have detailed knowledge of upstream PvPoke file locations, global constructors, mutable object behavior, ranking JSON shapes, or URL encodings.

The intended dependency direction is:

```text
Team Lab feature/domain code
        ↓
Fork-owned interfaces
        ↓
team-lab/src/pvpoke/
        ↓
Upstream src/js and src/data
```

Team Lab features should not skip this layer and reach directly into upstream internals.

### `pvpoke/bootstrap/`

The upstream JavaScript is not packaged as importable modules. It depends on browser globals, jQuery, and script ordering.

The bootstrap layer may eventually:

- load upstream scripts in the required order;
- establish `host`, `webRoot`, `siteVersion`, `settings`, and `get`;
- make jQuery available where required;
- initialize the Game Master;
- detect load failures;
- verify that required constructors and methods exist;
- expose a readiness promise to the new application.

The script order will likely include selected core files rather than upstream UI files:

```text
GameMaster.js
Pokemon.js
DamageCalculator.js
ActionLogic.js
TimelineEvent.js
TimelineAction.js
Battle.js
TeamRanker.js
```

Avoid loading large upstream interface files unless a specific calculation genuinely depends on them. Those files frequently combine DOM behavior and application state.

### `pvpoke/adapters/`

Adapters translate between fork-owned domain values and upstream objects.

Likely adapters include:

- inventory build to upstream `Pokemon`;
- fork battle settings to upstream `Battle`;
- upstream battle result to immutable Team Lab matchup result;
- Team Lab team/meta inputs to `TeamRanker`;
- upstream cup eligibility to Team Lab eligibility results;
- upstream move and form metadata to stable fork-owned views.

The key lifecycle should be:

```text
Persistent InventoryPokemon
    → PvPoke adapter
    → temporary mutable Pokemon
    → Battle or TeamRanker
    → immutable fork-owned result
```

Never save a live upstream `Pokemon` instance as inventory. It contains mutable combat state and can be reset or altered during simulations.

### `pvpoke/repositories/`

Repositories provide narrow read APIs over upstream data:

- Game Master repository;
- ranking repository;
- meta-group repository;
- format/cup repository;
- training-data repository, if needed.

For example, feature code should ask a ranking repository for a league/cup/category instead of constructing:

```text
/pvpoke/src/data/rankings/<cup>/<category>/rankings-<cp>.json
```

in multiple places.

This centralizes paths, caching, schema validation, ranking aliases, and data-version reporting.

### `pvpoke/serializers/`

Serializers handle reusable data encodings:

- compact Pokémon build strings;
- moveset strings;
- group import/export formats.

Domain models should not become coupled to legacy URL syntax, and TeamLab
does not expose upstream Battle or Team Builder links.

### `pvpoke/types/`

Types or schemas describing the external boundary:

- Game Master records;
- cup and format definitions;
- ranking rows;
- group entries;
- battle result values;
- global constructor declarations.

These descriptions are compatibility contracts, not fork-owned domain models. Keeping them separate makes upstream schema changes visible.

Runtime schema validation may eventually be appropriate because TypeScript types alone cannot protect against changed JSON.

## `team-lab/src/components/`

Reusable, presentation-focused UI:

- inputs and buttons;
- modals;
- tables and cards;
- Pokémon icons and build summaries;
- team slots;
- score visualizations;
- loading and error states.

Components used by only one feature should remain inside that feature. This directory is for genuinely shared UI, not a dumping ground for application logic.

These components should be newly owned by Team Lab. Reusing upstream calculation logic does not require inheriting the upstream DOM or CSS architecture.

## `team-lab/src/storage/`

The persistence boundary for:

- inventory;
- saved teams;
- custom meta groups;
- recommendation preferences;
- cache metadata;
- import/export and migrations.

A browser-only first version may use IndexedDB or local storage. Even then, persistence should have:

- an explicit schema version;
- validation;
- migrations;
- backup/export;
- import conflict rules;
- quota and corruption handling.

Features should use repository interfaces rather than calling `localStorage` directly. That makes a later account-backed or synchronized implementation possible without rewriting every UI.

The upstream custom-group and Game Master local-storage patterns are useful references, but their informal formats should not be adopted as the new inventory database.

## `team-lab/src/workers/`

Ranking, matrix, and team recommendation work can be computationally expensive. This directory is reserved for Web Workers or equivalent background processing.

Potential worker responsibilities:

- exact matchup batches;
- candidate team generation;
- static matchup-matrix construction;
- recommendation scoring;
- long-running imports or recalculations.

Keeping this boundary available avoids locking the new UI into main-thread simulation. Worker request/response messages should use fork-owned immutable values, not live upstream objects.

## `team-lab/src/styles/`

Application-wide Team Lab styling:

- design tokens;
- themes;
- resets;
- layout primitives;
- accessibility rules;
- global responsive behavior.

Feature-specific styles should remain with their features where the chosen framework supports that organization.

Do not edit upstream `src/css` merely to style Team Lab. This keeps the visual redesign completely independent from upstream theme changes.

## `team-lab/tests/`

### `tests/adapters/`

Compatibility and characterization tests for the PvPoke boundary:

- converting owned builds to upstream Pokémon;
- selecting levels, IVs, moves, and Shadow state;
- cup eligibility;
- known matchup outputs;
- TeamRanker result translation;
- Game Master and ranking schema checks.

These are the highest-value tests for safe upstream updates.

### `tests/fixtures/`

Small, deliberate snapshots used by tests:

- a few Pokémon;
- representative moves;
- one or two cups;
- small ranking groups;
- expected matchup results.

Do not copy the complete upstream dataset into fixtures. Full copies create large diffs and make it unclear what a test actually needs.

Fixtures should state which upstream version or commit they represent.

### `tests/integration/`

Cross-layer tests:

- inventory record to simulated matchup;
- inventory filtering by cup;
- meta loading to recommendation;
- saved team to Team Builder link;
- storage migration to usable domain records.

### `tests/unit/`

Framework-independent domain behavior:

- inventory validation;
- team legality;
- candidate pruning;
- scoring and objective weighting;
- cost calculations;
- recommendation explanations.

## `team-lab/scripts/`

Fork-owned maintenance and developer scripts:

- validating upstream data contracts;
- generating small fixtures;
- benchmarking simulation batches;
- importing supported inventory formats;
- checking upstream compatibility;
- build/release support.

Scripts that alter upstream data should not be added casually. Dataset compilation remains an upstream responsibility unless Team Lab deliberately introduces a separate pipeline.

## `team-lab/docs/architecture/`

Reserved for focused architecture decisions and diagrams.

Useful future documents include:

- application architecture;
- PvPoke adapter contract;
- recommendation pipeline;
- simulation execution model;
- frontend framework decision;
- backend/account architecture, if introduced;
- Architecture Decision Records.

## `team-lab/docs/data-model/`

Reserved for:

- inventory schema;
- saved-team schema;
- recommendation result schema;
- persistence migrations;
- import/export formats;
- cache-key design;
- data retention and privacy rules.

## Dependency rules

The desired dependency flow is:

```text
features ───────→ domain
   │                ↑
   ├────────────→ storage interfaces
   │
   └────────────→ fork-owned simulation/data interfaces
                         │
                         ↓
                      pvpoke
                         │
                         ↓
                  upstream src/js + src/data
```

Avoid these dependencies:

```text
domain → UI framework
domain → browser DOM
domain → upstream globals
features → upstream JSON paths
features → localStorage/IndexedDB directly
features → mutable upstream Pokemon objects
upstream src/** → team-lab/**
```

The final rule is especially important: upstream files should not import or require Team Lab. The new application depends on upstream, never the other way around.

## Recommendation pipeline

The planned product should not brute-force every possible owned team against every meta opponent from the start.

A scalable pipeline is:

1. Load the upstream data version, format, cup, rankings, and meta group.
2. Normalize owned inventory builds.
3. Calculate build eligibility for the chosen format.
4. Rank individual candidates using published rankings and ownership readiness.
5. Apply user constraints, resource limits, and duplicate rules.
6. Preserve useful type and role diversity while shortlisting.
7. Generate plausible team combinations.
8. Pre-score candidates using static ranking or matchup information.
9. Run exact `Battle` or `TeamRanker` simulations for finalists.
10. Produce several recommendations for different objectives.
11. Explain moves, IV assumptions, upgrades, strengths, and uncovered threats.
12. Expose matchup evidence for inspection inside TeamLab.

The recommendation domain owns this orchestration. The PvPoke adapter supplies calculations but should not decide the product’s recommendation policy.

## Matchup caching

Simulation caching must include the complete battle context. A safe conceptual cache key is:

```text
upstream data version
+ cup and CP/level cap
+ subject species, form, Shadow state, level, IVs, and moves
+ opponent species, form, Shadow state, level, IVs, and moves
+ shields, energy, HP, buffs, bait, timing, and decision settings
```

Caching only by species ID is incorrect because owned builds and simulation conditions materially change outcomes.

Cache records should also contain the engine/data version so an upstream dataset or mechanics update can invalidate stale results.

## Docker and local development

The existing upstream Docker files should remain untouched where possible.

A future fork-owned overlay may be added as:

```text
docker/docker-compose.lab.yml
```

The root Makefile could then combine:

```text
docker/docker-compose.yml
docker/docker-compose.lab.yml
```

The overlay could mount or serve `team-lab/public/` without rewriting the upstream service definition.

Possible local routes:

```text
/pvpoke/src/   Existing upstream application
/lab/          New Team Lab application
```

If a frontend development server is selected later, the overlay can add a separate `lab` service. No decision is required at the folder-creation stage.

## Upstream synchronization

The Git repository should eventually have:

```text
origin      The Team Lab fork
upstream    The original PvPoke repository
```

A typical update flow will be:

```bash
git fetch upstream
git merge upstream/master
```

or the corresponding upstream default branch.

Because Team Lab work is isolated under new paths, upstream changes should normally apply to `src/` without overlapping Team Lab changes.

After an upstream merge:

1. Record the new upstream commit and Game Master timestamp.
2. Validate Game Master, rankings, formats, cups, and group schemas.
3. Run adapter contract tests.
4. Run a small set of fixed characterization battles.
5. Test at least one team evaluation.
6. Build and start Team Lab.
7. Smoke-test inventory loading and one recommendation.
8. Invalidate versioned calculation caches if required.
9. Document compatibility adjustments.

## Characterization tests

The upstream engine has no conventional automated test suite in this repository. Team Lab should protect itself by recording expected behavior at the adapter boundary.

A small characterization set should cover:

- a neutral matchup;
- super-effective and resisted damage;
- dual-type effectiveness;
- a Shadow Pokémon;
- different IV builds;
- bait and no-bait cases;
- shields and starting energy;
- a stat-buffing or debuffing move;
- a form-changing Pokémon;
- CMP;
- a complete TeamRanker result;
- cup eligibility filters.

The purpose is not to declare that upstream can never change. It is to make changed behavior explicit during an update.

## Handling unavoidable upstream modifications

If a future requirement cannot be supported through the compatibility layer:

1. Confirm that an adapter, wrapper, event, or fork-owned loader cannot solve it.
2. Keep the upstream patch as small as possible.
3. Avoid combining formatting or refactoring with the functional change.
4. Mark and document the reason.
5. Record the upstream baseline commit.
6. Add a test that depends on the patch.
7. Re-evaluate the patch after upstream updates.

A future `team-lab/docs/upstream-patches.md` can record:

```text
Upstream file
Purpose
Baseline commit
Patch summary
Compatibility risk
Test coverage
Removal path
```

Do not maintain copied versions of core engine files. A private copy of `Battle.js` or `Pokemon.js` would miss new moves, forms, timing mechanics, and upstream fixes.

## Data-version transparency

Every recommendation should eventually expose:

- Game Master timestamp or version;
- selected cup and league;
- level cap;
- ranking/meta source;
- assumed moves;
- IV and level assumptions;
- shield and energy assumptions;
- whether results came from static rankings or fresh simulations;
- outstanding upgrade requirements.

This allows users to understand why an inventory-based result may differ from the theoretical upstream ranking.

## Persistence future-proofing

The initial application can remain local-only. The storage layer should nevertheless be designed so a later backend does not require rewriting features.

Local persistence should have:

- unique inventory record IDs;
- schema versioning;
- migrations;
- validation;
- explicit import/export;
- backup guidance;
- conflict behavior;
- error and quota handling.

Cross-device synchronization would introduce:

- accounts and authentication;
- authorization;
- a server-side inventory database;
- synchronization and conflict resolution;
- privacy, deletion, and data export requirements;
- rate limiting and abuse prevention.

Those concerns should remain in fork-owned services. They should never be added to upstream training or ranking write endpoints.

## Why the existing UI should not be reused wholesale

Upstream selector and interface files demonstrate useful behavior, but many combine:

- DOM rendering;
- event binding;
- local storage;
- URL serialization;
- battle object mutation;
- data loading;
- result presentation.

Loading those entire interfaces into Team Lab would reproduce their coupling and constrain the new visual design.

Prefer:

- reusing the Game Master and battle engine;
- studying existing selectors for required behavior;
- preserving compatible IDs and serializers where useful;
- building new Team Lab components over fork-owned models.

This provides full UI freedom while retaining calculation compatibility.

## Initial implementation sequence

When application work begins, a low-risk order is:

1. Select and configure the Team Lab frontend toolchain.
2. Add a minimal application entry and routing.
3. Define upstream JSON types and repositories.
4. Define the inventory domain model.
5. Add versioned local persistence.
6. Build inventory entry, import, and search.
7. Add the PvPoke bootstrap.
8. Adapt exact owned builds into temporary upstream Pokémon.
9. Wrap one-on-one battle simulation.
10. Add adapter characterization tests.
11. Wrap TeamRanker and meta groups.
12. Implement recommendation candidate selection.
13. Move expensive batch calculations into workers.
14. Add recommendation explanations and in-app matchup inspection.

## Git and empty directories

Git does not track empty directories. The folder hierarchy exists in the working directory now, but directories will only appear in commits after real files are added to them.

No placeholder `.gitkeep` files have been added because the current requirement is to create folders without creating other files. This architecture document is the only file added as part of the structure setup.

## Summary

The repository is organized around a strict additive boundary:

```text
src/        Upstream engine, data, pages, and tools
team-lab/   Fork-owned product, domain, UI, storage, and compatibility code
```

All fork-owned design and operational knowledge lives within
`team-lab/docs/`, keeping the entire fork application boundary self-contained.

The `pvpoke/` compatibility layer is the seam that allows Team Lab to reuse the original simulator while protecting new features from its global, mutable, and UI-coupled implementation.

If this boundary is maintained, most upstream updates will affect only `src/`. Team Lab should need changes only when an upstream data or engine contract used by an adapter has actually changed. That makes future synchronization predictable, testable, and far less conflict-prone.
