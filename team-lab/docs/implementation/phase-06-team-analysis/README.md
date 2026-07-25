# Phase 6 — Team Analysis

> **Status:** In progress — coverage and threat evidence complete
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

## Deferred scope

- bulk score
- safety score
- consistency score
- upstream weighting of meta targets
- role evidence in the team scorecard
- owned alternatives
- unowned alternatives
- upstream battle/team-builder deep links
- persisted or version-keyed analysis cache
- final full scorecard visual design

## Implementation records

- [Coverage, threats, and core breakers](coverage-threats-and-core-breakers.md)

## Exit criteria

- [x] Exact saved team is evaluated against current selected meta scope.
- [x] Coverage evidence is displayed.
- [x] Major threats and core breakers are displayed.
- [ ] Bulk, safety, and consistency are displayed.
- [ ] Owned and unowned alternatives are displayed.
- [ ] Upstream deep links are available.
- [ ] Full MVP scorecard and threat view is complete.

## Next slice

Add bulk, safety, and consistency evidence using clearly documented inputs:
effective-stat bulk from exact team builds, matchup-distribution safety, and
the existing PvPoke role/consistency metadata. These must remain distinguishable
from freshly simulated matchup coverage.

## Relevant commits

Not yet committed.
