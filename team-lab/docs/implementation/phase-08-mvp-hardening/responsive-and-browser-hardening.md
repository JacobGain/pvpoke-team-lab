# Responsive and Browser Hardening

> **Phase:** Phase 8 — Backup and MVP Hardening  
> **Status:** Implemented  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab has completed its MVP responsive pass. The routed feature families were
audited against the desktop-primary requirement, and every directly reachable
route now fits a real 320 CSS-pixel Chrome viewport without horizontal
document overflow.

The pass found and repaired one measured overflow in the backup file picker,
hardened shared cards, forms, actions, progress, and diagnostics at narrow
widths, and introduced route-level code splitting. The production entry chunk
fell from approximately 660 kB to 406 kB and no longer triggers Vite's 500 kB
chunk warning.

A bounded real-browser run also passed the checked-in TeamRanker diagnostic:
two exact battles completed in 62 ms, with 80 ms from click to rendered result
in the recorded environment.

## Problem being solved

Earlier phases added responsive rules feature by feature. That did not prove
that the complete MVP:

- remained usable at the 320 px minimum mobile width;
- avoided intrinsic-width overflow from native controls;
- kept actions and progress readable when labels wrapped;
- avoided loading every feature and simulation dependency on first visit;
- could still bootstrap and execute the real upstream TeamRanker in Chrome.

The project remains desktop-primary. This pass protects basic mobile
navigation, record viewing, and forms; it does not redesign bulk entry or
simulation as mobile-first workflows.

## Implemented behavior

### Shared narrow-width behavior

At 520 px and below:

- primary page gutters reduce to half a rem;
- home cards use tighter padding and full-width navigation actions;
- page headings scale down and may wrap long content;
- form sections and result cards use compact padding;
- form actions stack with the safe/cancel action last in source but first
  visually;
- matchup selectors use the available width instead of a fixed minimum.

At 760 px and below:

- inventory and catalog summaries may shrink without forcing overflow;
- catalog cards use one bounded column;
- diagnostics actions occupy the full available width;
- recommendation run actions and result actions stack;
- recommendation progress labels and counts stack instead of competing on one
  line;
- inventory card headings can wrap their badges.

Links and native form controls now have global wrapping and maximum-width
guards. The backup file input additionally has explicit `width: 100%` and
`min-width: 0`, which is required to override Chrome's native intrinsic file
control width at 320 px.

### Route-level loading

The home and not-found pages remain in the entry bundle. Every feature route
uses `React.lazy` behind a shared `Suspense` loading boundary:

```text
home entry
    ↓ user navigation
shared route-loading state
    ↓ dynamic import
catalog, inventory, analysis, teams, simulation, diagnostics, or recommendation
```

Direct URL visits and client-side navigation use the same boundary. The
loading message is announced through an `aria-live="polite"` region.

### Real-browser TeamRanker check

The diagnostic route loaded the real checked-in classic PvPoke scripts and
Game Master data through the development proxy. A bounded Chrome DevTools
Protocol runner:

1. navigated to `/diagnostics/simulation`;
2. waited for the TeamRanker control;
3. clicked the normal page action;
4. waited for either the result banner or an alert;
5. exited on success, failure, or a 30-second process timeout.

Observed result:

```text
TeamRanker result: Passed
Battles: 2
Engine-reported duration: 62 ms
Click-to-render duration: 80 ms
Whiscash average rating: 444
Viewport/document width: 1440 / 1440
```

This closes the real-browser question for the small diagnostic scope. It does
not establish that every configurable recommendation scope avoids a long
synchronous main-thread task.

## Browser audit matrix

Chrome device metrics were used so the layout viewport was a genuine 320 px.
This avoids the 500 px minimum layout viewport seen when relying only on
headless Chrome's `--window-size`.

| Route | 320 px viewport | Document width | Result |
| --- | ---: | ---: | --- |
| `/` | 320 | 320 | Pass |
| `/catalog` | 320 | 320 | Pass |
| `/inventory` | 320 | 320 | Pass |
| `/inventory/new` | 320 | 320 | Pass |
| `/inventory/backup` | 320 | 320 | Pass after file-input repair |
| `/teams` | 320 | 320 | Pass |
| `/teams/new` | 320 | 320 | Pass |
| `/diagnostics/simulation` | 320 | 320 | Pass |
| `/recommend` | 320 | 320 | Pass |

Home, catalog, inventory, recommendation, and diagnostics presentation were
also visually reviewed with real upstream data at the available 500 px
headless viewport. Home presentation and the TeamRanker result were reviewed
at 1440 px.

Parameterized inventory analysis/edit and saved-team simulation routes require
persisted records. Their implementations and shared responsive selectors were
source-audited in this slice, but populated browser interaction coverage is
explicitly deferred to the critical-workflow test slice.

## File ownership

| File | Responsibility |
| --- | --- |
| `src/app/LazyRoutePages.tsx` | Lazy feature imports and accessible shared route-loading boundary |
| `src/app/router.tsx` | Route declarations and eager-versus-lazy route policy |
| `src/styles/global.css` | Shared 320–760 px behavior and native-control overflow repair |
| `src/features/simulation/SimulationDiagnosticsPage.tsx` | Existing real-browser one-on-one and TeamRanker diagnostic controls |

## Important decisions

- A 320 px CSS viewport is the MVP lower bound because the global stylesheet
  already declares that minimum and the project plan requires mobile-width
  usability.
- Device metrics are used for narrow headless checks; window size alone does
  not create a sub-500 px layout viewport in the installed Chrome.
- Feature routes are split at route boundaries rather than manually splitting
  domain modules. This gives meaningful initial-load savings with a small,
  visible loading contract.
- No browser-test dependency is added in this slice. Chrome was already
  available, and the next slice owns durable critical-workflow automation.
- The two-battle TeamRanker diagnostic is evidence for engine bootstrap and a
  bounded small run, not a broad performance guarantee.

## Rejected or deferred alternatives

- Treating the cropped 390 px screenshot as an application overflow was
  rejected after device inspection showed a 500 px layout viewport.
- Hiding overflow at the page root was rejected because it would conceal
  unusable controls. The native file input's intrinsic width was repaired.
- Keeping one eager production bundle was rejected after the build exposed a
  large initial chunk and the routes offered natural loading boundaries.
- Adding a worker solely for the measured two-battle diagnostic was rejected;
  the 62 ms engine duration does not justify a new upstream-runtime contract.
- Claiming large-scope TeamRanker responsiveness from the small diagnostic was
  rejected. Populated recommendation and saved-team workflows remain browser
  coverage work.

## Validation

Automated project validation:

```bash
npm test
npm run test:scale
npm run typecheck
npm run lint
npm run build
```

Browser validation used:

```text
Chrome headless with DevTools device metrics
checked-in PvPoke data and classic scripts
320 px route overflow matrix
500 px visual feature review
1440 px home and TeamRanker review
30-second outer timeout for every DevTools runner
```

Observed after this slice:

```text
npm test          26 files, 76 tests passed
npm run test:scale passed
npm run typecheck passed
npm run lint      passed
npm run build     passed; largest entry chunk approximately 406 kB
320 px route audit passed with no horizontal document overflow
TeamRanker        passed; 62 ms engine / 80 ms click-to-render
```

## Known limitations

- The route matrix verifies layout overflow and route availability, not every
  interaction or populated application state.
- Headless Chrome on one development machine is not a device compatibility
  matrix.
- Safari was not automated.
- The TeamRanker timing is environment-specific and covers only two battles.
- Larger synchronous finalist/meta scopes may still block the main thread
  between cooperative recommendation yields.
- Route loading failures use React's normal error propagation; TeamLab does not
  yet provide a route-specific retry boundary.

## Safe extension points

- Add a browser runner that seeds IndexedDB and exercises populated inventory,
  team, analysis, simulation, recommendation, backup, and destructive flows.
- Preserve the 320 px `scrollWidth === clientWidth` assertion in future
  browser automation.
- Add route-specific error recovery if deployed chunk loading becomes an
  observed failure.
- Add browser performance marks around each real finalist simulation before
  deciding whether the upstream runtime needs a worker boundary.

## Follow-up work

The subsequent
[Critical Browser Workflow Coverage](critical-browser-workflow-coverage.md)
slice seeded persisted data, exercised parameterized and recovery routes, and
closed the no-worker decision with realistic TeamRanker measurements.

Local user documentation was completed in
[Local User Documentation](local-user-documentation.md), closing Phase 8 for
the MVP.

## Relevant commits

Not yet committed.
