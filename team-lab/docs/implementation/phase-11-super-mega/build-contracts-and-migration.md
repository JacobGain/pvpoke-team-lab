# Build contracts and migration

## Summary and problem

Two ordinary charged slots cannot represent an extra Mega attack. Treating an
extra attack as an ordinary attack also permits illegal pools and loses slot
identity when the second ordinary slot is empty.

## Implemented behavior and interfaces

Inventory movesets retain `chargedMoveIds` (one or two ordinary IDs) and add
optional `extraChargedMoveId`. Current/planned builds independently carry
`megaLevel` (1–4). Exact simulation builds carry the same settings at their
top level. Extra moves are normalized independently in the catalog.

`domain/pokemon/mega.ts` owns tag-based capabilities and legal extra pools.
Mega level 4 permits effective levels through 52; ordinary inference retains
its prior Best Buddy allowance through 51. No level-53 Super Mega assumption
is made. The CP multiplier table matches the bundled engine through 55;
having a multiplier does not make a level legal for a build.

Base-form inventory with `megaSpeciesId` stores owned base CP. Its selected
Mega projection uses the same IVs and, at Mega level 4, two additional effective
levels capped at 52. Normal-league projections omit the selected Mega's bonus
and extra attack without mutating the owned record. Direct Mega records use
effective CP/level without applying the two-level conversion again.

## File ownership and data flow

- `src/pvpoke/types/schemas.ts` and `adapters/buildPokemonCatalog.ts`: validate
  raw extra IDs and move markers and normalize their separate pools.
- `src/domain/inventory/schemas.ts`: version-specific normalization and current
  validation. `validation.ts` checks ordinary and extra pools against context.
- `src/domain/inventory/legacyMegaLevels.ts`: frozen defaults from the exact
  1.3.2 pin, verified against its Game Master by a regression test. This is
  migration evidence rather than a live eligibility rule.
- `src/domain/schemaVersions.ts`: inventory 2, saved teams 2, backup 4, database 5. Team v2 adds an exact-build
  analysis fingerprint while preserving all existing references.
- `src/infrastructure/database/TeamLabDatabase.ts`: preserve historical v1/v4
  declarations, migrate inventory and team rows inside the v5 upgrade transaction.
- `src/domain/backup/teamLabBackup.ts`: retain explicit envelope readers 1–3,
  introduce 4, normalize inventory before catalog/team validation and restore.
- `src/domain/analysis/` and `simulation/buildSerialization.ts`: propagate
  independent current/planned settings into exact builds and level calculations.
- `src/domain/recommendations/history.ts`: preserve new exact fields in archived
  snapshots; old snapshots remain historical and receive no invented attack.

The saved-team fingerprint includes ordered members, both build contexts, Mega
form/level, IVs, CP, and all attack slots. It excludes notes/favorites and is
canonical regardless of object key order. Legacy analyzed teams remain valid
references but need reanalysis; timestamps preserved during an import cannot
conceal changed Mega settings.

## Important decisions and rejected alternatives

Migration preserves CP, IVs, IDs, references, timestamps, and entered attacks.
Applicable legacy builds gain their frozen former engine-default Mega level.
Migration never adds a published extra attack, selects an ambiguous exact level,
or rewrites owned CP. Unknown schema versions and legacy records mislabeled
with new fields are rejected rather than silently downgraded.

## Error handling

The Dexie transaction aborts if a stored record cannot be normalized. Backup
inspection validates the complete input before repository writes. Existing
atomic merge/replace restore behavior remains the boundary for all collections.
Illegal ordinary/extra pools and inapplicable Mega levels produce field/build
errors rather than allowing upstream's custom-move insertion behavior.

## Performance and validation

IV-ranking caches include effective level caps. Extra metadata is small relative
to the existing catalog and stored builds. Focused tests live in
`src/domain/inventory/superMega.test.ts` and the existing database/backup suites.
They verify independent current/planned settings, full meta defaults, pool
legality, old envelopes, idempotent normalization, future-version rejection,
upgrades from versions 1–4, and transaction rollback.

## Known limitations and follow-up

Browser validation covers seeded 1.3.2 upgrade, independent current/planned
settings, reload, and full backup restore including history. Fingerprint tests
cover changed settings with preserved timestamps. The same-origin recovery
rehearsal confirmed that old code rejects schema-v2 rows without changing them;
returning to 1.4.0 recovers access with all settings intact. See the release
evidence record. An artifact rollback cannot undo database v5. Never recover by
clearing local data without an exported, verified backup.

## Relevant commits

Feature branch: `1.4.0/super-mega`; use its release PR and Git history for identity.
