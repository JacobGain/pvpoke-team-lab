# PvPoke Data Connection

> **Phase:** Phase 1 — Upstream Data Boundary  
> **Status:** Complete for Game Master, overall rankings, and meta groups  
> **Last reviewed:** 2026-07-24

> **Superseded 2026-07-27:** TeamLab now copies these validated inputs to
> `public/vendor/pvpoke/` with `npm run sync:pvpoke`. The repository and query
> layers remain, but the Vite proxy, external server, and runtime environment
> URL described below were removed. See
> [PvPoke asset maintenance](../../PVPOKE-DATA.md).

## Summary

TeamLab reads upstream PvPoke JSON through typed HTTP repositories, validates
it with Zod, caches requests through TanStack Query, and displays a connection
status without changing or copying upstream files.

## Problem being solved

The inherited application:

- loads JSON directly with jQuery;
- shares broad mutable data through a global singleton;
- assumes paths and globals;
- performs limited schema validation;
- sometimes normalizes values only at point of use.

TeamLab needs the data but should not inherit those architectural assumptions.

## Data flow

```text
src/data/*.json served by Apache
    ↓
VITE_PVPOKE_BASE_URL
    ↓
HTTP repository
    ↓
fetchValidatedJson
    ↓
Zod schema
    ↓
typed upstream record
    ↓
TanStack Query cache
    ↓
TeamLab feature/normalizer
```

## Environment and local proxy

Default browser base:

```text
/pvpoke/src
```

Default development proxy target:

```text
http://localhost
```

Configuration is documented in `.env.example`:

```dotenv
VITE_PVPOKE_BASE_URL=/pvpoke/src
PVPOKE_DEV_PROXY_TARGET=http://localhost
```

The browser requests the same `/pvpoke/src/...` path used by the upstream
application. During Vite development, `/pvpoke` is proxied to Apache. In a
future same-origin deployment, the browser can request the path directly.

Phase 6 also uses `VITE_PVPOKE_BASE_URL` for links into the interactive PvPoke
UI, keeping the data and page configuration on the same upstream base.

## Loaded resources

### Game Master

```text
data/gamemaster.min.json
```

Required validated fields include:

- identity/title/timestamp;
- settings;
- Pokémon;
- moves;
- formats;
- cups.

### Rankings

Pattern:

```text
data/rankings/<cup>/<category>/rankings-<cp>.json
```

Current request:

```text
data/rankings/all/overall/rankings-1500.json
```

### Meta group

Pattern:

```text
data/groups/<group>.json
```

Current request:

```text
data/groups/great.json
```

## File ownership

| File | Responsibility |
| --- | --- |
| `team-lab/.env.example` | Documents browser and dev-proxy paths |
| `team-lab/vite.config.ts` | Proxies `/pvpoke` during local development |
| `team-lab/src/vite-env.d.ts` | Types TeamLab environment values |
| `team-lab/src/pvpoke/types/schemas.ts` | Validates raw upstream contracts |
| `team-lab/src/pvpoke/types/models.ts` | Defines TeamLab format/status values |
| `team-lab/src/pvpoke/repositories/contracts.ts` | Repository interfaces |
| `team-lab/src/pvpoke/repositories/http.ts` | Shared fetch/JSON/schema handling |
| `team-lab/src/pvpoke/repositories/HttpPvpokeRepositories.ts` | Resource URL construction |
| `team-lab/src/pvpoke/repositories/index.ts` | Environment-based composition |
| `team-lab/src/features/meta/pvpokeDataQueries.ts` | Query keys/options |
| `team-lab/src/features/meta/usePvpokeDataStatus.ts` | Aggregated connection state |
| `team-lab/src/features/meta/PvpokeDataStatusCard.tsx` | Connection-status UI |
| `team-lab/scripts/validate-pvpoke-data.ts` | Filesystem-based real-data check |

## Repository contracts

```ts
interface GameMasterRepository {
  load(): Promise<GameMasterData>;
}

interface RankingRepository {
  load(request: RankingRequest): Promise<Ranking[]>;
}

interface MetaGroupRepository {
  load(groupId: string): Promise<MetaGroupEntry[]>;
}
```

Features depend on these contracts rather than `fetch()` or concrete paths.

## Query behavior

Queries have stable keys separated by:

- resource;
- cup;
- category;
- CP;
- group ID.

The currently loaded versioned JSON is treated as immutable for the page
session and receives infinite stale time. Reloading the application picks up a
new upstream deployment.

More explicit version polling can be introduced during deployed synchronization
work.

## Error handling

`PvpokeDataError` distinguishes the external resource involved.

Failures include:

- network/connection failure;
- non-success HTTP status;
- malformed JSON;
- schema mismatch.

The status card presents a retry action. Errors are not silently replaced with
empty arrays.

## Upstream inconsistencies discovered

### Numeric strings

`buffApplyChance` is serialized as a string in existing move data. Upstream
uses `parseFloat()` when constructing moves.

The TeamLab schema uses numeric coercion at the boundary and produces a number
internally.

### Nullable move-use counts

Some generated ranking move-usage values are `null`.

The external schema preserves `number | null` rather than inventing a zero,
because zero usage and unknown/invalid generation are different facts.

## Validation

```bash
npm run validate:data
```

This reads the checked-in files directly, runs the same schemas used by the
browser, builds the normalized catalog, and prints data counts.

The command uses Node’s type-stripping mode so the shared TypeScript contracts
run without a separate script build.

## Known limitations

- No request cancellation is explicitly wired beyond browser/query behavior.
- No persistent HTTP cache exists.
- Schema errors show a concise message in the UI, while full Zod detail remains
  in the error cause/developer tools.
- No role ranking repositories are requested by current features.
- No custom Game Master selection is implemented.

## Safe extension points

- Add ranking categories through `RankingRequest`.
- Add group IDs through `MetaGroupRepository`.
- Add new schemas before exposing new upstream resources.
- Add alternate repository implementations without changing features.
- Add version checks in query composition.

## Relevant commits

```text
603e67996  data connection pt.1: schemas
ecd7b3a92  data connection pt.2: repositories
31d63c739  data connection pt.3: features, scripts, routes, etc.
61ce18623  validation script
```
