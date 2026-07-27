# Phase 6 — Team Analysis

> **Status:** Complete for MVP
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
- PvPoke-compatible Coverage value and A–F grade
- shield, target, assumption, and data-version provenance
- scorecard summary on the saved-team simulation route
- threat and member evidence cards
- raw matrix retained below derived analysis
- PvPoke exact Defense × HP Bulk formula
- published PvPoke Switch-score Safety formula
- upstream exact-moveset Consistency calculation
- complete initial Coverage/Bulk/Safety/Consistency scorecard
- evidence-source and formula disclosure
- normalized PvPoke matchup and counter evidence
- threat-grouped owned exact-record alternatives
- separately labeled unowned PvPoke default alternatives
- species-clause filtering by Pokédex number
- counter evidence, rating perspective, and non-simulation disclosure
- completed-run request provenance

## Deferred enhancements

- upstream weighting of meta targets
- role evidence in the team scorecard
- exact substitution simulations and scorecard deltas
- persisted or version-keyed analysis cache
- final full scorecard visual design

## Implementation records

- [Coverage, threats, and core breakers](coverage-threats-and-core-breakers.md)
- [Bulk, safety, and consistency scorecard](bulk-safety-and-consistency.md)
- [Owned and unowned threat alternatives](owned-and-unowned-alternatives.md)
- [Removed PvPoke Battle and Team Builder deep links](upstream-deep-links.md)

## Exit criteria

- [x] Exact saved team is evaluated against current selected meta scope.
- [x] Coverage evidence is displayed.
- [x] Major threats and core breakers are displayed.
- [x] Bulk, safety, and consistency are displayed.
- [x] Owned and unowned alternatives are displayed.
- [x] External deep links were removed for the self-contained runtime.
- [x] Full MVP scorecard and threat view is complete.

## Next phase

Begin Phase 7 anchor recommendations: accept one or two owned anchors, build a
species-clause-safe candidate shortlist, prioritize ready-now records, and
define the pre-score boundary before simulating finalists.

## Relevant commits

Not yet committed.
