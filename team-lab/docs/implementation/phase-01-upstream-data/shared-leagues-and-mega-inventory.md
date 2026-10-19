# Shared Leagues and Mega Inventory

## Summary

TeamLab supports six formats: Great (1500 CP), Ultra (2500 CP), Master
(uncapped in the UI), and a Mega variant of each. Inventory is shared rather
than duplicated into six independent collections.

## Problem being solved

A Great League-only catalog and separate league-owned records would make the
same physical Pokémon difficult to reuse across formats or Mega states.

## Implemented behavior

`domain/leagues.ts` owns format IDs, CP caps, ranking cups, meta-group IDs, and
bulk goals. Master uses PvPoke’s internal 10000 CP sentinel; the interface calls
it uncapped. `leagueStore.ts` persists selection in `team-lab-league`.
Switching the Mega toggle preserves the selected base league.

Each format loads its own overall rankings and group from the allowlist while
sharing the Game Master. A species can be present without published ranking
or default-build evidence; those are distinct from release and eligibility.
The full Game Master may define cups not exposed by TeamLab.

Inventory records retain stable IDs and optionally choose a `megaSpeciesId`.
Projection uses exact entered IVs and inferred level to derive Mega CP, checks
release and move compatibility, and uses the Mega form when legal. It never
rewrites the owned identity or invents a second specimen. Planned records
continue to use their explicit target. Preferred inventory placement considers
CP and Mega projection; all-owned views and team references provide broader
access. Saved teams have an exact format ID and three distinct Pokédex species.

## Architecture and data flow

Format selection → format-specific ranking/group queries → normalized catalog
→ inventory projection → analysis, recommendations, team resolution, or duel.

## File ownership

| File under `team-lab/` | Responsibility |
| --- | --- |
| `src/domain/leagues.ts` | Six typed configurations |
| `src/pvpoke/assetPaths.ts` | Explicit data and engine allowlist |
| `src/features/leagues/leagueStore.ts` | Persisted format/Mega selection |
| `src/features/meta/usePokemonCatalog.ts` | Catalog for active/override league |
| `src/domain/inventory/leagueEligibility.ts` | Shared inventory and Mega projection |
| `src/domain/teams/validation.ts` | Member legality and species clause |
| `scripts/sync-pvpoke-assets.ts` | Six-format bundle generation |

## Public interfaces and schemas

`LeagueId`, `baseLeagueId`, `leagueIdFor`, `projectInventoryForCatalog`, and
`isPreferredInLeague` are the shared boundary. Stored `formatId` identifies
context; it is not a separate inventory database. Legacy inventory records with
no format ID use the existing Great League fallback.

## Important decisions

One record represents one owned specimen. Simulation inputs use the effective
form/CP while inventory retains original data. New formats require explicit
configuration, asset paths, validation, and UI coverage; upstream cup additions
alone do not enable them.

## Rejected or deferred alternatives

Separate per-league inventories and automatically enabled limited cups were
not adopted. Multiple independently persisted league plans for one specimen
remain outside the current model.

## Error handling

Unavailable forms, incompatible moves, missing identities, illegal CP, and
species-clause conflicts remain visible validation failures. Projection failure
does not authorize a silent edit to the saved record.

## Performance considerations

The Game Master is shared through query caching. Rankings/groups are selected
by format instead of loading every upstream cup.

## Validation

`ultraLeague.test.ts`, `masterLeague.test.ts`, `megaInventory.test.ts`, and the
complete browser suite exercise cross-format catalog, projection, simulation,
persistence, and switching. Run `npm run validate:data` for all six bundles.

## Known limitations

Only the six explicit open/Mega configurations are supported. Mega projection
requires usable exact level evidence; it is not a resource or Mega-energy
planner.

## Safe extension points

Add formats through configuration and the owned asset allowlist, then update
query, domain, and browser coverage together.

## Follow-up work

Any future limited-cup support or multiple plans per specimen needs a deliberate
product/model extension.

## Relevant commits

The current behavior is maintained in the files above; the 1.3.0 upstream
refresh is recorded in `a1d5a3831` and its release documentation.
