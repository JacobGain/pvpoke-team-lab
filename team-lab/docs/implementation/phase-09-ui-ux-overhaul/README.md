# Phase 9 — Modern Battle Lab UI and UX

> **Status:** Complete for the current MVP
> **Last reviewed:** 2026-07-25

## Objective

Turn the feature-complete MVP into one coherent, mobile-first product without
changing its local-first data model or simulation behavior.

The design direction is a light-first “modern battle lab”: deep navy
application chrome, cyan analytical accents, lime primary actions, generous
white work surfaces, and Pokémon artwork used as functional identity rather
than decoration.

## Implemented scope

- shared application shell for every route
- persistent desktop navigation for Dashboard, Inventory, Teams, and Recommend
- compact mobile header and five-destination bottom navigation
- secondary mobile menu for Catalog, Local Data, and Diagnostics
- live PvPoke data-health indicator in the global shell
- data-aware dashboard with inventory/team metrics and deterministic next action
- consistent page headers, actions, empty states, controls, and card surfaces
- Lucide icon system with visible labels for primary actions
- responsive Pokémon artwork across inventory, catalog, analysis, teams,
  simulation, and recommendation results
- three-step inventory workflow separating required exact-build data, required
  build intent, and optional notes/review
- actual IV entry as the default for new records
- explicit PvPoke rank-one assumption as an optional shortcut
- staged recommendation flow for anchors, experiment settings, and results
- responsive layouts down to the supported 320 CSS-pixel viewport
- keyboard focus treatment, skip navigation, and reduced-motion support
- local, revision-pinned PokeAPI sprite sync and WebP optimization pipeline
- updated real-browser automation for the progressive workflows

## UX hardening follow-up

The first post-overhaul review also delivered:

- one accessible species/form autocomplete in place of separate search and
  select controls;
- compact, aligned IV-source radio controls at desktop and mobile widths;
- shared sentence-case formatting for move IDs, evidence sources, statuses,
  and team positions;
- explicit saved-team role/name structure so labels cannot visually collapse;
- PvPoke-recommended default movesets for new inventory records and plans;
- Rankings as a desktop primary-navigation destination;
- removal of redundant Shadow and Meta pills from Rankings;
- removal of the upstream `none` placeholder from all displayed type lists;
- Meta pills retained where they aid selection in Inventory and team building;
- icon-led simulation score evidence;
- sprite-backed priority-threat cards with per-member result labels;
- the full technical battle matrix collapsed behind an explicit disclosure;
- new browser regressions for recommended moves, compact radio sizing,
  Rankings tags/navigation, saved-team role labels, and 320 px overflow;
- an ordered set of feature-owned stylesheet modules replacing the 4,248-line
  global stylesheet while preserving the exact cascade;
- four checked-in desktop, tablet, and mobile screenshot baselines with
  actionable image diffs; and
- compact “Home” and “Find” mobile labels after the 320 px visual baseline
  exposed otherwise-valid but awkward wrapping.

## Navigation and progressive flow

The global destinations remain reachable at all times. Individual tasks then
use a smaller progressive flow:

```text
Dashboard
    ↓ next best action
Inventory exact build
    ↓
Current or planned intent
    ↓
Review and optional context
    ↓
Analysis / saved team / recommendation
```

“Next best action” is derived only from local state:

- empty inventory: add the first Pokémon;
- fewer than three records: continue inventory setup;
- enough inventory but no saved team: build a team;
- inventory and teams present: generate recommendations.

This is guidance, not a locked wizard. The global navigation remains available
throughout.

## Sprite pipeline

Run from `team-lab/` only when PvPoke species/forms or the pinned sprite source
needs to change:

```bash
npm run sync:sprites
```

The script:

1. reads the inherited PvPoke Game Master;
2. resolves released PvPoke species/form IDs against PokeAPI;
3. downloads HOME artwork from a pinned `PokeAPI/sprites` revision;
4. resizes it into transparent 256 px WebP assets;
5. generates the typed species-to-asset manifest; and
6. records attribution plus all base-art fallbacks.

Generated output is intentionally checked in so normal development and
production builds do not require network access.

Current output:

- 1,123 TeamLab species/form manifest entries;
- 1,097 unique WebP files;
- approximately 14 MB on disk;
- 43 labeled base-art fallbacks for forms without an exact mapping.

The authoritative fallback list and source terms live in
`public/assets/pokemon/ATTRIBUTION.md`.

## Primary implementation files

- `src/app/AppLayout.tsx` — shared responsive shell and navigation
- `src/app/routes/HomePage.tsx` — state-aware dashboard
- `src/components/PageHeader.tsx` — common page hierarchy
- `src/components/EmptyState.tsx` — actionable empty states
- `src/components/PokemonSprite.tsx` — local sprite resolution and fallback
- `src/features/inventory/InventoryFormPage.tsx` — guided exact-build entry
- `src/features/recommendations/RecommendationPage.tsx` — staged request flow
- `src/styles/global.css` — ordered stylesheet entry point
- `src/styles/modules/*.css` — foundation, shell, primitive, and feature styles
- `scripts/sync-pokemon-sprites.ts` — revision-pinned sprite synchronization
- `src/generated/pokemonSprites.ts` — generated sprite manifest
- `scripts/browser-workflows.ts` — full progressive-flow browser coverage
- `tests/visual/` — checked-in presentation baselines and review instructions

See [Style architecture and visual regression](style-architecture.md) for the
stylesheet ownership, cascade, and screenshot review contracts.

## Validation

Observed after the overhaul:

```text
npm test          27 files, 78 tests passed
npm run test:scale passed
npm run test:browser passed; complete create/edit/team/recommend/backup flow
npm run test:visual passed; four baselines matched at 0 changed pixels
npm run typecheck passed
npm run lint      passed
npm run build     passed; entry chunk approximately 402 kB
```

The browser suite created 12 records through the guided form, simulated a
saved team against the Top 20, cancelled and completed recommendations,
verified populated states at 320 px, downloaded a full backup, reset local
data, and restored 12 records plus two teams.

## Known limitations

- Light mode is the delivered theme. Tokens are structured for a later dark
  theme, but no theme control is exposed.
- Some Pokémon GO costumes and special forms use clearly recorded National Dex
  base artwork because PokeAPI has no exact HOME asset mapping.
- `modern-feature-overrides.css` remains a documented transition layer. Rules
  can move into their owning feature modules incrementally as touched.
- The current application remains Open Great League-specific.

## Relevant commits

Not yet committed.
