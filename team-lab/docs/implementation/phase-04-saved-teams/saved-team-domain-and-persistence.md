# Saved-Team Domain and Persistence

> **Status:** Implemented
> **Last reviewed:** 2026-07-25

## Outcome

TeamLab now has a stable domain and local persistence boundary for saved Great
League teams. No React feature owns or invents the saved-team data shape.

## Persisted model

```text
SavedTeam
├── schemaVersion: 1
├── teamId: UUID
├── name
├── formatId: "great-league"
├── members
│   ├── leadInventoryId
│   ├── switchInventoryId
│   └── closerInventoryId
├── notes
├── lastAnalyzedDataVersion?
├── createdAt
└── updatedAt
```

The three named member fields intentionally preserve role order more clearly
than a generic array index. They also match the conceptual model in the
project plan.

`formatId` is deliberately constrained to `great-league` in schema version
one. Supporting another league will require an explicit schema/domain change,
not an arbitrary string that current validation silently treats as Great
League.

## Reference ownership

Members store inventory UUIDs only. Species, CP, IVs, moves, Shadow state, and
planned-build information are not copied into the team.

This prevents stale duplicated builds and means:

- inventory edits are reflected the next time a team is resolved;
- deletion can be detected as a missing reference;
- simulation can consume the same inventory analysis contracts;
- eventual remote storage can normalize inventory and teams independently.

The tradeoff is intentional referential softness: IndexedDB does not enforce a
foreign key. A deleted inventory record can leave a saved team incomplete.
Phase 4 UI must expose that state rather than cascade-delete the team or hide
the problem.

## Structural validation

The Zod schema enforces:

- schema version one;
- UUID identities;
- a non-empty trimmed name up to 100 characters;
- exactly the Great League format currently supported;
- three named inventory references;
- three different inventory IDs;
- notes up to 2,000 characters;
- ISO timestamps;
- `updatedAt >= createdAt`;
- a bounded optional analysis data version.

Structural validation runs on every repository write and read.

## Legality validation

`validateSavedTeamLegality` resolves all three references against the provided
inventory and catalog snapshots.

For a current record, it uses `speciesId`. For a planned record, it uses
`plannedBuild.targetSpeciesId`, because that is the build the saved team is
choosing.

Stable issue codes are:

- `inventory-record-not-found`
- `species-not-found`
- `species-clause`

Species clause compares the resolved catalog Pokédex number. Consequently,
separate specimens, Shadow variants, and alternate forms with the same
Pokédex identity cannot bypass the clause.

The schema separately prohibits referencing the exact same inventory UUID
twice. That is a structural error; two different owned records of the same
species are a legality error.

The factories assert legality before returning a new or updated domain record.
The repository validates persisted structure but does not own catalog or
inventory dependencies. This keeps persistence portable and prevents Dexie
from becoming a domain service.

## Factory behavior

`createSavedTeam` supplies:

- schema version;
- UUID;
- Great League format;
- default empty notes;
- equal creation/update timestamps.

`updateSavedTeam` preserves team identity and creation time, refreshes
`updatedAt`, revalidates legality, and clears `lastAnalyzedDataVersion`.
Changing membership or order therefore cannot retain a misleading “analyzed
against” marker.

## Repository contract

```text
list()
get(teamId)
create(team)
update(team)
delete(teamId)
count()
```

Create is not an upsert. Duplicate identities throw
`SavedTeamAlreadyExistsError`; missing update/delete targets throw
`SavedTeamNotFoundError`.

Invalid stored data throws `InvalidStoredSavedTeamError` with the affected
identity and Zod cause. The invalid record remains in IndexedDB for a future
repair/export workflow.

## IndexedDB version two

Database: `team-lab`

Version two preserves the version-one inventory definition and adds:

```text
savedTeams:
  &teamId,
  formatId,
  name,
  createdAt,
  updatedAt
```

The upgrade is additive and has no data-transforming migration because no team
table previously existed.

The indexes support identity lookup, format filtering, name-oriented
extensions, and recent-update ordering. Member IDs are not indexed yet because
the initial inventory size makes resolving the full saved-team collection
cheap. An index can be added when “teams using this Pokémon” becomes a measured
query requirement.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/teams/schemas.ts` | Versioned persisted contract and ordered-reference helper |
| `src/domain/teams/validation.ts` | Inventory/catalog resolution and species clause |
| `src/domain/teams/factory.ts` | Legal creation and update behavior |
| `src/domain/teams/repository.ts` | Storage contract and stable errors |
| `src/infrastructure/database/TeamLabDatabase.ts` | Additive database version two |
| `src/infrastructure/teams/DexieSavedTeamRepository.ts` | Validated Dexie CRUD |
| `src/infrastructure/teams/index.ts` | Application repository composition |
| `src/domain/teams/factory.test.ts` | Factory, ordering, missing member, and species tests |
| `src/infrastructure/teams/DexieSavedTeamRepository.test.ts` | Real IndexedDB repository tests |
| `src/infrastructure/database/TeamLabDatabase.test.ts` | Version-one inventory upgrade characterization |

## Validation

Observed on 2026-07-25:

```text
npm test          10 files, 31 tests passed
npm run typecheck passed
npm run lint      passed
```

Coverage proves:

- ordered legal creation;
- whitespace normalization;
- missing-reference rejection;
- species clause across different owned records;
- identity/timestamp preservation on update;
- stale analysis marker removal;
- complete repository CRUD and count behavior;
- duplicate and missing-target errors;
- invalid stored-record reporting without deletion.
- version-one inventory survival during the version-two upgrade.

## Known limitations

- Only Great League is accepted.
- Format eligibility currently relies on already-validated inventory builds.
- Species clause uses Pokédex identity; a future cup with a materially
  different rule needs a format-specific legality policy.
- There is no cascade delete from inventory to teams.
- There is no import/export or repository restore operation for teams yet.
- No analysis results are persisted; only the optional source-version marker
  is reserved.
- Cross-tab live synchronization is not implemented.
