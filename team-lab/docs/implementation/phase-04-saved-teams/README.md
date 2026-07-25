# Phase 4 — Saved Teams

> **Status:** Complete for MVP
> **Project-plan phase:** Phase 4: saved teams
> **Last reviewed:** 2026-07-25

## Objective

Allow a user to persist an ordered, legal Great League team made from exactly
three inventory records:

1. Lead
2. Safe switch
3. Closer

Saved teams reference inventory identities rather than copying Pokémon builds.
Inventory therefore remains the source of truth for later analysis and
simulation.

## Implemented scope

- version-one saved-team Zod schema
- explicit Open Great League format identity
- persisted lead, switch, and closer order
- three distinct inventory-reference requirement
- names, notes, timestamps, and optional analysis-version metadata
- inventory-reference resolution
- current/planned target-species resolution
- Pokédex-identity species clause
- stable legality issues and typed aggregate error
- create/update factories
- analysis freshness invalidation on update
- storage-independent repository contract
- Dexie CRUD implementation with read/write validation
- additive TeamLab IndexedDB version-two schema
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

## Deferred scope

- team backup and restore
- inventory “teams using this Pokémon” visibility
- scorecards and simulation results

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

Begin the Phase 5 PvPoke simulation adapter using these stable ordered-team
contracts. Saved-team backup/restore and inventory usage visibility remain
useful Phase 4 enhancements but are not required by the MVP exit criterion.

## Relevant commits

Not yet committed.
