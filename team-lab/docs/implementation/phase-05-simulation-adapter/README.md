# Phase 5 — PvPoke Simulation Adapter

> **Status:** In progress — engine boundary and one-on-one adapter complete
> **Project-plan phase:** Phase 5: PvPoke simulation adapter
> **Last reviewed:** 2026-07-25

## Objective

Run exact inventory builds through the upstream PvPoke engine without allowing
React, persisted TeamLab records, or application domain code to depend on
upstream global constructors and mutable battle objects.

## Implemented scope

- TeamLab-owned exact-build simulation contracts
- Open Great League simulation-format contract
- configurable shield counts
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

## Deferred scope

- real-browser output fixture capture
- inventory or saved-team simulation UI
- selectable opponent builds
- shield-scenario matrices
- timeline translation
- team-versus-meta orchestration
- cancellation and progress reporting

## Implementation records

- [Engine bootstrap and exact one-on-one adapter](engine-bootstrap-and-one-on-one-adapter.md)
- [Real-engine browser characterization](real-engine-characterization.md)
- [TeamRanker adapter](team-ranker-adapter.md)

## Exit criteria

- [x] Required upstream core scripts can be bootstrapped behind one boundary.
- [x] Exact inventory analysis can become an engine-independent build request.
- [x] Exact one-on-one requests are wrapped by an adapter.
- [x] Mutable upstream results are translated into TeamLab-owned results.
- [x] Known simulations are characterized against the real upstream engine in
  a browser runtime.
- [x] TeamRanker is wrapped.
- [ ] Exact owned builds can be invoked through an application-facing workflow.

## Next slice

Run the new TeamRanker browser diagnostic, then connect exact saved teams and
catalog-derived meta targets through an application service. Large target sets
must be measured before Phase 6 UI relies on synchronous browser ranking.

## Relevant commits

Not yet committed.
