# Local User Documentation

> **Phase:** Phase 8 — Backup and MVP Hardening  
> **Status:** Implemented  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab now has a user-facing local guide at
`docs/USER-GUIDE.md` and a concise quick start in the application README.

The guide explains how to start the inherited PvPoke runtime and TeamLab
together, use every MVP workflow, protect local browser data, recover from a
backup, diagnose common failures, and understand the current Open Great
League-only boundary.

This completes the final Phase 8 exit criterion.

## Problem being solved

Before this slice, the repository README only instructed users to start Vite.
That was insufficient because TeamLab also requires the inherited PvPoke
Apache server for:

- Game Master data;
- Open Great League rankings;
- the Great League meta group;
- classic Battle, Pokémon, GameMaster, and TeamRanker scripts.

Implementation records described every subsystem but assumed architectural
context and were not an appropriate first-use manual.

A local user also needed clear warnings that:

- IndexedDB is isolated by browser origin;
- clearing site data can permanently remove the only local copy;
- changing Vite hostname or port exposes a different data store;
- merge and replace have different cross-record semantics;
- large engine scopes can occupy the browser;
- current/planned builds and assumptions are materially different.

## Documentation structure

### Repository README

`README.md` now provides:

- a concise product description;
- complete local requirements;
- the two-terminal quick start;
- the normal local URL and connection-ready signal;
- the local-only data warning;
- complete validation commands;
- direct links to user, project, and implementation documentation.

### Local user guide

`docs/USER-GUIDE.md` owns operational documentation:

```text
requirements and startup
        ↓
catalog and inventory
        ↓
analysis and saved teams
        ↓
simulation and recommendations
        ↓
backup, restore, and destructive controls
        ↓
data refresh and troubleshooting
        ↓
MVP limitations and maintainer validation
```

Implementation records remain focused on architecture, contracts, decisions,
tests, and extension boundaries.

## Covered user workflows

The guide documents:

- default and alternate-port local startup;
- PvPoke connection verification;
- browser-origin storage behavior;
- catalog search and current-meta filtering;
- exact inventory entry and legal-level inference;
- entered versus assumed IV provenance;
- current versus planned builds;
- favorites, notes, edit, duplication, filtering, sorting, and deletion;
- IV/build analysis and named-opponent assumptions;
- ordered team creation, reordering, species clause, and repair states;
- saved-team target/shield scopes and exact matrix results;
- scorecards, threats, alternatives, and upstream links;
- one- and two-anchor recommendation constraints;
- result count, build-status scope, roles, shields, progress, and cancellation;
- result evidence and explicit saved-team conversion;
- full-data backup download and inspection;
- merge, replace, and legacy version-one behavior;
- clear-saved-teams, guarded inventory clear, and typed reset;
- data refresh expectations;
- common connection, engine, validation, reference, recommendation, storage,
  and backup failures;
- maintainer validation commands.

## Important safety guidance

The guide makes these recovery rules explicit:

1. Local data belongs to one browser profile and origin.
2. A different hostname or port uses a different IndexedDB store.
3. Site-data clearing has no in-application undo.
4. A JSON backup should be downloaded before origin/profile changes and
   destructive operations.
5. Inspection is read-only.
6. Merge preserves unrelated IDs but validates the complete final state.
7. Replace makes the backup authoritative.
8. A legacy version-one replace removes saved teams because the file contains
   none.
9. Reset requires the exact text `RESET`.

## File ownership

| File | Responsibility |
| --- | --- |
| `README.md` | Product entry point, requirements, quick start, validation, and documentation links |
| `docs/USER-GUIDE.md` | Complete local operation, recovery, troubleshooting, and limitations guide |
| `docs/implementation/README.md` | Contributor-facing implementation index and link back to user documentation |
| `docs/implementation/phase-08-mvp-hardening/README.md` | Completed Phase 8 scope and exit criteria |

## Important decisions

- User instructions live outside `docs/implementation/` so users do not need
  architectural context to operate the product.
- The README stays short and links to one canonical detailed guide.
- The normal startup uses the inherited repository's Docker/Makefile path
  rather than introducing another server mechanism.
- Alternate-port instructions preserve `/pvpoke/src` and change only the Vite
  proxy target.
- The guide names the normal Vite URL but tells users to follow Vite's printed
  URL.
- Browser-origin isolation is explained with concrete localhost,
  `127.0.0.1`, and alternate-port examples.
- Product claims match current MVP behavior and retain uncertainty around
  assumptions, simulation, and recommendations.

## Rejected alternatives

- Expanding implementation records into a user manual was rejected because it
  would mix audiences and make first use harder.
- Documenting only `npm run dev` was rejected because it produces a frontend
  that cannot load the required upstream resources by itself.
- Treating local browser storage as self-evident was rejected because origin
  changes and site-data clearing are common causes of apparent data loss.
- Describing simulation or recommendations as predictive truth was rejected;
  the guide presents them as scoped decision support.
- Adding screenshots was deferred because the MVP UI is still changing and
  text instructions are currently easier to keep version-accurate.

## Validation

Documentation was checked against:

- current route headings and navigation labels;
- form controls and available target counts;
- current/planned inventory schemas;
- saved-team reference and species-clause behavior;
- recommendation settings and cooperative cancellation;
- version-two and legacy backup contracts;
- maintenance repository guards;
- Docker Compose, Vite proxy, and environment configuration;
- the passing critical Chrome workflow.

Commands:

```bash
npm test
npm run test:scale
npm run test:browser
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

## Known limitations

- The guide is English-only.
- It documents local development operation, not public production deployment.
- Browser screenshots and video walkthroughs are not included.
- Docker Desktop/Engine installation is referenced as a requirement rather
  than documented for every operating system.
- Multi-browser compatibility remains broader than the automated Chrome
  workflow.

## Safe extension points

- Add screenshots only with a repeatable capture/update process.
- Split troubleshooting into its own document if operational cases grow.
- Add hosted deployment instructions when a supported deployment target
  exists.
- Add migration sections when backup or database versions change.
- Add league-specific sections when the product moves beyond Open Great
  League.

## Follow-up work

Phase 8 is complete for the MVP. Future work should use the Post-MVP priorities
in `docs/PROJECT-PLAN.md` and update the user guide whenever behavior, setup,
storage, or recovery contracts change.

## Relevant commits

Not yet committed.
