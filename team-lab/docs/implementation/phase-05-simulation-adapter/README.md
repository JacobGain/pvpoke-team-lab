# Phase 5 — PvPoke Simulation Adapter

> **Status:** Complete for MVP
> **Project-plan phase:** Phase 5: PvPoke simulation adapter
> **Last reviewed:** 2026-07-25

## Objective

Run exact inventory builds through the upstream PvPoke engine without allowing
React, persisted TeamLab records, or application domain code to depend on
upstream global constructors and mutable battle objects.

## Implemented scope

- TeamLab-owned exact-build simulation contracts
- six-format open/Mega simulation contract
- configurable shield counts
- configurable duel editor and engine-observed turn replay
- exact analyzed-build serialization
- explicit rejection of ambiguous CP-to-level builds
- upstream classic-script bootstrap
- idempotent runtime readiness promise
- Game Master readiness timeout and typed bootstrap failure
- minimal typed facade over upstream `Battle` and `Pokemon`
- injected runtime boundary for characterization tests
- exact level, IV, Shadow, moveset, and shield configuration
- upstream one-on-one simulation invocation
- immutable TeamLab result translation
- explicit engine and scenario assumptions
- two known exact Great League characterization cases
- repeat-run determinism comparison
- translated-result invariant validation
- `/diagnostics/simulation` real-browser runner
- downloadable versioned characterization report
- TeamRanker request and translated result contracts
- exact explicit-target matrix adapter
- serialized access to the global RankerMaster singleton
- guaranteed target cleanup
- real-browser TeamRanker repeat diagnostic
- ordered saved-team exact-build preparation
- explicit catalog-derived meta target subsets
- measured TeamRanker application service
- `/teams/:teamId/simulation` raw matrix workflow
- initial interactive performance classifications

## Deferred scope

- real-browser output fixture capture
- arbitrary starting HP/energy and scripted opponent decisions
- shield-scenario matrices
- interruption of an in-flight synchronous engine battle

## Implementation records

- [Engine bootstrap and exact one-on-one adapter](engine-bootstrap-and-one-on-one-adapter.md)
- [Real-engine browser characterization](real-engine-characterization.md)
- [TeamRanker adapter](team-ranker-adapter.md)
- [Saved-team meta matrix service](saved-team-meta-matrix.md)
- [Configurable Battle and engine-observed replay](battle-replay.md)

## Exit criteria

- [x] Required upstream core scripts can be bootstrapped behind one boundary.
- [x] Exact inventory analysis can become an engine-independent build request.
- [x] Exact one-on-one requests are wrapped by an adapter.
- [x] Mutable upstream results are translated into TeamLab-owned results.
- [x] Known simulations are characterized against the real upstream engine in
  a browser runtime.
- [x] TeamRanker is wrapped.
- [x] Exact owned builds can be invoked through an application-facing workflow.

## Next slice

Phase 6 scorecards, threats, alternatives, and what-if substitutions are
implemented. The adapter also powers Battle replay and recommendation
finalists. Future scenario controls must preserve explicit assumptions and
upstream result parity. Team analysis stamps are documented in
[roster review and freshness](../phase-10-roster-updates/roster-review-and-freshness.md).

## Relevant commits

See the owning file histories and the focused implementation records.
