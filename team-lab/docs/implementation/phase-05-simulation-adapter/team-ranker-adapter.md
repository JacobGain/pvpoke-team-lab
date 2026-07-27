# TeamRanker Adapter

> **Status:** Implemented; real-browser diagnostic available
> **Last reviewed:** 2026-07-25

## Outcome

TeamLab can pass one to three exact builds and an explicit target set through
upstream `RankerMaster` without exposing the global singleton or raw ranking
objects outside the PvPoke adapter.

This is the engine capability needed by Phase 6 to evaluate an ordered saved
team against a controlled meta set.

## Request contract

`TeamRankerRequest` contains:

- one to three exact team builds;
- one or more explicit target builds;
- team shield count;
- target shield count;
- upstream data version.

Every build uses the same exact contract as one-on-one simulation: species,
level, CP, IVs, entered moves, Shadow state, and provenance.

The initial adapter deliberately requires explicit targets. It never asks the
upstream Game Master to generate a candidate pool implicitly. Phase 6 will
construct its meta target set from TeamLab's validated catalog/meta boundary.

## Upstream configuration

The browser bootstrap now additionally loads:

```text
js/battle/rankers/TeamRanker.js
```

Upstream TeamRanker normally receives `getDefaultMultiBattleSettings` from the
large UI-oriented `PokeMultiSelect.js`. TeamLab supplies the equivalent small
default-settings function at the runtime boundary instead of loading the
upstream selector UI and its additional DOM dependencies.

The adapter configures:

- Open Great League CP 1500;
- level cap 50;
- cup `all`;
- single explicit shield scenario;
- original/exact IV behavior;
- default bait logic;
- optimized move timing;
- full starting HP;
- zero starting energy, cooldown, and stat stages;
- recommended-move replacement disabled;
- meta-priority score adjustment disabled;
- matrix context.

This ensures exact entered builds remain unchanged.

## Singleton safety

`RankerMaster.getInstance()` is a mutable upstream singleton. Its target list
and override settings survive until replaced.

The adapter therefore:

1. serializes all adapter instances through a static promise queue;
2. sets every relevant option on every request;
3. supplies an explicit target list;
4. clears targets in a `finally` block;
5. creates fresh staging Pokémon for every request.

Failed simulations cannot leave explicit targets attached. Concurrent callers
cannot interleave settings and results.

## Result translation

`TeamRankerResult` contains:

- translated target rankings;
- species identity and display name;
- average rating and upstream score;
- one translated matchup per team member;
- opponent species ID;
- rating, score, and duration;
- outgoing and incoming fast-move damage;
- Attack differential;
- team-rating arrays;
- expected battle count;
- engine identity and data version;
- explicit assumptions.

Raw target Pokémon, opponent Pokémon, movesets, CSV, and upstream ranking
objects are discarded.

## Real-browser diagnostic

The simulation diagnostics page includes **Run TeamRanker check**.

It ranks exact default Whiscash against an exact Azumarill/Altaria team with
one shield per side. It executes the same request twice and checks:

- deterministic translated output;
- `pvpoke-team-ranker` engine identity;
- current data version;
- two expected battles;
- preserved explicit Whiscash target;
- one matchup per team member.

This independently verifies the newly loaded TeamRanker script and global
default-settings bridge.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/simulation/contracts.ts` | TeamRanker request/result contracts |
| `src/pvpoke/simulation/runtime.ts` | Minimal raw ranker facade |
| `src/pvpoke/simulation/BrowserPvpokeRuntime.ts` | TeamRanker script and settings bridge |
| `src/pvpoke/simulation/PvpokeTeamRankerAdapter.ts` | Queueing, invocation, cleanup, translation |
| `src/pvpoke/simulation/index.ts` | Production adapter composition |
| `src/pvpoke/simulation/PvpokeTeamRankerAdapter.test.ts` | Isolated adapter characterization |
| `src/domain/simulation/characterization.ts` | Real-runtime repeat and invariants |
| `src/features/simulation/SimulationDiagnosticsPage.tsx` | Browser TeamRanker check |

## Characterization coverage

Automated tests prove:

- explicit exact target configuration;
- separate team/target shield settings;
- recommended moves and meta priority are disabled;
- expected target × team battle count;
- ranking and matchup translation;
- fast-move damage and Attack differential translation;
- target cleanup;
- invalid empty-team rejection before bootstrap;
- two-run real-diagnostic contract and invariants.

## Known limitations

- The initial adapter supports matrix evaluation, not generated counter or
  alternative pools.
- Meta weighting is intentionally disabled.
- Starting advantages and average shield mode are not exposed.
- Charged-move breakpoint fields are not translated yet.
- The queue is process-wide within the TeamLab module, matching the
  process-wide upstream singleton.
- Cancellation and progress callbacks are not implemented.
- A large meta target list runs synchronously in the browser and will require
  batching or a worker before Phase 6 production use.
- TeamRanker results are not persisted.
