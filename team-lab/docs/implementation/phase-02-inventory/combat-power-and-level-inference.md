# Combat Power and Level Inference

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Complete for Open Great League  
> **Last reviewed:** 2026-07-24

## Summary

TeamLab calculates Pokémon GO combat power and infers every half-level that can
produce an entered CP/IV/species combination. New and edited records cannot be
saved when no legal level exists.

## Upstream characterization

`team-lab/src/domain/pokemon/combatPower.ts` preserves the formula and 101 CP
multipliers from `src/js/pokemon/Pokemon.js`, covering levels 1 through 51.

```text
floor(
  (baseAttack + attackIV)
  × sqrt(baseDefense + defenseIV)
  × sqrt(baseHP + hpIV)
  × CPM²
  ÷ 10
)
```

Calculated CP has a minimum display value of 10. The upstream implementation
remains untouched; TeamLab owns a deterministic characterized function.

## Catalog additions

Normalized catalog entries now include immutable base stats, upstream level
floor, level cap, and direct evolution IDs.

## Inference result

`inferCombatPowerLevel` returns:

- `no-match` when no supported half-level produces the CP;
- `unique` when exactly one level matches;
- `ambiguous` when multiple levels produce the displayed CP.

Each match reports whether it requires the Best Buddy level above the normal
cap. Ambiguous matches remain valid because choosing one would fabricate data.

## Validation integration

Catalog-aware validation rejects impossible current CP/IV combinations and
impossible planned target CP values. Inferred level stays derived rather than
persisted, so calculation corrections do not require inventory migrations.

## Validation

`combatPower.test.ts` covers key CPM indexes, minimum CP behavior, PvPoke’s
default 0/15/15 level-45.5 Azumarill at CP 1499, impossible CP, and ambiguous
low-CP handling.

## Known limitations

- Current PvPoke half-level behavior is the supported model.
- Best Buddy is inferred from level 51, not stored as a separate flag.
- Acquisition sources are not separately modeled; upstream species floors are
  respected.

## Relevant commits

Not yet committed.
