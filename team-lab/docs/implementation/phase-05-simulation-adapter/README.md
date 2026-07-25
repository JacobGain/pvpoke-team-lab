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

## Deferred scope

- real-browser output fixture capture
- a simulation diagnostics/status screen
- inventory or saved-team simulation UI
- selectable opponent builds
- shield-scenario matrices
- timeline translation
- TeamRanker adapter
- team-versus-meta orchestration
- cancellation and progress reporting

## Implementation records

- [Engine bootstrap and exact one-on-one adapter](engine-bootstrap-and-one-on-one-adapter.md)

## Exit criteria

- [x] Required upstream core scripts can be bootstrapped behind one boundary.
- [x] Exact inventory analysis can become an engine-independent build request.
- [x] Exact one-on-one requests are wrapped by an adapter.
- [x] Mutable upstream results are translated into TeamLab-owned results.
- [ ] Known simulations are characterized against the real upstream engine in
  a browser runtime.
- [ ] TeamRanker is wrapped.
- [ ] Exact owned builds can be invoked through an application-facing workflow.

## Next slice

Add a browser characterization harness that runs known exact build pairs
through the real bootstrapped engine, records stable summary fixtures, and
surfaces bootstrap/data-version diagnostics. This should precede end-user
simulation UI and TeamRanker integration.

## Relevant commits

Not yet committed.
