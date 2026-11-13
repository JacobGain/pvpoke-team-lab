# TeamLab 1.4.0 implementation and release plan

Status: **In progress**. Baseline: TeamLab 1.3.2 on `staging`; implementation
branch: `1.4.0/super-mega`. See the
[phase record](implementation/phase-11-super-mega/README.md) for implemented
behavior and validation. This plan is not a declaration of release readiness.

## Objective and release boundary

Deliver full Super Mega build support across inventory, analysis, simulations,
recommendations, saved teams, backup/import, and battle replay. Users must be
able to select a legal Mega level and extra charged attack without any workflow
silently dropping or changing those settings.

The release includes a separately reviewed attempt to resolve the ten moderate
development-tool findings reported for 1.3.2. Recheck the actual findings before
making dependency changes; the historical count is not a current audit result.
Track the Minior calculation concern with a reproducible characterization.
Limited cups, including LAIC, remain a separate feature. Preserve their upstream
definitions while retaining exactly the existing six TeamLab formats.

Release success means parity with **identically configured pinned upstream
battles**, not a promise to reproduce published ranking positions. Rankings can
use different opponent pools, IVs, shielding, and scoring assumptions.

## Protocols and baseline evidence

Follow [release notes](RELEASES.md), [dependency maintenance](DEPENDENCY-MAINTENANCE.md),
[asset maintenance](PVPOKE-DATA.md), [deployment](CLOUDFLARE-DEPLOYMENT.md),
[build targets](DEPLOYMENT-BUILDS.md), [security operations](SECURITY-OPERATIONS.md),
and the [implementation documentation guide](implementation/DOCUMENTATION-GUIDE.md).

The initial source review found:

- Runtime data and engine are pinned to
  `a9dfd500421cacf2842d54d8adcb15830c1eef2b` in `src/pvpoke/season.ts`.
  Merging the repository's upstream `src/` tree does not refresh the runtime bundle.
- Bundled `Pokemon.js` defaults Mega level to 3, or 4 for `supermega` tags;
  `setMegaLevel` can change level to 52/50 in uncapped battles. Initialization
  also changes level caps for Mega level 4. These operations are order-sensitive.
- The extra attack is selected with `selectMove("extra-charged", id, 2)` from
  `extraChargedMovePool`. `hasThirdChargedMove()` checks the `mega` tag, so this
  feature must cover eligible ordinary Megas as well as Sableye and Chandelure.
- `DamageCalculator.js` applies the Mega-level multiplier to marked Mega moves.
  Do not multiply every charged attack or duplicate upstream damage arithmetic.
- `inventory/schemas.ts` allows at most two charged moves;
  `simulation/contracts.ts`, `simulation/buildSerialization.ts`,
  `simulation/teamRanker.ts`, `features/simulation/duelBuild.ts`, and
  `recommendations/history.ts` also assume one or two ordinary attacks.
- `configurePvpokePokemon` is already shared by duel and TeamRanker adapters.
  Extend this boundary rather than implementing two configuration sequences.
- CP inference stops at 51, while simulation requests and TeamRanker settings
  use level 50. Updating only move fields would leave incorrect Super Mega stats.
- Existing Mega meta groups contain three charged attacks. Default opponents
  must receive the same support as owned Pokémon.
- Current schema versions are database 4, backup 3, inventory record 1, saved
  team 1. Backup restoration already supports older envelopes and atomic writes.
- The roster comparison omits changes to `extraChargedMoves` and tags.

Paths above are under `team-lab/src/` unless stated otherwise. Engine evidence
comes from `team-lab/public/vendor/pvpoke/js/`; use the pinned engine as the
runtime authority and the upstream interface as supporting configuration evidence.

## 1. Characterize upstream behavior and freeze the contract

Before changing production contracts:

1. Record the baseline checks and dependency audit using a supported Node/npm
   installation. Record failures separately from new regressions.
2. Build a source-backed behavior table for Mega levels 1–4, ordinary Megas,
   `supermega` forms, Primals, non-Megas, and all three CP limits. Confirm which
   combinations upstream actually permits; do not infer eligibility from names.
3. Characterize extra-pool legality, optional/empty slots, duplicate handling,
   default move selection, Mega-move markers, and bonus rounding. Include a
   one-ordinary-attack build with an extra attack so array compaction cannot
   accidentally put the special attack in the second ordinary slot.
4. Establish the mapping between owned/base Pokémon level, evolved battle
   level, Mega level, and CP at capped and uncapped limits. Verify switching
   into and out of level 4, initialization, IV application, and TeamRanker
   settings/cloning. Explicitly resolve any Best Buddy interaction from source
   and real-engine tests rather than assuming level 53 support.
5. Capture direct-upstream fixtures before adapting TeamLab, including source
   revision, engine hashes, complete inputs, configuration order, and outputs.

**Deliverable:** a reviewed behavior table, proposed contract, and direct-engine
fixture harness. Any unresolved rule that changes saved data or simulation
results blocks the relevant implementation slice.

## 2. Catalog, capabilities, and roster change detection

Owning files: `src/pvpoke/types/schemas.ts`,
`src/pvpoke/adapters/buildPokemonCatalog.ts`, `src/domain/pokemon/catalog.ts`,
`scripts/pvpoke-update-review.ts`, `src/pvpoke/types/updateReview.ts`, and
`src/domain/updates/rosterReview.ts`.

- Validate and normalize extra charged-move IDs, eligibility tags, and relevant
  move metadata into explicit catalog capabilities. Preserve raw upstream data.
- Keep ordinary and extra move pools distinct. Expose shared capability and
  legality helpers for UI, import, analysis, and simulation validation.
- Preserve all recommended attack IDs and their slot roles when normalizing
  rankings and meta groups. Surface an actionable diagnostic for unsupported
  or invalid source builds instead of silently trimming them.
- Extend roster review to report relevant tag/capability and extra-pool changes,
  including newly legal and removed extra attacks affecting owned/planned builds.
  Version the generated artifact if its contract requires it; regenerate through
  the existing sync pipeline and update manifest hashes, never by hand.
- Retain the existing upstream pin unless characterization proves a required
  upstream fix is missing. Any pin advancement gets its own explicit review,
  comparison baseline, deterministic sync, sprites, and data/hash validation.

**Acceptance:** Sableye/Chandelure and eligible existing Megas expose the correct
pools; extra attacks never appear as ordinary options; format count remains six.

## 3. Build contracts, persistence, and compatibility

Owning areas: `src/domain/inventory/`, `src/domain/analysis/`,
`src/domain/simulation/contracts.ts`, `src/domain/teams/`,
`src/domain/recommendations/history.ts`, `src/domain/backup/`,
`src/domain/schemaVersions.ts`, and `src/infrastructure/` repositories.

Preferred representation, to confirm against step 1: preserve
`chargedMoveIds` as one or two **ordinary** attacks, add a distinct optional
`extraChargedMoveId`, and carry an explicit applicable `megaLevel` (1–4).
This models three attacks without losing slot identity when ordinary slot 2 is
empty. Use the same semantic representation in persisted and exact builds.

- Store settings at the build context that owns them: current and planned
  builds must be independently representable. Define how these settings resolve
  through the existing base-species/`megaSpeciesId` transformation model.
- Centralize context-aware validation: applicable Mega level, form/format
  eligibility, ordinary versus extra pools, duplicates, CP, and level legality.
  Do not impose a Super-Mega-only restriction on every third attack.
- Distinguish explicit user choices from upstream defaults. Legacy records must
  retain entered CP, IVs, moves, IDs, timestamps, and team references. Do not add
  a recommended extra attack or change CP automatically during migration.
- Document a deterministic legacy policy: derive the former engine-default
  Mega level for applicable records, retain absent extra attacks, and flag CP/
  level combinations needing review. Ambiguous CP-to-level inference still
  requires a selection; migration must not invent an exact level.
- Plan inventory record v2, backup envelope v4, and database v5 for explicit
  migration. Confirm these versions after the final contract review. Keep saved
  team v1 if it continues to store references without new build fields; bump it
  only if its own persisted shape changes.
- Preserve explicit v1/v2/v3 backup readers before adding v4. Do not merely
  change a constant used by the existing v3 schema. Normalize old inventory and
  history snapshots through version-specific readers before current validation.
- Migrate IndexedDB atomically and idempotently. Test upgrades from each
  supported existing database version. Unsupported future records/envelopes
  must be rejected before any write, never stripped into a valid-looking build.
- Extend recommendation-history snapshots and their reader compatibility;
  preserve old run assumptions and identify historical results as historical.
- Include Mega level and the extra attack in identity, duplicate detection,
  cache/query keys, stale-analysis fingerprints, history, and build comparisons.
  Ordered slot identity must survive serialization.

**Acceptance:** existing inventory and references survive upgrade; new settings
survive reload, repository reads, merge/replace restore, and history reopening;
invalid restores leave all collections unchanged.

## 4. CP, level inference, and analysis

Owning files: `src/domain/pokemon/combatPower.ts`, `src/domain/pokemon/xl.ts`,
`src/domain/analysis/ivRankings.ts`, `buildAnalysis.ts`, `matchupBuildPlanning.ts`,
`matchupThresholds.ts`, and `src/domain/inventory/leagueEligibility.ts`.

- Add the pinned engine's required CP multipliers and capability-aware level
  limits. Keep ordinary builds under their existing limits; do not globally
  raise every Pokémon or format to 52.
- Apply the characterized owned-level to battle-level mapping once. Keep power-up
  costs/XL requirements tied to the owned build rather than treating an effective
  Mega bonus as an ordinary purchasable power-up.
- Carry settings through IV ranking, effective stats, CP inference, exact-build
  serialization, threshold calculations, and current/planned comparisons.
- Show the effective battle level and CP assumptions clearly. Changing Mega
  level must invalidate dependent calculations and explain newly illegal builds.

**Acceptance:** capped and uncapped results match direct upstream calculations;
level 4 transitions do not double-apply a bonus; ordinary regression cases pass.

## 5. Editors, CSV, and visible build summaries

Owning areas: `src/features/inventory/`, `src/domain/inventory/csvImport.ts`,
`src/features/simulation/DuelPage.tsx`, `duelBuild.ts`,
`src/features/analysis/`, `src/features/teams/`, and recommendation screens.

- Provide consistent accessible Mega-level selection and a separately labeled
  extra-attack selector populated only from the legal extra pool. Reuse shared
  helpers/components across inventory, bulk entry, duel, and build planning.
- Support independent current/planned editing and existing Mega-form selection.
  Refresh legal options when species, form, or format changes; explain any
  invalidated selection before saving rather than silently discarding it.
- Preserve one/two ordinary attack workflows. Explicitly support clearing the
  extra slot and test that it stays empty after save and simulation.
- Extend CSV mapping, templates, row previews, validation, and duplicate keys
  with optional Mega-level and extra-attack columns. Old CSV files still import;
  invalid cells produce row-specific errors without partial silent conversion.
- Display relevant settings in inventory summaries, team slots, analysis,
  comparison tables, recommendations, history, and duel/replay headers.
- Check upstream deep links in `domain/teamAnalysis/`: encode settings only if
  the pinned upstream URL format supports them. Otherwise clearly explain what
  the link omits; never present a reduced build as an exact reproduction.

**Acceptance:** keyboard and narrow-screen workflows can create, edit, clear,
and reopen these builds; changing context cannot save a hidden illegal attack.

## 6. Simulation, recommendations, and replay

Owning files: `src/pvpoke/simulation/runtime.ts`,
`PvpokeOneOnOneAdapter.ts`, `PvpokeTeamRankerAdapter.ts`,
`src/domain/simulation/buildSerialization.ts`, `teamRanker.ts`,
`savedTeamRanking.ts`, `src/domain/recommendations/`,
`src/domain/teamAnalysis/`, and `src/features/simulation/duelReplay.ts`.

- Extend the runtime boundary with the real Mega-level and extra-move API.
  Configure Mega level, IVs, effective level, Shadow state, and attacks in the
  characterized order. Assert the resulting engine state agrees with the exact
  request rather than allowing initialization to override it silently.
- Select the extra attack using `extra-charged` at engine index 2. Explicitly
  clear unused ordinary and extra defaults, preserving empty-slot semantics.
  Treat a failed move selection as an error with build context.
- Verify TeamRanker settings, resets, and cloned Pokémon retain per-build Mega
  level, effective level, and all slots. Preserve serialization of ranker runs
  and cleanup of target state between requests.
- Update owned/planned builds, meta defaults, Top-250 targets, generated
  candidates, exact finalist simulation, what-if substitutions, and thresholds.
  Never truncate third moves from rankings or reconstruct a finalist with defaults.
- Include settings in cache identities so two Mega levels or extra moves cannot
  share cached analysis. Preserve deterministic candidate ordering and ranking.
- Capture replay from the same configured battle; identify the extra move in
  events and expose relevant build settings. Playback must match the non-replay
  winner, ratings, HP, energy, shields, form state, and turns.

**Acceptance:** all simulation entry points reproduce a common exact build;
meta opponents and recommendation finalists retain the full configuration.

## 7. Verification matrix and upstream oracle

Extend existing focused tests and `scripts/browser-workflows.ts`; keep real
engine coverage in the mandatory artifact workflow, not just an admin screen.
Mock adapter tests verify API calls but do not establish battle correctness.

| Area | Required evidence |
| --- | --- |
| Upstream parity | Direct pinned-engine setup independent of TeamLab's configuration helper versus TeamLab adapter, with full input fixtures and engine revision/hashes |
| Pokémon | Mega Sableye, Mega Chandelure, an ordinary eligible Mega, a characterized Primal case, and a non-Mega control |
| Levels/formats | Legal Mega levels 1–4, 1500/2500/10000 CP, level-4 entry/exit, capped inference, effective level 52, and characterized Best Buddy boundaries |
| Moves | Zero/one extra attack, one/two ordinary attacks, legal/illegal pool combinations, duplicate rejection, explicit slot clearing, and an extra-move damage case sensitive to Mega level |
| Battle outputs | Damage/rounding, winner, both ratings, remaining HP/energy/shields, and turns; deterministic settings and explicit tolerances only where justified |
| Matrix/replay | One-on-one versus TeamRanker cells under equivalent settings; replay/non-replay parity and actual extra-attack timeline events |
| Persistence | Upgrade seeded 1.3.2 databases, legacy backups v1–v3, v4 round trip, history compatibility, CSV compatibility, merge/replace atomicity, unknown-version rejection |
| End to end | Editor → save/reload → team → analysis/recommendation → duel/replay → export/restore; current and planned builds at desktop and mobile widths |
| Regression/scale | All six formats, ordinary move/stat baselines, existing scale workload, and representative Super Mega targets/recommendation finalists |

Use a meaningful set of shield scenarios (0/1/2), opponent types, and opponents
where the extra attack changes damage or the outcome. At least one deliberate
mutation—dropping the extra attack or applying the wrong Mega level—must fail the
parity checks. A fixture that never uses the extra attack is insufficient.

## 8. Maintenance work and separate follow-ups

### ESLint dependency findings

- Start with a fresh lockfile audit, advisory IDs, dependency paths, and runtime
  versus development classification. Inspect `npm explain minimatch` and
  upstream package compatibility/release notes when selecting a fix.
- Prefer compatible upstream releases; isolate necessary major upgrades and
  document configuration or Node compatibility changes. Do not use
  `npm audit fix --force` or automatically downgrade the lint stack.
- Preserve the TypeScript 7 ignore until the installed TypeScript-ESLint
  toolchain declares support. Retest lint coverage rather than disabling rules
  to make an upgrade pass.
- Review any override for declared-range compatibility and justify it; prefer
  fixing parent dependencies. Require exact-lockfile installation and the full
  artifact/CodeQL gates on the maintenance PR.
- Target zero findings for the identified chain. If no compatible fix exists,
  record the remaining advisories, exposure, mitigation, and revisit trigger
  explicitly before the release decision. A green high-threshold audit alone
  does not demonstrate that moderate findings were resolved.

### Minior concern

- The 1.3.1 review identifies `this.decrementer == "minior_meteor"` in the
  form-stat level loop, where the neighboring condition uses `activeFormId`.
  Core-to-Meteor may consequently decrement whole levels rather than half levels
  when transformed CP initially exceeds the cap. Record pinned source locations
  and a minimal reproducer, and compare direct and replay states at each form
  transition (including damage and effective stats).
- Separate “TeamLab faithfully reproduces upstream” from “upstream is correct.”
  Record observed versus source-intended calculations and upstream issue/fix references
  if available. Do not silently change battle arithmetic while adding Megas.
- Track it locally even if an upstream report is not yet filed. Only bundle a
  fix when independently reviewed and characterized; otherwise retain the known
  limitation and its release impact. A shared engine/configuration defect that
  invalidates Super Mega results blocks this release; an isolated Minior issue
  can remain a documented follow-up.

### Limited cups

LAIC and other limited cups remain deferred. No new league IDs, selectors,
rankings fetches, eligibility logic, or recommendation pools in 1.4.0. Preserve
upstream definitions and test that TeamLab exposes exactly six formats.

## 9. Delivery sequence and documentation

Use reviewable branches based on `staging`; proposed landing order:

1. Characterization harness, behavior decisions, and parity fixtures.
2. Catalog capabilities and roster comparison support.
3. Build contracts, schema readers, atomic migrations, and CP/analysis support.
4. Shared engine configuration, meta targets, recommendations, and replay.
5. Editors/import/summaries and end-to-end acceptance coverage.
6. Release documentation, final version/cache updates, and acceptance evidence.

Land the dependency remediation as a separate maintenance PR into `staging`
when ready; include it in final release verification. Each intermediate PR must
remain usable and pass the artifact gate. If a slice cannot do that independently,
combine tightly coupled contract/consumer changes rather than landing broken
builds. Stacked branches are optional: if used, follow the maintenance policy,
land bottom-up with merge commits, retarget to `staging`, and require fresh checks.
Only label the intended trusted stack tip `staging-preview`.

As implementation progresses, create a new phase overview under
`docs/implementation/phase-11-super-mega/` using the documentation guide's
required sections. Add focused records for build/migration contracts, upstream
configuration and parity, and editing/import workflows. Update the implementation
index and owning existing records, marking superseded assumptions explicitly.
These records describe completed behavior; this file remains the implementation
plan and must not be presented as proof of completion.

Update `USER-GUIDE.md`, `PVPOKE-DATA.md`, and the app README for actual supported
behavior and backup compatibility. Preserve historical 1.3.2 release notes;
replace the current limitation only after the corresponding acceptance gates pass.

## 10. Release checklist

All commands below run from `team-lab/`, with the required `rtk` prefix and a
supported Node/npm toolchain. Use a clean locked install; record versions and
environment-specific workarounds without altering project policy for them.

```bash
rtk npm ci
rtk npm audit --json
rtk npm run audit:security
rtk npm run validate:workflows
rtk npm run lint
rtk npm test
rtk npm run test:scale
rtk npm run validate:data
rtk npm run typecheck
rtk npm run build
rtk npm run test:production:artifact
rtk npm run test:browser
rtk npm run test:visual
```

Review visual diffs before updating snapshots. Verify maintainer build capability
separately with `rtk npm run build:admin`; keep `dist-admin/` out of the public
artifact and deployment. Add new parity tests to the existing test commands so
CI cannot accidentally omit them. `build` already checks public capabilities,
prerendered output, and Cloudflare artifact limits.

Before the release PR:

- Complete all functional, migration, upstream parity, and browser exit criteria.
  Record actual results, remaining findings, and known limitations.
- Set application/package-lock versions to 1.4.0, locate and update all applicable
  asset/cache version keys, and verify generated `release.json` schema versions,
  upstream revision, capabilities, and source identity. Do not fake generated
  metadata or advance the upstream pin merely to change the app version.
- Add `docs/RELEASE-1.4.0.md` with `# Release v1.4.0`, grouped user-visible bullets,
  upgrade/backup compatibility, and accurate maintenance status. The archive
  discovers this file automatically; do not publish a placeholder release note
  while support is incomplete. Test its parser and `/releases` on desktop/mobile.
- Verify an existing-user upgrade with a pre-upgrade full backup and seeded
  1.3.2 data, as well as a fresh install. Check data through the canonical origin;
  staging and `pages.dev` use separate IndexedDB databases.
- Require **Verify public artifact** and both CodeQL analyses on the final
  staging/release state. Validate the immutable preview URL and compare its
  `release.json` to the intended merge-preview commit; the shared staging alias
  can be replaced by another eligible preview.
- Release via a PR from tested `staging` to protected `master` (this repository
  has no `main` branch). Require fresh checks against the final merge base.
  Production deployment occurs only on the resulting successful `master` push.
- Reuse the exact verified public artifact; verify the immutable deployment URL
  and `https://pogoteamlab.com` for expected commit, assets, routes, and browser
  workflows. Do not rebuild separately for deployment or weaken origin checks.
- If tagging the final merged release, inspect existing tags and use the
  TeamLab namespace `teamlab-v1.4.0`; do not overwrite upstream `v*` tags.

## 11. Rollback and final exit criteria

Before production, preserve the previous verified artifact and rehearse rollback
with migrated browser data. A Cloudflare artifact rollback does **not** undo an
IndexedDB upgrade. Older code may fail on database v5 or discard new build fields.
Prefer a forward compatibility fix when that is the safest recovery. Document
the tested recovery path, including backup export, before shipping the migration;
never instruct users to clear local storage without a recoverable backup.

Release only when:

- Every legal supported build survives the complete edit/store/import/analyze/
  simulate/recommend/replay/export path with its settings intact.
- Direct pinned-engine parity covers the bonus, extra attack, level mapping,
  TeamRanker behavior, and replay; ordinary controls and all six formats pass.
- Upgrade/restore failures cannot partially overwrite inventory, teams, or history.
- Identified ESLint findings are fixed or have an explicit reviewed disposition;
  high/critical audit and required security gates pass without policy weakening.
- Minior has a reproducible tracked disposition and limited cups remain separate.
- Documentation, version/cache metadata, staging acceptance, production gates,
  and migration-aware rollback evidence are complete.
