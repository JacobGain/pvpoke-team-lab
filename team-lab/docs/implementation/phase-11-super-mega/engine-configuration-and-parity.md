# Pinned engine configuration and parity

## Summary and source behavior

The bundled engine supports Mega levels and extra attacks. It defaults to level
3, or 4 for `supermega`, permits a third slot for the `mega` tag, and selects
that slot from `extraChargedMovePool`. Mega level 4 initialization raises the
effective cap to 52. In uncapped battles, `setMegaLevel` switches effective level
to 52 on entry to 4 and to 50 on exit. It must run before the requested exact
effective level is applied. Its default capped IV spreads already specify
effective battle levels; do not add two levels to those spreads.

Only moves marked `isMegaMove` receive the Mega bonus. The pinned damage engine
owns multipliers and rounding. TeamLab does not reimplement damage arithmetic.
Primals have the Mega tag but no extra pool in this snapshot; having a third
slot capability does not invent a selectable extra attack.

## Architecture, interfaces, and file ownership

`src/pvpoke/simulation/runtime.ts` declares the real Mega and extra-move APIs.
`configurePvpokePokemon` in `PvpokeOneOnOneAdapter.ts` remains the shared
configuration boundary. It validates attack pools, applies Mega level, IVs,
effective level, Shadow state, and explicit attacks, and asserts resulting CP,
level, and slots against the exact request. Errors identify the affected build.

Upstream `selectMove` returns no success boolean and can insert a custom move
when a requested ID is absent. Pool validation must happen before calling it;
checking its return value is insufficient.

Set an entered extra attack before clearing ordinary slot 2. Otherwise upstream
can create an undefined array hole, while some of its filters exclude only null.
Explicitly clear unentered defaults so a one-attack build stays a one-attack build.

## TeamRanker compatibility decision

The pinned `TeamRanker.js` reads `chargedMoves[1].type` without a null check when
calculating charged breakpoints. A legal one-ordinary-plus-extra build therefore
crashes in matrix mode. `PvpokeTeamRankerAdapter.ts` temporarily gives the ranker
dense attack arrays on its disposable configured Pokémon objects and restores
the original arrays in `finally`. Exact builds and stored slot roles never change.
Real-engine tests compare the resulting matrix rating to a directly configured
duel, including the empty ordinary slot. Vendor files remain byte-for-byte pinned.
Recheck the need for this compatibility code after any engine pin advancement.

## Reproducible validation

`scripts/pvpoke-engine-harness.ts` executes all nine non-jQuery classic scripts
in a fresh VM realm with the exact pinned Game Master. It stubs only data-layer
jQuery operations, not Pokémon, battle, or ranker algorithms. It records upstream
revision, Game Master hash, and individual engine hashes as fixture provenance.

`scripts/pvpoke-super-mega.test.ts` configures its direct oracle independently
of TeamLab's helper. Forty-eight combinations span Sableye, Chandelure, an
ordinary Mega, and a Primal; Mega levels 1–4; and 1500/2500/10000 CP, distributing
shield counts 0–2. They compare winner, both ratings, HP, energy, shields, turns,
replay parity, and matrix cells. Controls cover ordinary Pokémon and default
level transitions. A separate Sableye Power Gem/Night Shade+ matchup verifies
an actual extra-attack event and fails when the extra attack is dropped or the
Mega level is changed to 1. This prevents false confidence from unused slots.

```bash
rtk npx vitest run scripts/pvpoke-super-mega.test.ts
```

This suite runs under mandatory `npm test`. Twenty-four frozen fixtures in
`scripts/fixtures/super-mega-parity.json` preserve full inputs, outputs, and
provenance. `record-super-mega-fixtures.ts` regenerates them from raw published
rankings and the direct engine, independently of application serializers and
catalog normalization. Tests reject changed script/Game Master hashes.

A fixed-stat marked attack deals 43, 47, 52, and 56 damage at Mega levels 1–4;
the ordinary Power Gem control remains unchanged. Both Sableye and Chandelure
have battles with actual extra-attack events. Deliberately dropping the extra
attack or changing the Mega level fails the sensitive comparison. Default
movesets for every representable ranking across all six formats retain all roles.

The mandatory production browser workflow covers actual Mega team matrices,
recommendations, history, and extra-attack replay/clearing on the public artifact.
The development workflow also characterizes both Minior form transitions.
Published ranking positions are not compared to individual duel ratings as if
they were the same calculation.

## Safe extensions, limitations, and relevant commits

Use the common configuration helper for every new simulation path. Preserve
engine script/data hashes and add new direct-oracle fixtures when rules change.
Do not alter the vendor files or Minior's form algorithm without a separately
reviewed, reproducible source change. Feature branch: `1.4.0/super-mega`; its release PR records the final identity.
