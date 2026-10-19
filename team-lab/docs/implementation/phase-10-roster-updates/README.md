# Phase 10 — Roster Update Review

## Status

**Complete.** Last reviewed October 19, 2026.
This is an additive post-MVP phase; it extends the original plan’s upstream,
inventory, and saved-team boundaries.

## Objective

Explain how a reviewed upstream data refresh affects owned builds and saved
teams, without silently changing the player’s recorded Pokémon.

## Implemented scope

- deterministic outgoing/current snapshot comparison across six formats;
- owned, planned, and projected Mega identities matched to published changes;
- move/stat/release changes, ranking positions, and recommended moves;
- current-catalog validation and repair actions;
- `/updates`, dashboard reminders, and inventory/team entry points;
- per-update/per-format reminder dismissal;
- persisted team analysis provenance with concurrent-edit protection;
- desktop/mobile browser and visual coverage.

## Out of scope

- reconstructing every historical refresh since an inventory record was saved;
- automatically replacing retired species IDs or changing IVs/moves;
- running team simulations automatically when the review opens;
- storing complete team matrix reports or aggregating shield scenarios;
- cloud synchronization or a server-side roster upload.

## Implementation records

- [Roster comparison, review, and freshness](roster-review-and-freshness.md)
- [Upstream refresh procedure](../../PVPOKE-DATA.md)
- [Shared leagues and Mega inventory](../phase-01-upstream-data/shared-leagues-and-mega-inventory.md)

## Important decisions

The outgoing revision is explicit rather than inferred from overwritten files.
Snapshot dates remain visible. A published ranking shift is not presented as a
measured change in an owned build’s matchup performance. Reminder dismissal
and analysis freshness are separate states.

## Validation

The focused Chrome workflow is part of the complete browser suite and can also
be run with `npm run test:browser -- --roster-updates`. Domain tests cover
removed species, invalid moves, minor ranking shifts, planned targets, selected
Mega forms, stale provenance, and member edits. IndexedDB tests cover concurrent
team/member changes. The two roster screenshots are included in the 17-scene
visual suite; run `npm run test:visual` to verify it.

## Known limitations

Only the pinned pair of snapshots is compared. The reminder is a local browser
preference, not part of backups. A current analysis stamp records provenance,
not a persisted report or proof that every scenario has been evaluated.

## Exit criteria

- [x] A sync reproduces the same comparison for the same source pins.
- [x] Users can identify changed and invalid owned builds by format.
- [x] Teams needing repair or fresh analysis have actionable links.
- [x] Successful analysis records the exact data/engine revision safely.
- [x] Dismissal does not hide repair issues or alter owned builds.
- [x] Production/development browser workflows cover the review.

## Next phase dependencies

Further history comparison needs retained snapshots and an explicit retention
policy. Multi-scenario team comparison or resource investment planning needs
its own domain design; it is not implied by this review.

## Relevant commits

- `f8fcb68e1` — generated comparison and roster impact model;
- `cdeef5032` — review UI and safe analysis freshness persistence;
- `ea1a17f06` — browser coverage and user documentation.
