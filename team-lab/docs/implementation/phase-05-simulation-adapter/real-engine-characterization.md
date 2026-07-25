# Real-Engine Browser Characterization

> **Status:** Harness implemented; observed upstream fixture capture pending
> **Route:** `/diagnostics/simulation`
> **Last reviewed:** 2026-07-25

## Outcome

TeamLab now has an application-facing diagnostics harness that invokes the
production `BrowserPvpokeRuntime`, not the fake runtime used by unit tests.

The harness:

- loads the real upstream classic-script chain;
- waits for the real upstream Game Master;
- runs two exact known Open Great League cases;
- executes every case twice;
- compares translated outputs for determinism;
- validates engine, version, identity, rating, HP, energy, and shield
  invariants;
- presents pass/fail details;
- exports a versioned JSON report suitable for committing as a future observed
  fixture.

## Why this is a diagnostics route

The upstream engine depends on browser script execution, DOM script injection,
jQuery AJAX, and the configured PvPoke HTTP path. A Node unit test cannot prove
that those deployment assumptions work.

The developer route tests the same runtime composition that future inventory
and team features will use:

```text
/diagnostics/simulation
        ↓
characterization suite
        ↓
PvpokeOneOnOneAdapter
        ↓
BrowserPvpokeRuntime
        ↓
real upstream scripts and Game Master
```

No diagnostic result is persisted automatically. This prevents a result from
one upstream data version from becoming an implicit baseline for another.

## Known exact cases

### Azumarill versus Altaria — one shield

```text
Azumarill
  level 45.5
  CP 1499
  IVs 0/15/15
  Bubble
  Ice Beam + Play Rough

Altaria
  level 29
  CP 1497
  IVs 0/14/15
  Dragon Breath
  Sky Attack + Moonblast

Shields: 1–1
```

### Whiscash versus Altaria — zero shields

```text
Whiscash
  level 27
  CP 1495
  IVs 4/15/15
  Mud Shot
  Scald + Blizzard

Altaria
  level 29
  CP 1497
  IVs 0/14/15
  Dragon Breath
  Sky Attack + Moonblast

Shields: 0–0
```

These builds use the upstream default Great League IV records represented in
the current catalog. The cases intentionally cover different fast-move
durations, charged-move costs, typing interactions, and shield scenarios.

## Determinism behavior

The suite runs each identical request twice through fresh upstream `Battle`
objects and compares:

- winner;
- both translated combatant summaries;
- turns to win;
- engine identity;
- data version.

Timing and human-readable assumptions are excluded from equality.

The upstream `Battle` default disables random buff application in simulated
battles, so these initial cases are expected to be deterministic. A mismatch
is reported rather than averaged or hidden.

## Invariant validation

Every observation verifies:

- engine is `pvpoke-upstream`;
- result data version matches the loaded catalog;
- combatant order and species IDs are unchanged;
- ratings remain between 0 and 1,000;
- remaining HP is between zero and maximum HP;
- remaining energy is between zero and 100;
- remaining shields do not exceed the configured starting shields.

These invariants detect broken translation even before exact output fixtures
are established.

## Fixture export

After a run, **Download fixture JSON** exports:

```text
reportVersion
generatedAt
dataVersion
passed
observations[]
  caseId
  description
  deterministic
  durationMs
  result
  invariantFailures
```

The exported report is evidence, not an automatically trusted golden fixture.
Before committing a baseline:

1. confirm the displayed upstream data version;
2. compare the result with the corresponding upstream PvPoke battle page;
3. rerun in a clean browser session;
4. remove or normalize duration and generation timestamp for golden testing;
5. document why any changed output is expected after an upstream update.

## Failure diagnostics

The route preserves typed bootstrap error messages and recommends checking:

- the upstream Docker container;
- the Vite `/pvpoke` proxy;
- `VITE_PVPOKE_BASE_URL`;
- JavaScript file availability;
- Game Master data availability.

The 15-second bootstrap timeout prevents an unavailable Game Master request
from leaving the workflow indefinitely pending.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/simulation/characterization.ts` | Cases, repeats, invariants, and report |
| `src/domain/simulation/characterization.test.ts` | Case and report contracts |
| `src/features/simulation/SimulationDiagnosticsPage.tsx` | Real-browser runner and export |
| `src/app/router.tsx` | Registers `/diagnostics/simulation` |
| `src/app/routes/HomePage.tsx` | Developer access to diagnostics |
| `src/styles/global.css` | Diagnostics results and responsive layout |

## Automated validation

The unit tests prove:

- exact case definitions remain stable;
- every case runs twice;
- deterministic output produces a passing report;
- the report is versioned and exportable.

They deliberately do not claim to execute browser globals.

## Environment limitation during implementation

At implementation time:

- no Chromium, Firefox, Playwright, or Puppeteer executable was available;
- the upstream Docker endpoint was not listening on localhost.

Therefore no real-engine numeric winner/rating fixture was fabricated or
committed. The browser harness is the honest mechanism for capturing that
evidence once the local upstream container and TeamLab dev server are running.

## How to capture the first report

With upstream PvPoke and TeamLab running:

1. open TeamLab;
2. select **Simulation diagnostics**;
3. run characterization;
4. confirm both cases pass;
5. download the JSON report;
6. compare it with upstream battle pages before adopting it as a baseline.

## Remaining limitations

- The harness covers two normal-form matchups only.
- It does not cover Shadow, buffs/debuffs, one-charged-move builds, special
  active forms, Best Buddy level 51, or asymmetric shields.
- It does not exercise TeamRanker.
- Exact golden numbers are not yet checked in automated CI.
- The diagnostics page is developer tooling, not the final user simulation UI.
