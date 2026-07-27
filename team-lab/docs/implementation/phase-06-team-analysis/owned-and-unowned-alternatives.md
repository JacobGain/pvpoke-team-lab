# Owned and Unowned Threat Alternatives

> **Phase:** Phase 6 — Team Analysis  
> **Status:** Complete for the published-counter slice  
> **Route:** `/teams/:teamId/simulate`  
> **Last reviewed:** 2026-07-25

## Summary

The saved-team analysis now turns each highest-priority threat into two
deliberately separate candidate lists:

- exact Pokémon records already in the user’s inventory;
- theoretical, unowned Pokémon using PvPoke’s published Great League defaults.

The candidates come from PvPoke’s overall-ranking `counters` evidence. TeamLab
does not infer them from typing and does not claim that adding one will improve
the complete team.

## Data flow

```text
PvPoke overall ranking counters
        ↓
validated upstream ranking
        ↓
normalized immutable CatalogRankedOpponent[]
        ↓
major threats from the exact saved-team matrix
        +
current inventory and saved-team species
        ↓
deriveTeamAlternatives
        ↓
owned exact records | unowned PvPoke defaults
```

## Published rating semantics

Each counter entry is stored by PvPoke on the threatened Pokémon’s ranking
record. Its rating is therefore the matchup result from the threat’s side.
Lower values identify stronger counters.

TeamLab preserves that source rating as `counterRating` and displays
`1000 - counterRating` as `alternativeRating`, the same matchup viewed from
the candidate’s side. This transformation changes the perspective, not the
underlying evidence.

The counter order is retained from upstream. TeamLab does not currently apply
its own type, role, cost, or team-composition weighting.

## Owned alternatives

An owned candidate:

- must match the catalog counter’s exact `speciesId`;
- uses the planned target species for a planned inventory record;
- preserves the inventory record ID and links to its build analysis;
- exposes whether the record is current or planned;
- uses its current or target CP when available;
- is labeled `owned-exact-build`.

If multiple inventory records have the same exact species, a current record is
preferred over a planned record and a favorite is preferred within the same
status. Only one record per species is shown for a threat.

“Exact build” means that the inventory identity, IVs, level, and moves remain
available through the linked record. It does **not** mean that this candidate’s
exact build was simulated against the threat in this slice. The candidate is
selected from static PvPoke counter evidence.

## Unowned alternatives

An unowned candidate:

- has no exact-species match in inventory;
- is released and has a usable fast and charged movepool;
- has published default Great League IVs;
- has an overall ranking and recommended moves;
- is labeled `unowned-pvpoke-default`.

The UI displays the published default level and IV spread, recommended move
IDs, and alternative-side rating. It does not synthesize an owned record or
persist anything.

## Species clause

Candidates whose Pokédex number matches any member of the current team are
excluded. The check uses Pokédex number rather than `speciesId`, so another
form of a species cannot be recommended beside the form already on the team.

This is a team-composition rule. Inventory ownership remains exact by
`speciesId`, preventing a normal, Shadow, or alternate-form record from being
presented as the exact build of a different catalog entry.

## Scope and ordering

The initial presentation considers:

- the first five major threats from the derived analysis;
- up to three owned alternatives per threat;
- up to three unowned alternatives per threat.

Threat priority remains the Phase 6 ordering based on the measured saved-team
matrix. Candidate priority remains PvPoke’s published counter order.

## File ownership

| File | Responsibility |
| --- | --- |
| `src/domain/pokemon/catalog.ts` | Normalized ranked-opponent contract |
| `src/pvpoke/adapters/buildPokemonCatalog.ts` | Converts upstream matchups and counters into immutable catalog evidence |
| `src/domain/teamAnalysis/alternatives.ts` | Ownership matching, species-clause filtering, source separation, and limits |
| `src/domain/teamAnalysis/alternatives.test.ts` | Characterizes ownership preference, defaults, ratings, and species clause |
| `src/features/simulation/SavedTeamSimulationPage.tsx` | Renders threat-grouped owned and unowned candidates |
| `src/styles/global.css` | Responsive alternative-card presentation |

## Validation

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

The domain characterization verifies:

- a current exact record is preferred over a planned duplicate;
- the owned record retains its CP and inventory identity;
- an absent species becomes an unowned default candidate;
- the displayed inverse rating is derived correctly;
- a candidate sharing a team member’s Pokédex number is excluded.

## Known limitations

- Candidates are not substituted into the saved team and resimulated.
- An owned candidate’s exact IVs and moves do not affect its candidate order.
- Static ranking counters represent PvPoke’s published default assumptions,
  not necessarily the selected shield scenario or the owned build.
- Alternatives are not yet scored for role balance, team coverage, upgrade
  cost, or improvement over the current member.
- The lists are recalculated in memory and are not persisted.
- No direct upstream battle or team-builder link is exposed yet.

The next recommendation layer should simulate exact owned substitutions before
claiming a scorecard improvement.
