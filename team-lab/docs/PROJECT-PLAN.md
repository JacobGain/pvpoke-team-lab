# TeamLab Project Plan

> **Status:** Authoritative product and technical plan  
> **Application name:** TeamLab  
> **Descriptor:** TeamLab — a PvPoke fork  
> **Repository:** `pvpoke-team-lab`  
> **Initial release target:** Local-first Great League MVP  
> **Last established:** July 2026

## 1. Purpose of this document

This document is the source of truth for TeamLab’s product direction, MVP scope, domain language, architecture, data ownership, implementation sequence, and acceptance criteria.

It should answer:

- what TeamLab is;
- whom it serves;
- which problems it solves;
- what belongs in the MVP;
- what is deliberately deferred;
- how TeamLab relates to upstream PvPoke;
- how inventory, builds, teams, rankings, and simulations are modeled;
- which technologies and boundaries the implementation should use;
- how future upstream and deployment changes should be handled.

When implementation details conflict with this document, either the implementation should be corrected or this document should be deliberately updated with the new decision and its rationale.

The more detailed repository-boundary explanation remains in `Fork-Structure-Breakdown.md`. `FULL-SUMMARY.md` at the repository root documents the inherited PvPoke codebase.

Actual implementation progress is maintained separately in
`implementation/README.md` and its phase records. This plan defines intended
scope; implementation records define current reality.

## 2. Product statement

TeamLab is a Pokémon GO PvP inventory, build-analysis, and team-planning application.

It begins with the Pokémon a player actually owns. It helps the player understand those builds, organize a competitive roster, construct and save teams, and evaluate those teams against the current PvPoke meta.

The central question is:

> Given the Pokémon I own, their actual IVs and moves, which builds and teams should I play, and how will they perform against the current meta?

The initial product is inventory-first. Automated team recommendations are important, but they are built on top of reliable inventory, IV, moveset, ranking, and team-analysis foundations.

## 3. Product principles

### 3.1 Inventory before theory

PvPoke primarily answers theoretical questions about species and idealized builds. TeamLab adds ownership context:

- which specimen the player owns;
- its CP and IVs;
- its actual moves;
- whether it is ready now or planned;
- which saved teams use it;
- how that exact build performs.

The application must distinguish theoretical species strength from the strength of a specific owned build.

### 3.2 Competitive depth without hostile complexity

The priority user is competitive, but the interface should remain understandable to a motivated casual player.

Advanced information should be available without requiring every user to understand it before completing basic tasks.

Examples:

- Show IV rank prominently; expose detailed breakpoint analysis progressively.
- Show a team scorecard first; allow detailed matchup inspection afterward.
- Explain assumptions rather than silently applying them.

### 3.3 Exact inputs produce transparent results

Simulation and recommendation output must state:

- which build was evaluated;
- which IVs and moves were used;
- whether any values were assumed;
- which league, cup, meta, and data version were used;
- which shield and energy scenarios were used;
- whether the result came from published rankings or fresh simulations.

### 3.4 Upstream is a dependency, not the application architecture

TeamLab reuses PvPoke’s data and calculation engine while owning its own:

- product model;
- user interface;
- storage;
- recommendation policy;
- validation;
- application state;
- testing;
- deployment path.

TeamLab should not inherit upstream’s global UI architecture merely because it reuses upstream calculations.

### 3.5 Local-first, deployment-ready

The MVP operates entirely locally and requires no account.

Persistence is hidden behind repository interfaces so a later deployed version can replace local IndexedDB with Firebase Authentication and Firestore without rewriting features or domain logic.

### 3.6 Additive fork development

New work belongs under `team-lab/`. The inherited `src/` tree should remain as close to upstream as possible to minimize future merge conflicts.

## 4. Target users

### 4.1 Primary user

A competitive Pokémon GO PvP player who:

- maintains a meaningful Great League roster;
- cares about IVs, movesets, roles, and meta performance;
- is willing to enter or import owned Pokémon;
- already understands basic team building;
- wants one place to manage builds and compare teams;
- wants exact analysis rather than generic species recommendations.

The primary user may have more than 100 Great League Pokémon.

### 4.2 Secondary user

A motivated casual PvP player who:

- is willing to enter their collection;
- wants to understand which Pokémon are worth using;
- benefits from moveset guidance and clear explanations;
- may rely more heavily on future recommendation features.

### 4.3 Future users

Later versions may serve:

- Ultra League and Master League players;
- limited-cup and tournament players;
- collectors deciding what to build next;
- users importing inventories from third-party tools;
- users synchronizing inventories across devices.

These users should influence extensibility but must not expand the first MVP.

## 5. Initial product promise

The MVP promise is:

> Manually enter your Great League Pokémon, understand the quality and role of each build, create and save ordered teams, and evaluate those exact teams against the current PvPoke Open Great League meta.

The MVP includes:

- manual inventory entry;
- strict record validation;
- explicit IV assumptions;
- level inference;
- IV ranking and build analysis;
- current and planned build state;
- moveset analysis and suggestions;
- inventory dashboard;
- saved ordered teams with names and notes;
- at least one anchor Pokémon for team suggestions;
- configurable one-to-five recommendation results;
- PvPoke-derived role and meta rankings;
- team scorecards;
- threats and core breakers;
- owned and unowned alternatives;
- exact one-on-one and TeamRanker-based analysis;
- JSON inventory backup and restore;
- local IndexedDB persistence.

## 6. MVP boundaries

### 6.1 Included

- Open Great League at 1,500 CP.
- Normal and Shadow Pokémon.
- Current and planned build states.
- Exact or explicitly assumed IVs.
- Current and desired movesets.
- One owned specimen per inventory record.
- PvPoke rankings, roles, groups, and simulation logic.
- Desktop-primary card-oriented UI.
- Responsive mobile presentation.
- Local Docker-based development.

### 6.2 Excluded

- Ultra League.
- Master League.
- Little Cup and limited cups.
- Full three-on-three AI battle prediction.
- Accounts and cloud synchronization.
- Firebase integration.
- Live tracking of Stardust, Candy, XL Candy, Rare Candy, TMs, or items.
- Automated third-party imports.
- OCR or screenshot ingestion.
- Multiple league builds attached to one specimen.
- Purified as a first-class inventory state.
- Custom user tags.
- Offline/PWA guarantees.
- Full mobile-first interaction optimization.
- A complete “what should I catch/build next?” optimizer.
- Exhaustive simulation of every team combination.

Deferred work should not be implemented opportunistically unless the MVP plan is explicitly revised.

## 7. Supported format

The first supported format is:

```text
League: Great League
Cup: Open Great League
CP cap: 1,500
Level cap: inherited from current PvPoke data/settings
Meta source: current PvPoke Great League meta group and rankings
```

The domain model must still carry format identity:

```text
FormatId
LeagueId
CupId
CpCap
LevelCap
DataVersion
```

Great League must not be scattered as hard-coded assumptions across every feature. Adding a future league should require new configuration and feature enablement, not a domain rewrite.

## 8. Domain language

### 8.1 Species

An entry from the upstream Game Master describing a Pokémon or form:

- species ID;
- form;
- base stats;
- types;
- movepool;
- tags;
- family/evolutions;
- release and league metadata.

A species is not an owned Pokémon.

### 8.2 Inventory Pokémon

A unique owned specimen recorded by the user.

Multiple inventory Pokémon may reference the same species or form.

Identity uses an application-generated `inventoryId`, never `speciesId`.

### 8.3 Current build

The Pokémon’s present competitive state:

- CP;
- inferred level;
- IVs or explicit IV assumption;
- current fast move;
- current charged moves;
- normal or Shadow state.

### 8.4 Planned build

A desired future evolution and/or moveset for an owned Pokémon.

Planned build is a state of the inventory record. It is not a separate duplicate specimen and not a second league build.

A planned record can describe:

- current species and desired evolution;
- desired form, where supported;
- desired final CP/build;
- desired moves;
- expected Great League analysis.

### 8.5 Ready now

A build that can be evaluated using its current species/form, CP, IVs, and current moves without relying on planned evolution or desired moves.

Ready-now Pokémon are favored on the team-building page.

### 8.6 Build requirements

The changes required to reach a target or recommended build.

For the early MVP, these are primarily qualitative:

- evolve;
- change fast move;
- change charged move;
- unlock a second charged move;
- Elite TM required;
- remove Frustration;
- power up to a target CP/level.

TeamLab does not track the player’s current resource balances.

Exact Stardust/Candy totals may be added later without turning resources into a continuously maintained inventory.

### 8.7 Saved team

An ordered set of three inventory Pokémon:

1. Lead
2. Safe switch
3. Closer

The order is meaningful and persisted.

Species clause applies: a team cannot contain multiple members of the same species even when the player owns multiple specimens.

### 8.8 Meta

The weighted set of opponent species/builds used for team evaluation.

The MVP meta comes from current upstream PvPoke Open Great League data.

### 8.9 Recommendation

An ordered team proposal built around at least one user-selected anchor Pokémon.

It includes evidence, assumptions, threats, alternatives, and required build changes.

## 9. Inventory model

The conceptual inventory record is:

```text
InventoryPokemon
├── schemaVersion
├── inventoryId
├── speciesId                  # exact catalog variant; includes form/Shadow
├── buildStatus                # current | planned
├── currentBuild
│   ├── cp
│   ├── inferredLevel
│   ├── ivs
│   │   ├── attack
│   │   ├── defense
│   │   └── hp
│   ├── ivSource               # user-entered | assumed-rank-1
│   └── moveset
│       ├── fastMoveId
│       └── chargedMoveIds
├── plannedBuild?              
│   ├── targetSpeciesId
│   ├── targetCp?
│   └── desiredMoveset
│       ├── fastMoveId
│       └── chargedMoveIds
├── favorite?
├── notes?
├── createdAt
├── updatedAt
└── sourceDataVersion
```

Fields will be finalized in the data-model documentation and runtime schema.

Implementation refinement: PvPoke's catalog already assigns a distinct
`speciesId` to each form and Shadow variant. TeamLab therefore persists that
exact catalog identity instead of also storing `formId` and `shadowState`.
Form and Shadow presentation are derived from the current catalog, preventing
contradictory combinations in persisted data. See
`implementation/phase-02-inventory/inventory-domain-model.md`.

### 9.1 Required input

A record cannot be saved until it has:

- species;
- form;
- CP;
- normal or Shadow state;
- valid moveset for its context;
- valid IV values or accepted rank-one assumption.

### 9.2 Moveset semantics

The meaning of moves depends on build status:

#### Current record

The required moveset is what the Pokémon currently knows.

This allows TeamLab to compare:

```text
Current moveset → PvPoke recommended moveset
```

and explain required changes.

#### Planned record

The desired moveset describes what the player intends the final build to know.

If current moves are useful for planning, they may remain in `currentBuild`; the planned target is stored separately.

### 9.3 IV assumptions

If the user does not enter IVs:

- TeamLab uses the upstream/PvPoke rank-one Great League spread;
- the record is complete and may be saved;
- `ivSource` is `assumed-rank-1`;
- every analysis and simulation visibly identifies the assumption;
- the user is prompted to replace it with actual IVs.

An assumed build may be used in saved teams and simulations. It must never be displayed as measured fact.

### 9.4 Level inference

Given species/form, CP, and IVs, TeamLab will use upstream-compatible CP multiplier logic to infer possible level.

Validation must handle:

- no matching level;
- more than one theoretical match;
- CP rounding;
- level caps;
- Best Buddy levels, if upstream data permits;
- forms with special level floors/caps.

If the combination cannot describe a legal build, the record cannot be saved.

### 9.5 Evolution

Evolution is represented through the planned build:

```text
current species → targetSpeciesId
```

The sprite and species presentation change when the plan is viewed as its target build.

The original owned identity remains the same `inventoryId`.

Evolution must be validated against upstream family/evolution data.

### 9.6 Purified Pokémon

Purified is not a first-class MVP state.

Return may be represented as an entered current or desired charged move when upstream movepool rules allow it.

IV rankings use the general applicable IV search space rather than a purification-specific floor. TeamLab will not label a spread “rank one purified” separately from its general Great League rank.

Actual entered IVs remain exact. A Pokémon with 2/2/2 or higher IVs can therefore be analyzed correctly even though the rank denominator includes lower theoretical spreads.

Species-specific acquisition floors should only be applied when supported by authoritative upstream logic/data. TeamLab should not invent special floors inconsistently.

### 9.7 Mythical and acquisition floors

Some Pokémon cannot normally be obtained with a 0 IV floor. PvPoke already contains selected floor and default-IV behavior.

The MVP rule is:

- use upstream legality/default logic where available;
- report general Great League rank consistently;
- do not build a separate acquisition-source ranking engine;
- document any species-specific exception exposed to the user.

## 10. Manual-entry workflow

### 10.1 Basic flow

1. Open Add Pokémon.
2. Search/select species and form.
3. Select normal or Shadow.
4. Enter CP.
5. Enter IVs or accept the rank-one assumption.
6. Select current moves or planned target moves.
7. Choose current or planned status.
8. For planned status, optionally select desired evolution.
9. Review inferred level and validation.
10. Save.

### 10.2 High-volume entry

The UI must make entry of 100+ records practical:

- keyboard navigation;
- type-ahead species search;
- responsive move selectors;
- “Save and add another”;
- duplicate an existing inventory record;
- preserve useful field defaults;
- immediate CP/IV validation;
- no full-page navigation between entries;
- compact completion confirmation;
- clear progress/record count.

### 10.3 Validation failures

Validation should explain the problem:

- CP cannot be produced by this species and IV spread;
- move is not in the relevant movepool;
- duplicate charged moves;
- species/form/evolution combination is invalid;
- Shadow state is unavailable;
- planned evolution exceeds Great League cap;
- required field is missing.

## 11. IV and build analysis

Each inventory record should expose:

- exact IV spread or assumed status;
- inferred level;
- Great League CP;
- attack, defense, and HP;
- stat product;
- overall stat-product rank;
- percentile;
- comparison to rank one;
- PvPoke meta rank;
- role ranks;
- recommended moves;
- current versus recommended move differences;
- XL/Best Buddy indicator where applicable;
- matchup-sensitive breakpoint and bulkpoint information.

### 11.1 Ranking interpretation

TeamLab must avoid claiming that highest stat product is always the best competitive spread.

Build analysis should distinguish:

- maximum-stat-product rank;
- attack-weighted behavior;
- CMP implications;
- meaningful fast-move breakpoints;
- meaningful defensive bulkpoints;
- performance against the selected meta.

### 11.2 Breakpoint scope

Breakpoint and bulkpoint calculations should be evaluated against a defined meta/build set, not presented as universal truths.

Every result needs:

- opponent;
- opponent assumed build/moves;
- relevant damage change;
- matchup impact where known;
- data version.

The first implementation can start with stat/rank analysis and add richer meta breakpoint summaries incrementally.

## 12. Inventory dashboard

The inventory is a card-oriented dashboard optimized for desktop.

### 12.1 Card content

A Pokémon card should be able to show:

- sprite;
- species/form;
- normal or Shadow;
- current/planned status;
- CP and inferred level;
- IV spread;
- rank and percentile;
- current or desired moves;
- overall PvPoke rank;
- strongest role;
- readiness/build-requirement indicator;
- favorite;
- number of saved teams using it.

### 12.2 Views

At minimum:

- all inventory;
- ready now;
- planned builds;
- assumed IVs;
- favorites.

Ready-now and planned builds should be available as separate views or filters. Neither is globally hidden.

### 12.3 Filters and sorting

Useful MVP filters:

- species/name;
- type;
- normal/Shadow;
- current/planned;
- assumed/entered IVs;
- move;
- role;
- PvPoke rank;
- IV rank;
- ready now;
- favorite.

Useful sorts:

- species;
- CP;
- IV rank;
- stat product;
- overall meta rank;
- role rank;
- recently updated.

### 12.4 Planned versus owned prioritization

On the inventory dashboard, current and planned builds are peer views controlled by filters.

On the team-building/recommendation page:

- ready-now/current builds are prioritized by default;
- planned builds remain available;
- the user can filter to ready-now only, planned only, or both;
- every planned recommendation clearly shows required changes.

## 13. Saved teams

The conceptual saved-team model is:

```text
SavedTeam
├── schemaVersion
├── teamId
├── name
├── formatId
├── members
│   ├── leadInventoryId
│   ├── switchInventoryId
│   └── closerInventoryId
├── notes
├── lastAnalyzedDataVersion?
├── createdAt
└── updatedAt
```

### 13.1 Rules

- Exactly three members for an active Great League team.
- All members must resolve to valid inventory records.
- All members must be legal for the selected format.
- Species clause prohibits duplicate species.
- Order is persisted.
- A user may name the team.
- A user may add free-form notes.

### 13.2 Analysis freshness

Analysis is always recalculated from current upstream data.

TeamLab may display:

```text
Last analyzed with data version X
Current data version Y
```

but should not treat an old scorecard as current truth.

Analysis caching is permitted when its complete versioned key matches.

### 13.3 Inventory changes

If an inventory member changes:

- the saved team continues to reference the inventory ID;
- TeamLab marks previous analysis stale;
- the next view recalculates;
- deleted inventory members produce a repairable missing-member state rather than corrupting the team.

## 14. Team Builder workflow

### 14.1 Manual team building

1. Select or create a saved team.
2. Choose an inventory Pokémon for Lead.
3. Choose Safe Switch.
4. Choose Closer.
5. Enforce species clause and format legality.
6. Analyze exact builds against the PvPoke meta.
7. Present scorecard, coverage, threats, and alternatives.
8. Save name, order, and notes.

### 14.2 Anchor-based recommendations

The MVP recommender requires at least one anchor Pokémon.

The user may:

- lock a lead;
- lock a switch;
- lock a closer;
- select an anchor without fixing its role;
- optionally lock two members and request the third.

Requiring an anchor:

- prevents every user from seeing the same generic top teams;
- gives the recommendation a clear constraint;
- reduces the candidate search space;
- matches how competitive players often build around a core or favorite.

### 14.3 Recommendation count

The user can request between one and five recommendations.

Default recommendation count should be chosen during UI implementation, likely three.

### 14.4 Recommendation diversity

Returned teams should be materially different.

Potential diversity rules:

- do not return the same three species in another order;
- limit repeated two-Pokémon cores;
- prefer distinct threat/coverage profiles;
- expose why each result was selected;
- allow the user to relax diversity if desired later.

## 15. Recommendation result

A result contains:

```text
TeamRecommendation
├── recommendationId
├── orderedMembers
│   ├── lead
│   ├── switch
│   └── closer
├── anchorInventoryIds
├── recommendedMoves
├── buildRequirements
├── scorecard
│   ├── coverage
│   ├── bulk
│   ├── safety
│   └── consistency
├── roleEvidence
├── coreBreakers
├── majorThreats
├── ownedAlternatives
├── unownedAlternatives
├── assumptions
├── metaVersion
├── dataVersion
└── generatedAt
```

### 15.1 Ordered play

The recommendation explicitly assigns:

- Lead;
- Safe Switch;
- Closer.

The assignment should use PvPoke role data and team interaction, not only overall ranking.

### 15.2 Owned alternatives

Owned alternatives:

- come from inventory;
- respect species clause;
- are legal in the format;
- state whether they are ready now or planned;
- are evaluated as exact owned builds.

### 15.3 Unowned alternatives

Unowned alternatives:

- come from PvPoke rankings/meta;
- are theoretical species/build suggestions;
- are labeled as not in inventory;
- do not imply a complete investment plan;
- can later feed a “build next” feature.

### 15.4 Build requirements

Each recommended member may show:

- no changes required;
- desired evolution;
- move changes;
- second charged move;
- Elite move;
- Frustration removal;
- target power-up.

Resource balances are not tracked.

## 16. Recommendation strategy

The MVP must not simulate every possible team exhaustively.

For 100 inventory records:

```text
C(100, 3) = 161,700 unordered teams
```

Role ordering and meta matchups multiply the work substantially.

### 16.1 Candidate pipeline

1. Load current format, rankings, role categories, and meta group.
2. Resolve the required anchor build.
3. Filter eligible inventory records.
4. Favor ready-now records by default.
5. Apply species clause.
6. Apply ranking/role thresholds.
7. Build candidate partners with complementary roles and coverage.
8. Generate plausible teams.
9. Pre-score teams from static ranking/matchup data.
10. Remove redundant teams.
11. Run detailed TeamRanker/exact simulations for finalists.
12. Produce one-to-five diverse recommendations.
13. Generate explanations and alternatives.

### 16.2 Static versus fresh calculation

Static PvPoke data is used for:

- candidate discovery;
- role suitability;
- meta membership and weighting;
- moveset defaults;
- initial matchup evidence;
- inexpensive pre-scoring.

Fresh calculation is used for:

- exact owned IVs;
- exact current/desired moves;
- finalist matchup evaluation;
- team scorecards;
- detailed battle inspection.

### 16.3 Recommendation objectives

The first default objective should balance PvPoke’s existing dimensions:

- coverage;
- bulk;
- safety;
- consistency;
- role suitability;
- meta performance.

Future selectable objectives may include:

- strongest overall;
- safest;
- highest bulk;
- anti-meta;
- ready now;
- minimal build changes;
- Shadow-free;
- build around a specific core.

Objective expansion is deferred until the default pipeline is reliable.

## 17. Simulation scope

### 17.1 Reused upstream capabilities

TeamLab will wrap:

- exact `Pokemon` construction;
- CP/level/IV calculations;
- moves and Shadow state;
- one-on-one `Battle` simulation;
- shield and energy settings;
- `TeamRanker`;
- cup eligibility;
- published ranking and group loading;
- breakpoint/bulkpoint calculation where usable;
- upstream URL serialization where useful.

### 17.2 Not claimed

TeamLab will not claim to predict every full three-on-three battle.

The team scorecard represents PvPoke-derived matchup coverage and heuristics under stated conditions.

Full training AI battles exist upstream but are out of MVP recommendation scope.

### 17.3 Deep links

Where possible, TeamLab should provide:

- Open in PvPoke Battle;
- Open in PvPoke Team Builder;
- inspect a threat matchup;
- inspect an alternative matchup.

URL generation belongs behind upstream serializers.

## 18. Upstream data sources

TeamLab reads, but does not own:

```text
src/data/gamemaster.min.json
src/data/rankings/**
src/data/groups/**
src/data/overrides/**
```

Potential later sources include training analysis and team pools.

### 18.1 Repository boundary

Features must not build upstream paths directly.

They use interfaces such as:

```text
GameMasterRepository
FormatRepository
RankingRepository
MetaGroupRepository
```

Responsibilities include:

- loading;
- caching;
- runtime validation;
- adapting upstream schemas;
- reporting data version;
- resolving ranking aliases;
- handling missing artifacts;
- invalidating stale application caches.

### 18.2 Dataset synchronization

Future upstream updates should:

1. be merged into the upstream-owned tree;
2. accept upstream data changes with minimal fork edits;
3. validate schemas;
4. run adapter characterization tests;
5. compare known simulation outputs;
6. invalidate caches by Game Master/ranking version;
7. regenerate only fork-owned derived indexes;
8. document compatibility changes.

TeamLab must not annotate or intermingle user data with upstream JSON.

## 19. Application architecture

The dependency direction is:

```text
React features and pages
        ↓
Application/domain services
        ↓
Fork-owned interfaces
        ↓
Storage repositories       PvPoke adapters/repositories
        ↓                            ↓
IndexedDB                  Upstream src/js and src/data
```

### 19.1 Forbidden coupling

Avoid:

```text
React components → upstream global constructors
React components → direct JSON paths
Domain models → browser DOM
Domain models → React
Features → IndexedDB/Dexie directly
Features → localStorage directly
Upstream src/** → team-lab/**
Persistent records → live mutable upstream Pokemon objects
```

### 19.2 Upstream adapter

Only `team-lab/src/pvpoke/` knows:

- upstream globals;
- jQuery/script ordering;
- `GameMaster`, `Pokemon`, `Battle`, and `TeamRanker`;
- upstream data shapes;
- mutable engine state;
- URL formats;
- upstream file paths.

It exposes narrow, typed, immutable results to the rest of TeamLab.

### 19.3 Engine loading

The upstream engine is not an ES module.

The bootstrap layer will:

- provide expected globals;
- load core scripts in their required order;
- avoid upstream UI files where possible;
- expose readiness/failure state;
- validate required methods;
- isolate initialization from React.

### 19.4 Worker strategy

Bulk simulation and recommendation work should move to Web Workers when main-thread cost becomes visible.

Worker messages use serializable TeamLab types, not live upstream objects.

The first implementation may prove the adapter on the main thread, but the architecture must not make workers impossible.

## 20. Technology stack

### 20.1 Core frontend

```text
React
TypeScript
Vite
```

Reasons:

- strong TypeScript support;
- mature dashboard and workflow ecosystem;
- good Firebase integration;
- broad testing and worker support;
- clear component boundaries;
- large contributor and documentation base.

### 20.2 Routing

```text
React Router
```

Expected routes may include:

```text
/
/inventory
/inventory/new
/inventory/:inventoryId
/teams
/teams/new
/teams/:teamId
/recommend
/settings
/import-export
```

Exact paths remain an implementation detail.

### 20.3 Runtime schemas

```text
Zod
```

Runtime validation is required for:

- upstream JSON;
- persisted inventory;
- saved teams;
- imports;
- worker messages;
- future Firestore documents;
- schema migrations.

TypeScript alone does not validate external data.

### 20.4 Local persistence

```text
IndexedDB
Dexie.js
```

Reasons:

- lightweight on the local machine;
- browser-native;
- appropriate for 100+ records, teams, and caches;
- supports indexes and transactions;
- does not require a local database service;
- can be hidden behind repository interfaces;
- avoids coupling MVP development to Firebase.

There is no local API/database service in the MVP.

### 20.5 Remote/server state

```text
TanStack Query
```

Use for:

- Game Master loading;
- ranking/group loading;
- cache/refetch state;
- future authenticated remote data.

Do not force local domain state into it when a repository or component state is more appropriate.

### 20.6 Forms

```text
React Hook Form
Zod integration
```

Suitable for high-volume entry, validation, and guided workflows.

### 20.7 UI state

Prefer:

1. local React state;
2. URL state where shareable;
3. narrowly scoped context;
4. Zustand only for genuinely shared client state.

Avoid a large global store by default.

### 20.8 Future testing

Planned stack:

```text
Vitest
React Testing Library
Playwright
```

Testing infrastructure may be introduced incrementally, but upstream adapter characterization tests should precede risky synchronization or deployment.

## 21. Persistence architecture

Features use interfaces such as:

```ts
interface InventoryRepository {
  list(): Promise<InventoryPokemon[]>;
  get(id: string): Promise<InventoryPokemon | null>;
  save(record: InventoryPokemon): Promise<void>;
  delete(id: string): Promise<void>;
  import(records: InventoryPokemon[]): Promise<ImportResult>;
  export(): Promise<InventoryExport>;
}
```

MVP:

```text
DexieInventoryRepository
DexieTeamRepository
DexieSettingsRepository
```

Future:

```text
FirestoreInventoryRepository
FirestoreTeamRepository
FirestoreSettingsRepository
```

### 21.1 Schema versioning

Every persisted top-level record or export contains a schema version.

Migrations must be:

- explicit;
- forward-moving;
- tested before deployment;
- recoverable through export/backup;
- separate from upstream data-version changes.

### 21.2 Local storage size

Inventory and team records are small. Even hundreds or thousands of records should occupy little space compared with upstream images and ranking JSON.

Simulation caches need size and invalidation policies because they can grow much faster.

### 21.3 Import/export

JSON backup and restore are part of MVP.

Export contains:

- format/version metadata;
- inventory;
- saved teams;
- TeamLab settings as appropriate;
- export timestamp.

Import must:

- validate runtime schemas;
- report invalid records;
- handle duplicate IDs;
- offer replace or merge behavior;
- never partially corrupt existing data;
- preserve a recovery path.

### 21.4 Data deletion

Local settings should expose:

- clear inventory;
- clear saved teams;
- clear analysis cache;
- reset all TeamLab data.

Destructive operations require explicit confirmation.

## 22. Future Firebase deployment

Firebase is the preferred future direction, not an MVP dependency.

Potential services:

```text
Firebase Authentication
Cloud Firestore
Firebase Hosting
```

### 22.1 Firestore shape

Avoid one giant live inventory JSON document.

Preferred structure:

```text
users/{userId}
users/{userId}/inventory/{inventoryId}
users/{userId}/teams/{teamId}
users/{userId}/preferences/default
```

Benefits:

- individual updates;
- manageable document sizes;
- per-record timestamps;
- easier conflict handling;
- targeted security rules;
- independent schema evolution;
- straightforward synchronization.

JSON remains the backup/import format.

### 22.2 Seamless transition requirement

The transition is considered successful when:

- feature code still calls the same repository interfaces;
- local anonymous data can be migrated into a signed-in account;
- runtime schemas are shared;
- inventory IDs remain stable;
- saved team references remain valid;
- no component directly depends on Firestore APIs.

### 22.3 Privacy decisions deferred

Before deployment, define:

- authentication providers;
- Firestore rules;
- inventory data privacy;
- account deletion;
- data export;
- telemetry;
- crash-report redaction;
- retention;
- abuse protection.

## 23. User experience

### 23.1 Product shape

TeamLab combines:

- a dashboard for inventory and at-a-glance status;
- guided workflows for entry, team building, and recommendations.

### 23.2 Home screen

The dedicated home screen may show:

- total Great League inventory;
- ready-now versus planned counts;
- assumed-IV records needing attention;
- favorite/saved teams;
- recently updated builds;
- current PvPoke data version;
- shortcuts to Add Pokémon, Inventory, Build Team, and Recommend.

### 23.3 Visual direction

- card-oriented;
- spacious but information-rich;
- friendly and approachable;
- clearly more modern than inherited PvPoke;
- distinct TeamLab identity;
- accessible color and typography;
- progressive disclosure for competitive detail.

### 23.4 Reused visual language

TeamLab may reuse or reinterpret:

- Pokémon type colors;
- sprites;
- move/type icons;
- shield and energy language;
- matchup-rating colors;
- the battle timeline/progress concept.

It should not copy upstream page layouts.

### 23.5 Asset policy

Do not assume an online asset is freely reusable.

Prefer:

1. repository assets already available under the project’s established use;
2. original TeamLab design assets;
3. explicitly licensed external assets;
4. required attribution.

Trademark and upstream attribution remain visible.

### 23.6 Responsive scope

MVP is desktop-primary.

It must:

- remain usable at mobile widths;
- avoid broken layouts;
- preserve readable cards and forms;
- support basic navigation and record viewing.

It does not need fully optimized mobile bulk-entry or simulation workflows in MVP.

## 24. Branding

Working application name:

```text
TeamLab
```

Working descriptor:

```text
TeamLab — a PvPoke fork
```

The descriptor communicates technical ancestry and should not imply endorsement or official ownership.

Before public deployment:

- verify product-name conflicts;
- review domain availability;
- review trademark implications;
- decide permanent attribution language;
- create a distinct visual identity.

The repository name remains:

```text
pvpoke-team-lab
```

## 25. Performance

### 25.1 Inventory targets

Design for:

- 100+ Great League records;
- future 50+ Ultra League records;
- future 10+ Master League records.

### 25.2 UI targets

- Inventory filtering and sorting should feel immediate.
- Long analysis must show progress and remain cancellable.
- The browser main thread should remain responsive.
- Cards/lists may use virtualization if rendering becomes costly.

### 25.3 Recommendation targets

The pipeline must:

- shortlist before exact simulation;
- cache exact matchup results;
- avoid duplicate work;
- separate quick static evidence from detailed simulation;
- support cancellation;
- report progress.

### 25.4 Cache key

A matchup cache key includes:

```text
upstream Game Master/ranking version
+ format, cup, CP cap, and level cap
+ subject species/form/Shadow/level/IVs/moves
+ opponent species/form/Shadow/level/IVs/moves
+ shields, energy, HP, buffs, bait, timing, and decision settings
```

Species-only caching is invalid.

### 25.5 Invalidation

Invalidate when:

- upstream data version changes;
- relevant ranking/meta artifact changes;
- inventory build changes;
- simulation settings change;
- adapter/engine compatibility version changes.

## 26. Testing and correctness

Tests may be introduced incrementally during local MVP work, but the architecture must remain testable.

### 26.1 Highest-priority tests

The upstream compatibility boundary:

- Game Master schema;
- ranking schema;
- group schema;
- inventory-to-`Pokemon` conversion;
- CP and level inference;
- IV assumption;
- move selection;
- Shadow state;
- exact known matchups;
- TeamRanker result translation;
- cup eligibility;
- URL serialization.

### 26.2 Characterization set

Maintain a small fixed set covering:

- neutral damage;
- resisted and super-effective damage;
- dual typing;
- Shadow modifier;
- distinct IV spreads;
- CMP;
- shields and starting energy;
- bait/no-bait;
- buffs/debuffs;
- form mechanics;
- TeamRanker output;
- Great League eligibility.

### 26.3 Domain tests

- record completeness;
- current versus planned state;
- evolution validation;
- species clause;
- saved-team repair after deletion;
- recommendation anchor requirement;
- recommendation diversity;
- import merge/replace;
- schema migrations;
- cache-key completeness.

### 26.4 UI tests

Later:

- rapid manual entry;
- assumed-IV disclosure;
- inventory filters;
- create/edit saved team;
- stale analysis indication;
- recommendation generation;
- JSON backup/restore.

## 27. Error handling

TeamLab must provide user-facing states for:

- upstream Game Master unavailable;
- ranking/meta artifact unavailable;
- upstream schema changed;
- engine initialization failed;
- invalid inventory;
- impossible CP/IV combination;
- corrupted IndexedDB record;
- failed migration;
- failed JSON import;
- interrupted/cancelled simulation;
- stale cache;
- deleted team member.

Failures should not silently substitute generic values.

## 28. Data transparency

Every detailed result should make available:

- TeamLab version;
- upstream Game Master ID/timestamp;
- ranking/meta source;
- format and CP cap;
- exact subject build;
- exact or assumed IV status;
- current or desired moves;
- opponent assumptions;
- shield/energy configuration;
- static versus simulated evidence;
- generation time.

## 29. Security and privacy

### 29.1 Local MVP

- Inventory remains in the user’s browser.
- No account is required.
- No inventory telemetry is sent.
- JSON export is user-initiated.
- Clearing browser storage can remove data, so backup guidance is required.

### 29.2 Upstream safety

TeamLab should not use upstream unauthenticated ranking-write, compilation, or training-submission endpoints for application persistence.

### 29.3 Deployment

Firebase deployment requires a separate security review before launch.

## 30. Upstream merge policy

### 30.1 Ownership

Upstream-owned:

```text
src/**
docker/Dockerfile
docker/docker-compose.yml
README.md
LICENSE
```

Fork-owned:

```text
team-lab/**
Makefile
FULL-SUMMARY.md
```

### 30.2 Merge behavior

Do not move or broadly reformat upstream code.

If an upstream patch becomes unavoidable:

- keep it minimal;
- document it;
- record the baseline commit;
- add characterization coverage;
- avoid combining unrelated cleanup;
- periodically attempt to remove it.

### 30.3 Engine replacement

TeamLab may eventually move away from direct upstream JavaScript reuse, but that is not an MVP goal.

Any replacement should:

- preserve verified behavior;
- have explicit tests;
- be introduced behind the same TeamLab interfaces;
- avoid a simultaneous UI/domain rewrite.

## 31. Implementation phases

### Phase 0: foundation

- Initialize React, TypeScript, and Vite under `team-lab/`.
- Configure strict TypeScript.
- Add routing and top-level layout.
- Add Zod.
- Add Dexie.
- Establish design tokens and basic card system.
- Establish linting/formatting appropriate to the new application only.
- Preserve upstream paths untouched.

Exit criteria:

- TeamLab runs locally alongside upstream PvPoke.
- Home route renders.
- build/type checks pass.

### Phase 1: upstream data boundary

- Define external Game Master/ranking/group schemas.
- Implement repositories.
- Display upstream data version.
- Load Great League species and rankings.
- Handle validation failures.

Exit criteria:

- TeamLab can list validated Great League-eligible species.
- No feature constructs upstream file paths directly.

### Phase 2: inventory domain and persistence

- Finalize inventory schema.
- Implement Dexie repositories.
- Add schema version/migration foundation.
- Build manual-entry form.
- Implement IV assumption.
- Infer and validate level.
- Validate moves.
- Add current/planned state and desired evolution.
- Build inventory cards and filters.
- Add edit/delete.

Exit criteria:

- User can enter and maintain 100+ records.
- Invalid records cannot be saved.
- Reloading preserves inventory.
- Assumptions remain explicit.

### Phase 3: IV/build analysis

- Calculate stats and IV rank.
- Show percentile and rank-one comparison.
- Add upstream meta and role ranks.
- Compare current/desired moves to recommended moves.
- Add build requirements.
- Add initial breakpoint/CMP insights.

Exit criteria:

- Each record has an understandable competitive build profile.
- Current and planned analysis are distinguishable.

### Phase 4: saved teams

- Implement team repository.
- Build ordered team editor.
- Enforce species clause and legality.
- Support team names and notes.
- Reference inventory IDs.
- Handle missing/deleted members.

Exit criteria:

- User can create, edit, order, save, and reopen teams.

### Phase 5: PvPoke simulation adapter

- Bootstrap required upstream core scripts.
- Adapt inventory builds into temporary upstream Pokémon.
- Wrap exact one-on-one simulations.
- Wrap TeamRanker.
- Add result translation and assumptions.
- Add adapter characterization tests.

Exit criteria:

- Exact owned builds can be simulated without React accessing upstream globals.

### Phase 6: team analysis

- Analyze saved team against current meta.
- Display coverage, bulk, safety, consistency.
- Display threats and core breakers.
- Display owned and unowned alternatives.
- Add upstream deep links.
- Recalculate using current data.

Exit criteria:

- Saved team analysis provides the full MVP scorecard and threat view.

### Phase 7: anchor recommendations

- Require one or two anchors.
- Build candidate shortlist.
- Prioritize ready-now builds.
- Apply species clause.
- Generate ordered candidates.
- Pre-score and simulate finalists.
- Return configurable one-to-five results.
- Enforce diversity.
- Explain recommendations.

Exit criteria:

- User can select an anchor and receive useful, distinct inventory-constrained teams.

### Phase 8: backup and MVP hardening

- Implement JSON export/import.
- Add merge/replace handling.
- Add destructive reset controls.
- Add progress/cancellation.
- Move expensive work to workers as needed.
- Complete responsive pass.
- Add critical test coverage.
- Write local user documentation.

Exit criteria:

- MVP data can be backed up and restored.
- Core workflows are stable with 100+ records.
- No known upstream source edits are required.

### Post-MVP

- limited cups;
- Ultra League;
- Master League;
- third-party imports;
- richer breakpoint analysis;
- exact resource-cost calculation;
- missing-roster investment planner;
- accounts and Firestore;
- cloud synchronization;
- mobile workflow optimization;
- PWA/offline support;
- expanded recommendation objectives.

## 32. MVP acceptance criteria

The MVP is complete when all of the following are true.

### Inventory

- A user can manually add, edit, duplicate, and delete Great League records.
- Required fields and movepools are validated.
- Level is inferred from CP and IVs.
- Missing IVs use an explicit rank-one assumption.
- Current and planned builds are distinct.
- Planned builds can include desired evolution and moves.
- At least 100 records remain usable and responsive.

### Analysis

- Each record displays IV rank, percentile, stats, meta rank, role information, and moveset guidance.
- Assumptions are visible.
- Exact builds can be passed to the upstream simulation adapter.

### Teams

- A user can save named, ordered teams with notes.
- Teams reference inventory IDs.
- Species clause is enforced.
- Analysis always uses current upstream data.
- Scorecards, threats, core breakers, and alternatives are displayed.

### Recommendations

- At least one anchor is required.
- Ready-now builds are prioritized.
- User can request one-to-five teams.
- Teams include order and movesets.
- Results include scorecards, threats, owned alternatives, unowned alternatives, and build requirements.
- Results are materially distinct.

### Persistence

- Inventory and teams persist in IndexedDB.
- Data carries schema versions.
- JSON export and validated import work.
- User can clear data explicitly.

### Architecture

- TeamLab code lives under `team-lab/`.
- Upstream `src/` remains unmodified for TeamLab features.
- UI code does not access upstream globals directly.
- Upstream data passes runtime validation.
- Storage is accessed through repositories.

### Experience

- UI is modern, card-oriented, and desktop-primary.
- Core pages remain usable at mobile widths.
- Long work shows progress and can be cancelled where necessary.
- Data version and simulation assumptions can be inspected.

## 33. Non-functional goals

- Strict TypeScript for TeamLab code.
- Runtime validation at external boundaries.
- Deterministic domain functions where practical.
- No silent fallback for invalid external data.
- Accessible keyboard interaction for manual entry.
- Color is not the only signal.
- Upstream updates are auditable.
- Persisted data is migratable.
- Recommendation output is explainable.
- Expensive computation does not freeze the UI.

## 34. Risks and mitigations

### Upstream global coupling

Risk: PvPoke scripts expect globals and specific load order.

Mitigation:

- one bootstrap;
- typed adapters;
- no direct component access;
- characterization tests.

### Mutable engine objects

Risk: reused `Pokemon` objects carry battle state.

Mitigation:

- construct/reset temporary objects;
- persist only TeamLab records;
- translate results into immutable values.

### Dataset/schema changes

Risk: upstream JSON changes break TeamLab.

Mitigation:

- repositories;
- Zod schemas;
- explicit error state;
- adapter tests;
- version reporting.

### Recommendation cost

Risk: 100+ records generate too many teams/matchups.

Mitigation:

- anchor requirement;
- ranking shortlist;
- pre-scoring;
- caching;
- finalist simulation;
- workers;
- cancellation.

### Manual-entry burden

Risk: users abandon setup before entering enough Pokémon.

Mitigation:

- rapid-entry UX;
- duplication;
- defaults;
- assumed IV option;
- future import roadmap;
- visible inventory value before recommendations.

### Misleading IV rank

Risk: users treat stat-product rank as absolute quality.

Mitigation:

- distinguish rank from performance;
- show meta evidence;
- add CMP/breakpoint context;
- label acquisition-floor limitations.

### Local data loss

Risk: browser storage is cleared.

Mitigation:

- JSON backup/restore;
- backup reminders;
- clear storage documentation;
- later cloud sync.

### Branding/assets

Risk: TeamLab appears official or uses unlicensed assets.

Mitigation:

- distinct identity;
- “a PvPoke fork” attribution;
- asset-license review;
- pre-deployment brand review.

### Premature backend work

Risk: authentication and synchronization delay core product value.

Mitigation:

- IndexedDB MVP;
- repository interfaces;
- Firebase deferred until local workflows are proven.

## 35. Open implementation details

The following do not block the project plan and can be decided during implementation:

- exact component library, if any;
- final design tokens;
- default recommendation count within one-to-five;
- detailed recommendation score formula;
- worker library versus plain Web Workers;
- exact inventory import conflict UI;
- exact route names;
- final Firestore provider/configuration;
- permanent public brand/domain;
- when exact Stardust/Candy cost calculation enters scope.

These choices must preserve the boundaries and product behavior defined above.

## 36. Decision log

Established decisions:

| Area | Decision |
| --- | --- |
| Product name | TeamLab |
| Descriptor | TeamLab — a PvPoke fork |
| Primary audience | Competitive PvP player; motivated casual secondary |
| Initial format | Open Great League |
| Entry method | Manual |
| Inventory completeness | Species/form, CP, Shadow state, moves, IVs or explicit assumption |
| Missing IVs | Use visibly labeled rank-one assumption |
| Planned builds | Record state with desired evolution and moveset |
| Purified state | Not first-class in MVP; Return may be represented in moves |
| User tags | Deferred |
| Resource balances | Not tracked |
| Saved teams | Ordered, named, notes supported |
| Species clause | Enforced |
| Team analysis | Always recalculated against current data |
| Recommendations | Require at least one anchor |
| Result count | Configurable from one to five |
| Ready-now builds | Prioritized in team building |
| Meta source | Current PvPoke rankings/meta |
| Simulation | Exact builds and TeamRanker; no full 3v3 AI prediction |
| Persistence | IndexedDB via Dexie |
| Catalog identity | Persist exact variant `speciesId`; derive form/Shadow metadata |
| Backup | JSON import/export in MVP |
| Local backend | None in MVP |
| Future backend | Firebase Authentication and Firestore |
| Frontend | React, TypeScript, Vite |
| Runtime validation | Zod |
| UI direction | Modern, card-oriented, desktop-primary, responsive |
| Upstream policy | Load/wrap without modifying upstream |
| Offline/PWA | Deferred |

## 37. Final direction

TeamLab’s first success is not determined by generating the mathematically “best” team for every player.

Its first success is:

1. a competitive player can accurately represent their Great League roster;
2. every build has useful IV, move, role, and meta context;
3. teams are built from real owned specimens;
4. saved teams can be evaluated transparently against current PvPoke data;
5. anchor-based suggestions help complete or improve those teams;
6. upstream PvPoke can continue updating without frequent merge conflicts.

That foundation supports the broader long-term vision: a one-stop workspace for inventory, investment planning, team recommendations, and meta simulation across Pokémon GO PvP.
