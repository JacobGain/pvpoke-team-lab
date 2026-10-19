# Phase 4 — Saved Teams

> **Status:** Complete for MVP
> **Project-plan phase:** Phase 4: saved teams
> **Last reviewed:** 2026-10-19

## Objective

Allow a user to persist an ordered, legal team for a supported open/Mega format made from exactly
three inventory records:

1. Lead
2. Safe switch
3. Closer

Saved teams reference inventory identities rather than copying Pokémon builds.
Inventory therefore remains the source of truth for later analysis and
simulation.

Current data-update and freshness behavior is documented in
[roster review and freshness](../phase-10-roster-updates/roster-review-and-freshness.md).
Version-three full-data backups include teams and recommendation history; the
original phase’s version-two database milestone below is historical.

## Implemented scope

- version-one saved-team Zod schema
- explicit identity for all six supported formats
- persisted lead, switch, and closer order
- three distinct inventory-reference requirement
- names, notes, timestamps, and optional data-version/upstream-commit analysis metadata
- atomic analysis stamping only when persisted team/member snapshots are unchanged
- inventory-reference resolution
- current/planned target-species resolution
- Pokédex-identity species clause
- stable legality issues and typed aggregate error
- create/update factories
- analysis freshness invalidation on update
- storage-independent repository contract
- Dexie CRUD implementation with read/write validation
- saved-team table introduced in IndexedDB version two, retained in current version four
- characterized version-one inventory preservation during upgrade
- real IndexedDB tests through `fake-indexeddb`
- TanStack Query list/detail and CRUD mutations
- live inventory/catalog team resolution
- `/teams`, `/teams/new`, and `/teams/:teamId` routes
- ordered create and edit workflow
- positional swap controls
- duplicate and confirmed-delete actions
- visible missing-member recovery states
- responsive saved-team list and editor

## Later-phase completion

- application-wide team backup and restore was completed in Phase 8
- scorecards and simulation results were completed in Phases 5 and 6

## Deferred scope

- inventory “teams using this Pokémon” visibility

## Implementation records

- [Saved-team domain and persistence](saved-team-domain-and-persistence.md)
- [Saved-team query and editor workflow](saved-team-workflow.md)

## Exit criteria

- [x] Saved-team record shape is versioned and runtime validated.
- [x] Lead, switch, and closer order is persisted.
- [x] Exactly three distinct inventory references are required.
- [x] Missing references and species-clause conflicts are rejected.
- [x] CRUD persistence is implemented behind a repository contract.
- [x] User can create and edit a team in the UI.
- [x] User can reopen, reorder, duplicate, and delete saved teams.
- [x] Missing/deleted members have a visible recovery state.

## Next phase

Phase 5 simulation adapters and saved-team matrices are delivered. Teams are
included in version-three full-data backups. Current freshness and repair
behavior is documented in the Phase 10 record linked above; inventory usage
visibility remains a separate enhancement.

## Relevant commits

See the owning file histories; `cdeef5032` adds the current snapshot-checked
analysis freshness persistence.
