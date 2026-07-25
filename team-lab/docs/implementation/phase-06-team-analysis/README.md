# Phase 6 — Team Analysis

> **Status:** In progress — scorecard and threat alternatives complete
> **Project-plan phase:** Phase 6: team analysis
> **Last reviewed:** 2026-07-25

## Objective

Translate exact saved-team TeamRanker matrices into understandable,
scope-aware competitive evidence without presenting a selected shield scenario
or partial meta subset as universal truth.

## Implemented scope

- explicit TeamRanker rating-direction interpretation
- selected-target coverage
- individual positive matchup percentage
- per-member win/loss/tie summaries
- per-member average rating
- threat classification
- core-breaker detection
- full-team-wall detection
- major-threat ordering
- provisional coverage score and S–D grade
- shield, target, assumption, and data-version provenance
- scorecard summary on the saved-team simulation route
- threat and member evidence cards
- raw matrix retained below derived analysis
- exact Defense × HP bulk percentile evidence
- answer-redundancy and safe-switch safety heuristic
- published PvPoke consistency aggregation
- complete initial Coverage/Bulk/Safety/Consistency scorecard
- evidence-source and formula disclosure
- normalized PvPoke matchup and counter evidence
- threat-grouped owned exact-record alternatives
- separately labeled unowned PvPoke default alternatives
- species-clause filtering by Pokédex number
- counter evidence, rating perspective, and non-simulation disclosure

## Deferred scope

- upstream weighting of meta targets
- role evidence in the team scorecard
- upstream battle/team-builder deep links
- exact substitution simulations and scorecard deltas
- persisted or version-keyed analysis cache
- final full scorecard visual design

## Implementation records

- [Coverage, threats, and core breakers](coverage-threats-and-core-breakers.md)
- [Bulk, safety, and consistency scorecard](bulk-safety-and-consistency.md)
- [Owned and unowned threat alternatives](owned-and-unowned-alternatives.md)

## Exit criteria

- [x] Exact saved team is evaluated against current selected meta scope.
- [x] Coverage evidence is displayed.
- [x] Major threats and core breakers are displayed.
- [x] Bulk, safety, and consistency are displayed.
- [x] Owned and unowned alternatives are displayed.
- [ ] Upstream deep links are available.
- [ ] Full MVP scorecard and threat view is complete.

## Next slice

Add explicit upstream battle and team-builder deep links with documented URL
serialization. Preserve TeamLab’s exact-build and default-build distinction
when deciding which assumptions can safely be sent upstream.

## Relevant commits

Not yet committed.
