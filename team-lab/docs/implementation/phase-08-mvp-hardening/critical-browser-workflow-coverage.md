# Critical Browser Workflow Coverage

> **Phase:** Phase 8 — Backup and MVP Hardening  
> **Status:** Implemented  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab now has a self-contained real-Chrome workflow suite:

```bash
npm run test:browser
```

The suite starts isolated local upstream and Vite servers, launches a temporary
Chrome profile, drives the application through the Chrome DevTools Protocol,
and always terminates with bounded cleanup. It creates 12 real inventory
records through the UI, exercises populated analysis and team routes, measures
real TeamRanker work, verifies cooperative cancellation, downloads a full-data
backup, resets the application, and restores the downloaded artifact.

The coverage exposed and repaired one production defect: the saved-team editor
computed its initial three member IDs while the inventory query was pending,
leaving the controlled selectors empty after inventory arrived.

The measured realistic MVP scopes remain interactive. No worker boundary is
justified for the current MVP.

## Problem being solved

Domain and fake-IndexedDB tests prove computation and persistence contracts,
but cannot prove that:

- lazy routes work in a real browser;
- controlled forms persist through React, TanStack Query, Dexie, and IndexedDB;
- parameterized analysis, edit, and simulation routes resolve real records;
- classic PvPoke scripts bootstrap and execute inside Chrome;
- recommendation progress and cancellation remain interactive;
- browser download, typed reset, file selection, inspection, and restore work
  as one recovery sequence;
- populated narrow layouts avoid overflow;
- a failed browser command exits rather than leaving Chrome or servers alive.

The previous responsive slice used bounded one-off DevTools commands. This
slice turns the approach into a maintained project command.

## Harness architecture

The runner uses only Node, Vite, and a locally installed Chromium-compatible
browser:

```text
scripts/browser-workflows.ts
        ├── temporary static server → checked-in upstream src/
        ├── programmatic Vite server → TeamLab application
        ├── temporary Chrome profile and download directory
        └── Chrome DevTools Protocol client
                ↓
           semantic UI workflows
                ↓
           assertions + timing report
```

No Playwright, Selenium, browser extension, persistent browser profile, or
network service is required.

The runner locates Chrome in common macOS and Linux paths.
`TEAMLAB_CHROME_PATH` overrides detection.

## Isolation and termination

Every run creates one temporary root containing:

- an empty Chrome user-data directory;
- a download directory for the backup artifact.

The upstream and application servers bind only to `127.0.0.1` on
dynamically allocated ports.

Termination boundaries:

| Boundary | Limit |
| --- | ---: |
| Complete suite | 120 seconds |
| Normal UI/CDP step | 20 seconds |
| Engine workflow | 45 seconds |
| Maximum allowed event-loop gap | 500 ms |
| Individual cleanup wait | 3 seconds |

The runner closes the DevTools socket, terminates Chrome, closes both servers,
removes the temporary directory, and explicitly exits. Failure paths use the
same cleanup and return a non-zero status.

This explicit terminal behavior prevents the lingering WebSocket/process issue
encountered during the original manual audit.

## Browser fixture

The suite creates these current builds through `/inventory/new`:

```text
Azumarill
Altaria
Whiscash
Clodsire
Dunsparce
Gastrodon
Jumpluff
Mandibuzz
Dewgong
Feraligatr
Primeape
Toxapex
```

Each selection uses the current checked-in catalog, its published default
Great League spread, current moves, form validation, inventory factory,
repository mutation, and IndexedDB persistence. One record is favorited and
every record receives distinct fixture notes.

Twelve records provide enough ranked, species-distinct choices for real team
and recommendation workflows while keeping this interaction suite fast. The
separate scale characterization remains responsible for the deterministic
120-record and 30-team boundary.

## Covered workflow

```text
load and validate real upstream data
        ↓
create 12 inventory records through the form
        ↓
search and reset the populated inventory dashboard
        ↓
open populated analysis and edit routes
        ↓
create and edit a saved team
        ↓
run a Top-20 exact saved-team matrix
        ↓
start and cancel a Top-48 recommendation
        ↓
run default recommendations and save one selected team
        ↓
download version-two backup
        ↓
open typed RESET confirmation and reset all local data
        ↓
select, inspect, and merge-restore the downloaded backup
        ↓
verify 12 inventory records and 2 saved teams were restored
```

The test also asserts no horizontal document overflow at a true 320 px
viewport for these populated states:

- inventory analysis;
- saved-team simulation result;
- recommendation result;
- typed reset confirmation.

## Saved-team default hydration repair

`SavedTeamForm` previously calculated:

```text
defaultIds = inventory.slice(0, 3)
```

and immediately used that result as three `useState` initial values. On a cold
route, `useInventoryList` was pending during the first render, so
`defaultIds` was empty. React did not rerun the state initializers when the
query completed.

The form now performs one guarded effect after at least three records arrive.
It fills lead, switch, and closer once for a new team. Existing and duplicated
teams retain their stored members, and subsequent user choices are not
overwritten.

The browser suite reaches team creation from a cold isolated profile and
therefore protects the asynchronous hydration path.

## Main-thread measurements

The runner installs a 16 ms timer pulse before each measured action. The
largest delay between pulses approximates the longest main-thread occupation
visible to user input and rendering.

Recorded environment:

```text
Architecture: arm64
Node: v25.9.0
Chrome: installed local headless Chrome
OS: macOS 26.5.2
PvPoke data: 2026-07-21 01:32:55
```

Final recorded run:

| Workflow | Scope | End to end | Maximum pulse gap |
| --- | --- | ---: | ---: |
| Saved-team matrix | 3 × Top 20, 60 battles | 122 ms | 27 ms |
| Cancellation | 5 requested, Top 48; stop after active finalist | 152 ms | 38 ms |
| Default recommendation | 9 finalists, Top 5; 3 selected | 70 ms | 21 ms |

The saved-team UI reported 57 ms for its engine work. The default
recommendation completed all nine finalists without failure and returned all
three requested teams.

Timing values are environment observations, not device SLAs. The maintained
contract is that no measured pulse gap may exceed 500 ms and no engine
workflow may exceed its 45-second outer bound.

## Worker decision

No worker is added for the MVP browser workflows.

Evidence:

- the Top-20 saved-team matrix stayed below a 30 ms measured event-loop gap;
- a Top-48 recommendation exposed and honored the cancellation control after
  the active finalist;
- the default nine-finalist workflow yields between finalists and stayed below
  a 25 ms measured gap;
- all measured paths are far below the 500 ms regression ceiling;
- the upstream classic runtime relies on browser globals and mutable
  singletons, so worker migration would introduce a material integration and
  serialization boundary.

The warning for larger scopes remains truthful because synchronous work can
vary by browser and device. A future measurement that breaches the budget
must trigger chunking or worker investigation rather than merely increasing
the ceiling.

## Backup recovery coverage

The browser grants downloads only to the temporary directory. It verifies that
the downloaded JSON contains:

```text
12 inventory records
2 saved teams
10,283 bytes in the recorded run
```

The suite then:

1. opens the visible reset confirmation;
2. verifies the populated confirmation at 320 px;
3. types the exact `RESET` token;
4. confirms the atomic reset success state;
5. assigns the downloaded file to the real file input through DevTools;
6. waits for TeamLab's valid-inspection result;
7. performs merge restore;
8. verifies the restore counts and populated dashboard.

This executes the browser APIs that domain tests cannot represent: file
download, native file input, React change handling, and real IndexedDB.

## File ownership

| File | Responsibility |
| --- | --- |
| `scripts/browser-workflows.ts` | Server/browser lifecycle, CDP client, semantic workflows, measurements, and cleanup |
| `package.json` | Visible `test:browser` command |
| `src/features/teams/SavedTeamFormPage.tsx` | One-time asynchronous member-default hydration repair |

## Important decisions

- The suite uses semantic labels, button text, roles, headings, and route
  links instead of production-only test IDs.
- Inventory is created through the public UI; the harness does not bypass
  domain validation or write IndexedDB fixtures directly.
- Backup restore reuses the exact file downloaded earlier in the same run.
- The large-scope cancellation case uses the supported Top-48 option.
- Browser timing is protected by a generous event-loop-gap regression ceiling,
  not exact elapsed-time snapshots.
- Browser coverage remains a separate command because it requires local
  Chrome and the inherited upstream checkout.

## Rejected alternatives

- Adding Playwright solely for this slice was rejected because Chrome,
  DevTools, Vite, and Node already provide the required isolated boundary.
- Seeding IndexedDB directly was rejected for the core fixture because it
  would skip the form, factory, query, and repository integration.
- Using the two-battle diagnostics page as the only engine evidence was
  rejected because it does not represent saved-team or finalist workflows.
- Testing cancellation only in domain code was rejected because visibility
  and browser event-loop access are part of the product behavior.
- Raising a failing timing ceiling without investigating is explicitly not an
  accepted maintenance path.

## Validation

Focused command:

```bash
npm run test:browser
```

Complete project validation:

```bash
npm test
npm run test:scale
npm run test:browser
npm run typecheck
npm run lint
npm run build
```

Observed browser result:

```text
12 inventory records created through the UI
Top-20 saved-team matrix passed
Top-48 recommendation cancelled after the active finalist
default 9-finalist recommendation completed; 3 of 3 selected
full-data backup downloaded, reset, inspected, and restored
4 populated responsive states passed at 320 px
12 inventory records and 2 saved teams restored
suite exited successfully in approximately 12 seconds
```

## Known limitations

- The runner currently targets Chromium-compatible browsers; Safari and
  Firefox are not automated.
- Semantic text changes require corresponding workflow assertion updates.
- The 12-record browser fixture complements rather than replaces the
  120-record Node scale characterization.
- Event-loop pulse gaps approximate responsiveness but are not a full browser
  performance trace.
- Individual inventory deletion still uses `window.confirm` and is covered by
  repository/domain tests rather than this critical happy-path sequence.
- The suite assumes the TeamLab directory remains inside the inherited PvPoke
  checkout so the parent `src/` tree is available.

## Safe extension points

- Add a second browser executable through `TEAMLAB_CHROME_PATH` in CI.
- Record DevTools performance traces only when a regression needs deeper
  diagnosis.
- Add a browser flow for legacy version-one import if native file coverage
  needs to extend beyond the current full-data contract.
- Increase browser fixture size only when measuring rendering behavior; keep
  the normal interaction suite bounded.

## Follow-up work

The subsequent
[Local User Documentation](local-user-documentation.md) slice explains
inventory, teams, recommendations, backup/recovery, destructive controls,
scope warnings, data locality, and the current Great League-only boundary
without requiring implementation records.

## Relevant commits

Not yet committed.
