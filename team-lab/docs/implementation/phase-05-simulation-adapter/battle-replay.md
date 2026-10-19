# Configurable Battle and Engine-Observed Replay

## Summary

`/battle` runs exact one-on-one matchups and replays observations captured from
the bundled PvPoke engine. It is available in all six supported formats.

## Problem being solved

A final battle rating does not show the turns, charged moves, shield use, or
resource changes that produced it. Users also need to experiment with builds
without first saving inventory records.

## Implemented behavior

Both selectors start empty and browse the released roster, not only ranked
Pokémon. Choose exact forms/Shadow variants, moves, IVs, half-levels, and
independent shield counts. Fit to league selects a legal level for the entered
IVs, within the form’s bounds and the battle editor’s level-50 ceiling.
Changing or clearing a contender invalidates its previous result/replay.

Playback includes play/pause, restart, previous/next turn, speed selection,
scrubbing, Show result, and an event log. Captured state includes HP, energy,
remaining shields, and stat stages. Quiet turns remain represented. The
presentation derives animations and resource changes from captured frames.

## Architecture and data flow

Editor → legal exact simulation builds → `PvpokeOneOnOneAdapter` → upstream
`Battle` execution with observation around engine steps → detached TeamLab
frames/events → playback controls and event log.

## File ownership

| File under `team-lab/` | Responsibility |
| --- | --- |
| `src/features/simulation/DuelPage.tsx` | Editor, result, and playback UI |
| `src/features/simulation/duelBuild.ts` | Defaults, fit-to-league, validation |
| `src/features/simulation/duelReplay.ts` | Playback timing and presentation helpers |
| `src/domain/simulation/contracts.ts` | Exact builds and replay contracts |
| `src/pvpoke/simulation/PvpokeOneOnOneAdapter.ts` | Engine invocation and observation |
| `src/styles/modules/duel.css` | Responsive battle layout |

## Public interfaces and schemas

The existing exact-build contract carries identity, level, IVs, CP, moves,
Shadow state, and source. Replay frames and events are detached from mutable
upstream objects so advancing the engine cannot mutate an earlier frame.

## Important decisions

PvPoke remains the calculation and decision authority. TeamLab observes it;
it does not implement another damage or turn engine. Both combatants start at
full HP and zero energy. Upstream default decisions and buff behavior apply.
A replay is a single simulated matchup, not a prediction of a full team battle.

## Rejected or deferred alternatives

Manual turn scripting, arbitrary starting energy/HP, and a second independent
battle engine are not part of this editor.

## Error handling

Invalid levels/IVs, CP over the selected cap, illegal or duplicate moves, and
incomplete selectors prevent simulation. Runtime failures remain visible and
must not leave a stale replay looking current.

## Performance considerations

The engine computes the matchup; playback renders already captured snapshots.
The nominal Pokémon GO turn is 500 ms, adjusted by the selected playback speed.

## Validation

```bash
npm test
npm run test:browser -- --duel
npm run build
npm run test:production:artifact -- --duel
```

Adapter tests cover observation without changing battle results, quiet turns,
shields, and detached snapshots. Chrome covers the blank editor, full roster,
result invalidation, playback timing, customization, and responsive layout.
The complete browser suite includes these checks.

## Known limitations

Replay does not model three-on-three switching, player decision branches, or
arbitrary starting energy. It is not persisted in JSON backups.

## Safe extension points

Extend replay contracts and adapter observation tests together. Preserve parity
with upstream results whenever engine timing changes.

## Follow-up work

Additional scenario controls require explicit engine configuration and
provenance; UI-only animation changes must not alter simulation semantics.

## Relevant commits

Use the owning file history for replay changes; `a1d5a3831` records the current
bundled upstream refresh used by the adapter.
