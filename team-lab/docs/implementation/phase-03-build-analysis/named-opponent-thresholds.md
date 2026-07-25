# Named-Opponent CMP, Breakpoints, and Bulkpoints

> **Status:** Implemented for fast moves
> **Last reviewed:** 2026-07-25

## Outcome

The inventory analysis route can compare either the current or planned exact
build with a named Pokémon from PvPoke's Open Great League meta group.

The comparison reports:

- higher, tied, or lower effective Attack for CMP context;
- the entered fast move's damage against the opponent;
- the exact Attack needed for the next one-damage breakpoint;
- whether that Attack is possible anywhere in the general 0–15 IV space;
- the opponent's recommended fast move damage against the inventory build;
- the exact Defense needed to reduce that damage by one;
- whether that Defense is possible in the general IV space;
- a separate result for every possible level when CP-to-level inference is
  ambiguous.

No matchup winner or matchup flip is claimed.

## Upstream boundary extension

`CatalogMove` now carries the immutable combat fields `power`, `energy`,
`energyGain`, and `turns`. These values are normalized in the Phase 1 adapter.
The analysis domain never imports raw Game Master JSON or upstream JavaScript.
If `turns` is absent, the adapter derives it from `cooldown / 500`, matching
PvPoke's turn duration.

## Opponent contract

An eligible opponent must belong to the current Open Great League meta group,
have a Game Master `defaultIVs.cp1500` build and ranking metadata, and have a
recommended fast move that resolves in its normalized movepool.

The UI displays the selected opponent's species, level, IVs, fast move, and
data version. This makes every breakpoint claim reproducible and prevents an
unqualified statement such as “this Pokémon hits a breakpoint.”

The inventory side uses the exact persisted IVs, CP-inferred level, selected
current/planned species, entered fast move, and Shadow state.

## Calculation behavior

The implementation mirrors the standard PvPoke PvP damage calculation:

```text
floor(power × STAB × Attack / Defense × effectiveness × 0.5 × bonus) + 1
```

It preserves PvPoke's floating-point constants for battle bonus, STAB, type
effectiveness, and Shadow Attack/Defense. Effectiveness is multiplied across
both defender types using the complete 18-type Pokémon GO defensive chart.

The next offensive breakpoint solves for the raw effective Attack needed to
increase current integer damage by one. The defensive bulkpoint solves for the
raw effective Defense needed to lower incoming damage by one. Shadow modifiers
are included in damage and removed algebraically from the displayed raw-stat
requirement.

CMP compares unmodified effective Attack. The Shadow damage bonus does not
change CMP priority.

## Files

- `src/domain/pokemon/catalog.ts` — normalized move combat contract
- `src/pvpoke/adapters/buildPokemonCatalog.ts` — raw-to-catalog mapping
- `src/domain/analysis/ivRankings.ts` — highest-Defense reference build
- `src/domain/analysis/matchupThresholds.ts` — damage and threshold domain
- `src/domain/analysis/matchupThresholds.test.ts` — type and opponent evidence
- `src/features/analysis/NamedOpponentInsights.tsx` — selector and evidence UI
- `src/features/analysis/InventoryAnalysisPage.tsx` — route integration

## Important limitations

- Only fast-move damage thresholds are reported.
- The opponent uses PvPoke's published default Great League IVs and recommended
  fast move, not a user-configurable opponent build.
- “Achievable” means some valid 0–15 IV spread reaches the stat threshold. It
  does not identify every qualifying spread or account for acquisition floors.
- Thresholds alone do not prove a matchup flip. HP, charged moves, shields,
  energy, timing, switching, buffs, debuffs, and sequencing are not simulated.
- CMP reports Attack order, not whether charged moves are reached together.
- PvPoke's exceptional active-form battle behaviors are not recreated by this
  arithmetic adapter.

## Validation

Observed on 2026-07-25:

```text
npm test             7 files, 23 tests passed
npm run typecheck    passed
npm run lint         passed
npm run build        passed with the existing >500 kB chunk warning
npm run validate:data
  1,736 catalog entries
  48 Great League meta entries
  0 non-fatal diagnostics
```

Tests cover dual-type effectiveness, immunity-level resistance, named default
opponent resolution, recommended fast-move resolution, integer damage,
offensive threshold shape, and the one-damage defensive floor.

## Next logical extension

The full battle-simulation adapter should consume these same explicit build
contracts. It can determine whether a threshold changes a shield-scenario
result instead of inferring matchup impact from isolated damage arithmetic.
