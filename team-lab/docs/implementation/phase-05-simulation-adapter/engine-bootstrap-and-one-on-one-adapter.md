# Engine Bootstrap and Exact One-on-One Adapter

> **Status:** Implemented; real-engine browser characterization pending
> **Last reviewed:** 2026-07-25

## Outcome

TeamLab now owns a typed boundary capable of configuring and invoking an exact
one-on-one PvPoke battle. No React component imports or accesses `Battle`,
`Pokemon`, `GameMaster`, jQuery, or any other upstream global.

## Why a runtime boundary is required

The upstream engine is not packaged as ES modules. Its battle pages assemble a
classic-script dependency chain and depend on page globals:

```text
jQuery
DamageCalculator
ActionLogic
TimelineEvent
TimelineAction
DecisionOption
Battle
GameMaster
Pokemon
TeamRanker
```

`GameMaster.js` immediately performs a jQuery AJAX request using global
`host`, `webRoot`, `siteVersion`, and `settings`. `Battle` and `Pokemon` are
mutable constructor globals. Loading these files through ordinary TypeScript
imports would be unreliable and would spread upstream assumptions through the
application.

TeamLab therefore has two boundaries:

```text
TeamLab simulation contract
        ↓
PvpokeOneOnOneAdapter
        ↓
PvpokeBattleRuntime
        ↓
BrowserPvpokeRuntime
        ↓
upstream classic-script globals
```

The adapter can receive a fake runtime in tests. Production composition uses
the browser runtime.

## Exact simulation contract

`ExactSimulationBuild` contains only the information required to reproduce a
build:

- species ID and display name;
- exact level and CP;
- exact Attack, Defense, and HP IVs;
- one fast move;
- one or two charged moves;
- Shadow state;
- current/planned/meta-default provenance.

`OneOnOneSimulationRequest` adds:

- the fixed Open Great League format;
- two ordered combatants;
- shield count for each combatant;
- the source data version.

The format contract is currently:

```text
id: great-league
CP cap: 1500
level cap: 50
cup: all
```

The result contains:

- winner index or tie;
- battle rating for each combatant;
- remaining and maximum HP;
- remaining energy and shields;
- upstream turns-to-win values;
- data version;
- engine identity;
- human-readable assumptions.

No upstream Pokémon, winner, timeline, or battle object escapes the adapter.

## Build serialization

`serializeAnalyzedBuildForSimulation` translates the Phase 3 read model rather
than reading inventory persistence directly.

This preserves:

- current versus planned context;
- exact entered moves;
- exact IVs;
- CP-inferred level;
- catalog-derived Shadow state.

If one CP and IV spread maps to multiple supported levels, serialization
throws `AmbiguousSimulationLevelError` unless the caller explicitly selects
one of those levels. Exact simulation never silently chooses the first level.

## Browser bootstrap

`BrowserPvpokeRuntime`:

1. normalizes `VITE_PVPOKE_BASE_URL`;
2. sets the minimal upstream page globals;
3. disables timeline animation and enables performance-oriented settings;
4. loads the required scripts sequentially as classic scripts;
5. marks each injected script for idempotent reuse;
6. initializes the Game Master singleton;
7. waits until Pokémon and move data are present;
8. fails after a configurable 15-second timeout;
9. verifies that `Battle` and `Pokemon` constructors exist.

All calls to `ready()` share one promise. Concurrent consumers therefore do
not inject duplicate scripts or create competing Game Master loads.

Failures are wrapped in `PvpokeEngineBootstrapError`. The original cause is
retained where available.

The runtime uses the same `VITE_PVPOKE_BASE_URL` as the Phase 1 data boundary,
so local Vite proxy and future deployed routing remain aligned.

## Adapter configuration order

For every request, the adapter:

1. awaits runtime readiness;
2. creates a fresh battle;
3. applies level cap, CP cap, and cup;
4. creates both upstream Pokémon;
5. applies Attack, Defense, and HP IVs;
6. applies exact level;
7. applies normal/Shadow state;
8. selects entered fast and charged moves;
9. explicitly clears the second charged slot when absent;
10. applies shields;
11. attaches configured Pokémon without reinitializing them;
12. invokes `battle.simulate()`;
13. translates ratings, winner, HP, energy, shields, and turns-to-win.

The fresh-battle-per-request rule prevents mutable timeline, action, and
combatant state from leaking between simulations.

## Assumptions currently returned

Every result states:

- PvPoke default simulation decision logic;
- no starting energy, HP, or stat-stage advantage;
- no switching or three-on-three battle AI;
- upstream-default buff chance behavior.

The result does not imply that one shield scenario universally predicts a
matchup.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/simulation/contracts.ts` | Engine-independent request/result contracts |
| `src/domain/simulation/buildSerialization.ts` | Phase 3 build translation |
| `src/pvpoke/simulation/runtime.ts` | Minimal upstream runtime facade |
| `src/pvpoke/simulation/BrowserPvpokeRuntime.ts` | Script and Game Master bootstrap |
| `src/pvpoke/simulation/PvpokeOneOnOneAdapter.ts` | Exact battle invocation and result translation |
| `src/pvpoke/simulation/index.ts` | Production composition |
| `src/domain/simulation/buildSerialization.test.ts` | Exact serialization characterization |
| `src/pvpoke/simulation/PvpokeOneOnOneAdapter.test.ts` | Runtime call order and translation characterization |

## Characterization coverage

The adapter test verifies:

- runtime readiness occurs before construction;
- Open Great League settings are applied;
- exact IV and level calls;
- normal and Shadow configuration;
- one- and two-charged-move behavior;
- shield configuration;
- configured Pokémon attach without reinitialization;
- simulation invocation after both combatants exist;
- winner, rating, HP, energy, shield, and turn translation;
- upstream mutable objects do not appear in the returned contract.

The build test verifies a known exact Azumarill inventory analysis serializes
to level 45.5, CP 1499, 0/15/15 IVs, and its entered moves.

## Important limitations

- Current automated tests inject a characterized fake runtime. They do not yet
  execute real classic scripts in a browser.
- Script availability, CSP, proxy routing, and upstream AJAX behavior require
  browser characterization.
- The adapter does not yet verify that upstream move selection returned
  success; the real-engine fixture slice should establish error behavior.
- The translated result intentionally excludes the large mutable timeline.
- Starting HP, energy, buffs, move timing options, bait strategy, and buff
  chance are not configurable yet.
- Only Open Great League is modeled.
- TeamRanker remains separate work.
- No React feature invokes this adapter yet.

## Validation

Observed on 2026-07-25 after this slice:

```text
npm test          13 files, 35 tests passed
npm run typecheck passed
npm run lint      passed
```

Full build and real-data validation are part of the final slice gate.
