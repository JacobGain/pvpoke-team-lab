# Representative-Scale Characterization

> **Phase:** Phase 8 — Backup and MVP Hardening  
> **Status:** Implemented  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab now has a reproducible cold-cache characterization covering 120
inventory records and 30 saved teams. It exercises the real inventory view,
version-two backup inspection, atomic Dexie restore, validated repository
reads, candidate-pool construction, and bounded static recommendation
generation.

The characterized paths remain within explicit regression budgets. Static
recommendation discovery is the largest synchronous operation at roughly
280 ms in the recorded environment, while inventory filtering, backup,
restore, and repository reads remain in the low milliseconds.

No new worker or list virtualization boundary is justified for these paths in
the MVP.

## Problem being solved

The project targets competitive users with more than 100 Great League records.
Small fixtures prove correctness but cannot establish that:

- inventory filtering and sorting remain immediate;
- backup artifacts remain small;
- complete validation does not become expensive;
- atomic two-table restore remains practical;
- recommendation discovery obeys its work caps;
- a future change does not accidentally reintroduce exhaustive generation.

Performance assertions must remain deterministic enough for the normal test
suite while still exposing measured values for local review.

## Representative fixture

The characterization creates:

```text
120 current inventory records
120 distinct catalog species identities and Pokédex numbers
120 published ranking and six-role evidence records
48 catalog entries marked as current meta
12 favorites
30 valid saved teams
```

Species reuse the three characterized base-stat and movepool shapes from the
inventory test catalog while retaining distinct catalog identities. This
keeps CP, IV, move, and team legality real without depending on a network data
snapshot.

Distinct species identities deliberately exercise cold IV-ranking work and
the largest one-anchor partner-combination shape allowed by the static policy.

## Characterized workflow

```text
create catalog, inventory, and teams
        ↓
filter/search/favorite/species-sort inventory view
        ↓
create + serialize + inspect full-data backup
        ↓
replace into empty Dexie database
        ↓
validated inventory and team repository reads
        ↓
clear IV-ranking cache
        ↓
build one-anchor candidate pool
        ↓
generate bounded static finalists
```

The test removes the temporary database and clears IV-ranking caches in a
`finally` block.

## Recommendation bounds

With one anchor and 119 eligible partners, the version-one static policy
produces:

| Boundary | Observed |
| --- | ---: |
| Eligible partners | 119 |
| Considered partners | 40 |
| Omitted eligible partners | 79 |
| Generated two-partner combinations | 780 |
| Unique species teams | 780 |
| Retained static teams | 250 |
| Requested finalist target | 9 |
| Retained diverse finalists | 9 |

These assertions protect the shortlist-before-simulation architecture. A
future change that accidentally considers all `C(119, 2) = 7,021`
combinations or retains every team will fail characterization.

## Inventory-view optimization

The dashboard previously called `catalog.entries.find` during every filter
record and species-sort comparison.

`filterAndSortInventory` now builds one catalog map per memoized transformation
and owns search, status, favorite, and sort behavior as a pure function. The
React page retains `useMemo` and delegates to this characterized boundary.

At 120 records, a favorite-only species-name search and sort takes about
4.3 ms in the recorded environment. Virtualization is not needed for the MVP
inventory target.

## Observed measurements

Command:

```bash
npm run test:scale
```

Recorded environment:

```text
Architecture: arm64
Node: v25.9.0
OS: macOS 26.5.2
```

Representative run:

| Operation | Observed |
| --- | ---: |
| Fixture creation | 5.0 ms |
| Inventory view transformation | 4.3 ms |
| Backup create, serialize, and inspect | 4.6 ms |
| Atomic two-table replace restore | 11.3 ms |
| Validated repository reads | 2.1 ms |
| Cold recommendation discovery | 279.7 ms |
| Complete characterized workflow | 307.4 ms |
| Serialized backup size | 104,252 bytes |

Timing values are diagnostic rather than promises for every device. Structural
counts and generous regression ceilings are the stable contract.

## Regression budgets

The test currently enforces:

| Operation | Budget |
| --- | ---: |
| Fixture creation | 2,000 ms |
| Inventory view transformation | 100 ms |
| Backup round trip | 250 ms |
| Atomic restore | 500 ms |
| Repository reads | 250 ms |
| Cold recommendation discovery | 1,500 ms |
| Complete workflow | 2,500 ms |
| Serialized backup | under 2 MB |

Budgets include substantial CI and hardware margin. They are intended to catch
algorithmic regressions, not microbenchmark noise.

## Worker and virtualization decision

No worker is added for:

- inventory filtering and sorting;
- backup serialization or inspection;
- IndexedDB restore and reads;
- bounded static recommendation discovery.

The measured costs do not justify worker message contracts, duplication of
catalog/inventory data, or more complex cancellation behavior.

Exact TeamRanker execution is intentionally outside this Node
characterization because it depends on the real browser-hosted upstream
runtime. It remains sequential, defaults to Top 5 targets, reports progress,
supports cancellation before the next finalist, and warns for large target
scopes. Browser-level hardening must verify its main-thread behavior before
the remaining Phase 8 responsiveness criterion is closed.

## File ownership

| File | Responsibility |
| --- | --- |
| `src/performance/mvpScale.characterization.test.ts` | Deterministic 120-record fixture, workflow measurements, structural limits, and budgets |
| `src/features/inventory/inventoryView.ts` | Map-backed pure inventory filtering and sorting |
| `src/features/inventory/InventoryPage.tsx` | Memoized consumer of the characterized view transformation |
| `package.json` | Visible `test:scale` command |

## Important decisions

- The fixture uses stable synthetic catalog identities rather than current
  network data.
- Cold IV-ranking caches represent a conservative first recommendation run.
- Structural work bounds are more stable than exact timing values.
- Timing ceilings retain generous environment margin.
- Optimization was limited to the repeated catalog lookup found in the
  inventory view.
- Worker and virtualization complexity is deferred where measurements do not
  justify it.

## Rejected or deferred alternatives

- Measuring an empty adapter loop was rejected because it would not
  characterize real TeamLab work.
- Using only three repeated species was rejected because it would hide
  cold-cache IV analysis and species-team generation.
- Treating exact local timings as product SLAs was rejected because hardware
  and test-run contention vary.
- Adding virtualization at 120 records was rejected because the data
  transformation remains immediate; browser rendering is audited separately.
- Simulating browser TeamRanker with a fake Node adapter was rejected as a
  misleading engine-performance measurement.

## Validation

```bash
npm run test:scale
npm test
npm run typecheck
npm run lint
npm run build
```

Observed after this slice:

```text
npm test          26 files, 76 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

## Known limitations

- Measurements do not include React DOM layout and painting.
- The synthetic catalog is representative of work shape, not the current
  competitive meta distribution.
- Exact browser TeamRanker performance is not measured by this Node fixture.
  The subsequent
  [responsive/browser slice](responsive-and-browser-hardening.md) records the
  small real-engine diagnostic.
- Budgets are regression tripwires rather than device support guarantees.
- Mobile layout behavior is covered by the subsequent responsive/browser
  audit; populated browser-workflow performance remains separate.

## Safe extension points

- Add browser performance marks around exact TeamRanker finalists.
- Add React browser tests that render 120 inventory cards.
- Add a larger optional local benchmark without slowing the standard suite.
- Tighten budgets only after collecting results across supported development
  and CI machines.

## Follow-up work

The cross-feature responsive audit and small real TeamRanker diagnostic were
completed in
[Responsive and Browser Hardening](responsive-and-browser-hardening.md).
Critical populated browser-workflow coverage and realistic large-scope
TeamRanker measurement remain.

## Relevant commits

Not yet committed.
