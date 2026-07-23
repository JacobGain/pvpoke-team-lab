# PvPoke Fork: Full Codebase Summary

> Repository snapshot reviewed: commit `f59fc0a2c` (`Update header.php`), PvPoke site version `1.37.3.27`.
>
> This document describes the repository as it exists. It intentionally does not fix or alter any implementation. Counts and active formats are snapshot-specific and will change as upstream game data changes.

## 1. Executive summary

This repository is the source of PvPoke, a mobile-first Pokémon GO PvP website. It provides:

- one-on-one, one-versus-many, and matrix battle simulations;
- static published rankings for leagues, cups, and battle roles;
- custom ranking generation;
- three-Pokémon team analysis and counter/alternative suggestions;
- a playable training battle against a configurable AI;
- training-performance analytics;
- a move explorer, Pokédex/stat explorer, CMP chart, articles, and settings;
- browser-based Game Master, ranking-override, and training-team editors;
- a separate Pokémon Scarlet/Violet Tera Raid counter calculator.

The application predates a conventional framework. PHP files render HTML shells and reusable fragments; browser-side JavaScript owns nearly all behavior and domain logic; JSON files are the primary database for game data, formats, rankings, groups, and AI team pools. jQuery 3.3.1 is the only major browser library. There is no package manifest, bundler, formal migration framework, conventional REST API, or automated test suite in this snapshot.

The architectural center is:

```text
PHP page and modules
    -> script tags + global page configuration
    -> GameMaster singleton loads JSON asynchronously
    -> page-specific Interface singleton initializes controls
    -> Pokemon objects model combatants
    -> Battle simulates/emulates turns
    -> Ranker/TeamRanker/TrainingAI orchestrate repeated battles
    -> interface renders results and updates shareable URLs
```

For the planned fork, the most reusable pieces are:

- `GameMaster.generateFilteredPokemonList()` for league/cup eligibility;
- `Pokemon` for levels, IVs, CP, moves, traits, URL serialization, and matchup state;
- `PokeSelect`, `PokeMultiSelect`, `Pokebox`, and `PokeSearch` for collection-style selection;
- static rankings and meta groups for fast candidate generation;
- `TeamRanker` for evaluating an owned team against a meta or custom threat set;
- the team builder’s counters/alternatives and scorecards for recommendations;
- local-storage data patterns in custom groups, team pools, and custom Game Masters.

The largest design gap for an inventory product is persistence and identity. Current Pokémon selections are mostly transient URL state or loose local-storage CSV/JSON. There are no user accounts, durable inventory records, unique specimen IDs, synchronization, authentication, or server-side ownership model.

## 2. Repository inventory

Top-level contents:

| Path | Purpose |
| --- | --- |
| `README.md` | Upstream overview, architecture sketch, ranking-generation instructions, contribution philosophy |
| `LICENSE` | MIT license |
| `FULL-SUMMARY.md` | This guide |
| `docker/` | Minimal Apache/PHP container definition |
| `src/` | Entire web root: pages, JavaScript, CSS, data, images, tools, and articles |

Approximate source footprint:

- 504 JSON files, dominated by ranking artifacts and Game Master data;
- 193 PNG and 25 JPG assets;
- 123 PHP files, many of them static articles;
- 60 JavaScript files, about 33,000 lines including the one-line minified jQuery;
- SCSS sources and checked-in compiled CSS;
- one SQL schema for training telemetry.

Major `src/` areas:

| Path | Responsibility |
| --- | --- |
| root `*.php` | Public page shells and tool entry points |
| `js/GameMaster.js` | Shared data singleton, loaders, eligibility/filter/search services |
| `js/pokemon/` | Pokémon and player domain objects |
| `js/battle/` | Battle engine, damage calculation, action logic, rankers, timeline values |
| `js/interface/` | Page controllers and reusable selectors/widgets |
| `js/training/` | Training setup, AI, live battle UI, match flow, analytics, editor |
| `js/devtools/` | Game Master, ranking override, and RSS editing UIs |
| `data/gamemaster/` | Human-maintained source chunks for the compiled Game Master |
| `data/rankings/` | Published rankings organized by cup/category/CP |
| `data/overrides/` | Curated moveset/weight/editor-score overrides |
| `data/groups/` | Meta and quick-fill groups |
| `data/training/` | AI pools, generated analysis, PHP endpoints, SQL schema |
| `modules/` | Reused PHP HTML fragments, script bundles, ads, analytics |
| `train/` | Training pages and battle markup fragments |
| `gm-editor/` | Browser-based custom Game Master editor pages |
| `articles/` | Article PHP pages, metadata, and article assets (assets are ignored by Git here) |
| `tera/` | Independent Tera Raid calculator with its own model/ranker/UI/CSS/data |

The repository currently contains untracked `.DS_Store` files as well as this summary file. They are not application architecture.

## 3. Runtime and deployment model

### 3.1 Server requirements

The main site expects:

- Apache with `mod_rewrite`;
- PHP with standard file/JSON/session support;
- `mysqli` and a MySQL-compatible database only for training telemetry;
- static-file serving for large JSON and image trees;
- a browser with modern-enough JavaScript, local storage, cookies, and AJAX.

`docker/Dockerfile` uses `php:apache-buster` and enables rewrite. `docker-compose.yml` builds it, maps `${PVPOKE_PORT:-80}:80`, and mounts `../src` at `/var/www/html/pvpoke/src`. `modules/config.php` correspondingly defaults:

```text
WEB_ROOT = /pvpoke/src/
WEB_HOST = http://<request host>/pvpoke/src/
MySQL database = pvpoke_training on localhost, root, blank password
```

Important operational observations:

- the Dockerfile contains `RUN a2enmod rewriteversion: '3.9'`, which appears to have accidental text appended to the command;
- Compose does not define a MySQL service, so training submission/analytics need separate database setup;
- `src/modules/config.php` is ignored and is environment-specific even though this checkout contains it;
- there is no dependency installation or asset build step;
- production cache busting is a manually maintained `$SITE_VERSION`;
- on a `WEB_ROOT` containing `src`, `header.php` replaces that version with random numbers to prevent local caching and exposes a developer panel;
- `service-worker.js` is empty, although the footer attempts to register it and a web app manifest exists.

### 3.2 Routing

`src/.htaccess` turns readable URLs into PHP query parameters. Key routes include:

- `/battle/`, `/battle/multi/`, `/battle/matrix/`, `/battle/sandbox/...`;
- `/rankings/{cup}/{cp}/{category}/{pokemon?}`;
- `/team-builder/{cup}/{cp}/{team and moves...}`;
- `/attack-cmp-chart/{cup}/{cp}/{pokemon?}`;
- `/train/analysis/{cup}/{cp}/`;
- `/gm-editor/pokemon/{id}` and `/gm-editor/moves/{id}`;
- `/tera/{boss}/{tera}/{attack types}/{traits}`;
- `/articles/<path>/` to a matching PHP file;
- `/rss/` to the static feed.

The URL is an important state/persistence mechanism. Pokémon IDs, CP, shield settings, moves, IV/start-state modifiers, teams, matrix groups, selected ranking entry, and Tera options are encoded in paths or query parameters. `header.php` sanitizes `$_GET` values with `htmlspecialchars()` and exposes the result as the global JavaScript variable `get`.

Several old seasonal prefixes redirect to the current equivalent route. Directory indexing is disabled.

### 3.3 Shared page shell

`header.php`:

- loads configuration and establishes the site version;
- reads the `settings` cookie and fills missing settings;
- emits metadata, manifest, favicon, shared/style theme CSS, jQuery, RSS reader, analytics, ad bootstrap, globals, header/navigation, and the opening page container;
- dynamically marks selected navigation based on `REQUEST_URI`;
- injects user settings and request parameters as JavaScript globals;
- warns when a custom Game Master is active;
- runs one-time migration of old custom-group cookies to local storage.

`footer.php`:

- closes the page container;
- loads ad placements;
- includes the localhost developer panel;
- renders legal/version text;
- owns global menu, share/copy, toggle, service-worker, numeric-wheel, and migration interactions.

The shell relies on globals (`host`, `webRoot`, `siteVersion`, `settings`, `get`) and script load order. Interface files frequently assume other constructors already exist.

## 4. Application bootstrap and object model

Three tiny entry scripts instantiate the page:

- `Main.js` creates the normal page interface and exposes `getGM()`;
- `RankingMain.js` does the same for ranking-like pages;
- `RankerMain.js` does the same for ranking generation.

`GameMaster.getInstance()` is a singleton. Its initial AJAX load is the effective application bootstrap. On success it:

1. loads `data/gamemaster.min.json` in non-local production, otherwise the readable JSON;
2. stores current/original data;
3. populates PHP-rendered format/cup selectors;
4. adds current formats to the Rankings navigation;
5. builds Pokémon and move lookup maps;
6. alphabetizes and builds a lightweight search list;
7. optionally overlays a custom Game Master from local storage;
8. calls `InterfaceMaster.getInstance().init(gameMaster)` and, where present, the custom ranking interface.

The code uses old-style constructor functions, singleton closures, ES6 classes in a few newer files, jQuery event handlers, mutable objects, and global names. There are no imports or modules.

## 5. Data model and data pipeline

### 5.1 Compiled Game Master

`data/gamemaster.json` is the main client-side database. At this snapshot it contains 1,736 Pokémon/form entries and 334 moves. Top-level keys are:

- `id`, `title`, `timestamp`;
- `settings` (`partySize: 3`, maximum buff stages 4, buff divisor 4);
- `pokemon`, `moves`;
- `cups`, `formats`, `rankingScenarios`;
- `pokemonTags`, `pokemonRegions`, `pokemonTraits`;
- `fastMoveArchetypes`, `chargedMoveArchetypes`;
- `shadowPokemon`, `greatLeagueIneligible`.

`gamemaster.min.json` is functionally the same data in compact form.

A Pokémon entry commonly includes:

- `dex`, `speciesId`, `speciesName`;
- `baseStats.atk/def/hp`;
- one or two `types`;
- arrays of fast- and charged-move IDs;
- `defaultIVs` keyed by CP cap, with `[level, attack IV, defense IV, HP IV]`;
- `level25CP`, buddy distance, third-move dust cost, and release flag;
- tags, nicknames/search priority, aliases, level floor/cap;
- legacy and Elite moves;
- family ID, parent, and evolutions;
- optional form-change definitions, original form, native stat buffs, or other special metadata.

A move entry commonly includes:

- ID, display name, abbreviation, type, archetype;
- power, charged energy cost or fast energy gain;
- cooldown in milliseconds and turns;
- optional buffs, apply chance/meter, target, separate self/opponent buffs;
- optional form-change behavior.

IDs are the stable joins across Game Master entries, groups, rankings, URLs, and UI state.

### 5.2 Source chunks and compilation

The maintainable inputs live under `data/gamemaster/`:

- `base.json` for shared metadata, tags, scenarios, and traits;
- `pokemon.json`;
- `moves.json`;
- `formats.json`;
- one JSON file per active cup in `gamemaster/cups/`;
- archived cups under `gamemaster/cups/archive/`.

Visiting/running `data/compile.php`:

1. reads base, Pokémon, moves, and formats;
2. stamps the current server datetime;
3. loads every valid JSON file in the active cup directory;
4. writes both compiled Game Master files;
5. generates `data/formats.php` for server-side ranking-page metadata.

This is an unauthenticated, web-accessible write operation unless deployment rules restrict it.

Browser utilities `parse.php`, `parseElite.php`, `parseEvolution.php`, and `parseMoveCost.php` adapt pieces of an upstream Pokémon GO app Game Master and print JSON to the developer console/page. `parseMoves.php` combines a CSV with existing move names/metadata. They are developer aids rather than an automated ingestion pipeline.

`movesets.php` streams a CSV of every Pokémon and its move names.

### 5.3 Cups, formats, and eligibility

A format is navigation/display metadata: title, cup ID, CP, meta group, visibility flags, and optional rules. A cup contains executable eligibility rules and behavior.

Cup fields used across the code include:

- `name`, `title`, league/level cap, party size;
- `include` and `exclude` filters;
- overrides and ranking aliases;
- target filtering, low-stat inclusion/exclusion, default moveset behavior;
- team-pool slots, restricted picks, tiers, and other special rules.

Filter types supported by `GameMaster.generateFilteredPokemonList()` include:

- Pokémon type;
- inclusive Pokédex ranges;
- tags/categories;
- third-move cost;
- buddy distance;
- evolution stage;
- explicit species ID;
- known move;
- known move type.

Filters can be league-specific. Explicit inclusion IDs can override other inclusion criteria. Shadow/variant normalization is handled in selected cases. The method also applies release state, league stat-product floors, a Great League ban list, duplicate/low-level Shadow rules, cup overrides, and ranking data.

This function is the canonical eligibility gate for an inventory recommendation system; duplicating these rules elsewhere would create drift.

### 5.4 Rankings, overrides, and groups

Published rankings are static JSON:

```text
data/rankings/<cup>/<category>/rankings-<cp>.json
```

Categories include `leads`, `closers`, `switches`, `chargers`, `attackers`, `consistency`, and `overall`; some archived/generated paths contain other categories. A ranking row can contain:

- identity and rating/score;
- best matchups and counters;
- selected moveset;
- aggregated move usage counts;
- category score vector;
- editor score and notes;
- effective attack, defense, HP, and stat product.

`data/overrides/<cup>/<cp>.json` contains curated movesets, weights, editor scores/notes, and similar ranking-generation adjustments.

`data/groups/*.json` contains named quick-fill/meta groups. A row identifies a species and can pin fast and charged moves. Groups feed multi-selects, team analysis targets, training rosters, and search/meta features.

`GameMaster` caches ranking, group, training-analysis, and team-pool requests in memory for the page lifetime. A cup may redirect ranking loads through `rankingAlias`.

### 5.5 Browser persistence

Current persistence is deliberately lightweight:

- a five-year `settings` cookie;
- old custom-group cookies migrated once into local storage;
- custom groups stored as CSV-like values in local storage;
- custom Game Masters stored as JSON objects with `dataType: "gamemaster"`;
- training team pools stored with `dataType` metadata, generally under `team-pool-*`;
- article checklist progress in local storage;
- a `rankingsShowMoveCounts` local-storage preference;
- URL-encoded selections for shareable tool state.

There is no schema versioning, centralized repository abstraction, account ownership, cross-device synchronization, or storage quota handling.

## 6. Core domain logic

### 6.1 `GameMaster.js`

Besides loading data, the singleton is a broad domain service. It:

- maps Pokémon and move IDs for fast lookup;
- caches instantiated Pokémon by league for search;
- retrieves Pokémon families, tiers, cups, and formats;
- synthesizes/removes Shadow entries and handles legacy/Elite move distinctions;
- calculates default IV combinations and family/evolution information;
- creates normalized move objects and move descriptions/archetypes;
- loads rankings, training analysis, groups, articles, and training team pools;
- filters eligible Pokémon;
- parses rich Pokémon and move search strings;
- applies ranking movesets and overrides;
- saves/loads custom Game Masters.

Search is unusually capable and directly relevant to inventory. Pokémon queries support combinations and negation around names/IDs, types, moves, legacy/Elite status, family, tags, dex values/ranges, dust cost, buddy distance, IVs, XL status, region, stat product, tier/meta group, Shadow state, and generated playstyle traits. Move search supports name, ID/abbreviation, type, archetype, and numeric properties. Search results are cached.

### 6.2 `Pokemon.js`

`Pokemon` is the main mutable domain object. Construction takes a species ID, battle index, and `Battle`. It copies base data, resolves its move pools, establishes types/tags/family/form metadata, initializes IV/level state, and creates battle state.

It owns:

- CP multiplier table and Pokémon GO CP calculation;
- level and level-cap handling;
- default IV selection by league;
- exhaustive IV-combination generation and stat maximization;
- effective attack/defense/HP;
- level/IV filters, XL checks, and breakpoints/bulkpoints support;
- move pools, selected moves, recommended movesets, move usage, custom moves;
- move damage/DPE/cycle calculations;
- Shadow and Purified transformations;
- start HP, energy, shields, stat buffs, cooldown, priority;
- reset/full-reset behavior;
- type effectiveness, TDO, matchup traits, and similar-Pokémon scoring;
- family/evolution stage;
- form transitions and special form stats/move replacement;
- compact URL and moveset serialization.

Initialization uses Game Master defaults unless the user has customized level/IVs. Master League/no-cap uses level-cap 15/15/15. CP-capped leagues use the stored default combination. Pokémon are mutable and reused aggressively, so callers must reset them between simulations.

Shadow state applies attack/defense multipliers and adds/removes Return/Frustration according to eligibility. Legacy moves are marked `†`; Elite moves use `*`.

Special mechanics are embedded in general code and explicit species/form branches. Examples include Aegislash stance behavior, Mimikyu’s disguise/busted protection, Morpeko form handling, Shedinja’s HP, and move-triggered form changes. New battle mechanics may therefore require coordinated changes in Game Master data, `Pokemon`, `Battle`, `DamageCalculator`, `ActionLogic`, URL encoding, and interfaces.

### 6.3 `DamageCalculator.js`

Damage uses Pokémon GO’s familiar floored calculation based on:

- move power;
- effective attacker attack / defender defense;
- STAB and type effectiveness;
- Shadow and stat-stage multipliers;
- charged minigame charge amount;
- form-specific effects.

It also exposes inverse breakpoint and bulkpoint calculations and a hard-coded type chart. Type effectiveness values are multiplied for dual types.

### 6.4 `Battle.js`

`Battle` runs both fast deterministic simulations and interactive emulation.

Core state includes:

- two active Pokémon and optional two `Player` teams;
- CP/level cap/cup;
- simulation versus emulation mode;
- deterministic/default versus random decisions;
- turn time in 500 ms increments;
- current phase, queued/current/previous actions;
- user-authored sandbox actions;
- timeline events, animations, messages, duration, winner, and ratings;
- charged-move priority, shield choice, charge amount;
- starting HP/energy and buff-probability override.

Important modes:

- `simulate`: synchronous automated matchup used by rankings and team analysis;
- `emulate`: timer/callback-driven full-team playable battle;
- sandbox: obeys authored actions and forced shield/buff/charge settings;
- normal: action logic decides attacks and shields.

The turn loop:

1. resets combatants and derives CMP from attack;
2. obtains or queues actions;
3. orders simultaneous actions, charged moves, switches, and fast moves;
4. processes cooldown, damage windows, energy, shields, buffs, form changes, and fainting;
5. advances phases such as neutral, charged, shield, switch, and battle end;
6. records timeline events and ratings;
7. ends on configured faint conditions, timeout, or full-team result.

The simulator can run until first faint or both faint. Full emulation handles 60-second switch clocks, replacements, team counts, countdowns, charged minigame timing, pauses, and callbacks to the training UI.

Battle rating is centered on 500 for an even result and is based on remaining damage/HP, shield value, and turn margin. `calculateTurnMargin()` estimates how much additional fast/charged work separates combatants. Consumers commonly interpret values over 500 as favorable.

### 6.5 `ActionLogic.js`

The default simulator decision engine chooses fast moves, charged moves, and shields. It considers:

- available energy and KO opportunities;
- shield baiting;
- self-buffs and self-debuffs;
- overfarming and energy waste;
- fast-move timing/alignment;
- CMP and simultaneous faint risk;
- remaining shields and projected cycles;
- form-change protection;
- probabilistic/random action mode.

`wouldShield()` forecasts post-move HP, follow-up fast/charged damage, move effects, and battle mode. `BattleState` supports forward-looking move sequence evaluation.

This decision system is an approximation, not a search over all possible player strategies. Ranking outputs inherit its heuristics and the configured shield/energy scenarios.

### 6.6 Timeline values

`TimelineEvent` is rendered history: type, name, actor, time/turn, and values. `TimelineAction` is authored sandbox input with compact type encoding. Battle can convert a generated timeline back into editable actions.

### 6.7 `Player.js`

`Player` represents one side of a full-team emulated match:

- roster/team and active Pokémon;
- remaining Pokémon and shields;
- switch timer;
- charged-move priority;
- optional AI;
- reset and switch operations.

It is primarily used by training rather than the one-on-one ranking engine.

## 7. Ranking generation

### 7.1 Role rankings

`ranker.php` loads `RankerInterface` and `Ranker`. Ranking generation is browser-executed, computationally expensive, and writes results back through PHP.

The five Game Master scenarios are:

| Category | Subject shields | Target shields | Subject energy | Target energy |
| --- | ---: | ---: | ---: | ---: |
| Leads | 1 | 1 | 0 | 0 |
| Closers | 0 | 0 | 0 | 0 |
| Switches | 1 | 1 | 4 | 0 |
| Chargers | 1 | 1 | 6 | 0 |
| Attackers | 0 | 1 | 0 | 0 |

`Ranker`:

1. generates eligible subjects and targets;
2. imports cup/ranking overrides and recommended moves;
3. runs each matchup, commonly in both directions;
4. tracks ratings, move use, bait-dependent outcomes, matchups, and counters;
5. weights results and normalizes category scores;
6. emits JSON and posts it to `data/write.php`.

It can auto-select moves based on performance or honor forced/default movesets. It gives special handling to scenario energy, shields, cup target weighting, low-ranking cutoffs, and selected form mechanics.

### 7.2 Overall rankings

`rankersandbox.php` loads `RankerOverall`. It reads the previously generated role categories, combines/normalizes their scores, aggregates or selects move usage, applies editor overrides, computes consistency, and writes overall and consistency artifacts.

Overall ranking rows expose six scores: overall plus the five contributing roles/metrics. Curated `editorScore` can affect the published result and `editorNotes` explain expert judgment.

### 7.3 Write path and operational risk

`data/write.php` accepts POSTed `data`, `league`, `category`, and `cup`; validates a small league/category allowlist and JSON decoding; normalizes the cup with `basename()`; and writes directly under `data/rankings/`.

There is no authentication or CSRF protection. Its own comment says it does not belong in production. The same concern applies to compilation and some editor publishing paths. A production fork should isolate authoring tools from public serving even if their code remains useful.

## 8. Public tool flows

### 8.1 Home

`index.php` presents entry cards for Battle, Rankings, Team Builder, Train, Contact, and Tera tools plus news. `HomeInterface` loads Game Master-backed content and RSS/article information. It conditionally loads the battle/team code needed for interactive home features.

### 8.2 Battle simulator

`battle.php` serves three layouts controlled by `mode`:

- single: choose two Pokémon and simulate a detailed matchup;
- multi: one selected Pokémon versus a group;
- matrix: one group versus another, producing a rating matrix.

`Interface.js` is the large page controller. It coordinates:

- league/cup and level cap;
- Pokémon selectors and move/IV/start-state settings;
- shields, energy, HP, stat buffs, baiting, and timing;
- normal and sandbox simulations;
- timeline playback and sandbox action editing;
- battle histogram/matrix results;
- breakpoint, bulkpoint, CMP, stat, and move displays;
- URL import/export and link updates.

Single battle creates two `Pokemon` objects and a `Battle`, simulates, and renders a timeline plus detailed explanations. Multi/matrix use `TeamRanker` over selected groups. Sandbox mode exposes manual action sequences and forced outcomes.

### 8.3 Rankings

`rankings.php` derives server-side metadata from the requested format, then `RankingInterface` loads the corresponding static JSON. Users can:

- select format/category;
- search/filter Pokémon;
- inspect score, stats, types, recommended moves, role scores, matchups, counters, traits, and notes;
- open a focused Pokémon detail;
- jump to related battle/team-builder URLs;
- toggle move-use counts and ranking-detail layout.

`TeamRanker` is included for detail/matchup interactions. `hexagon-chart.js` draws the role score visualization.

### 8.4 Custom rankings

`custom-rankings.php` plus `CustomRankingInterface` builds an in-browser custom cup. It exposes:

- CP/league;
- include and exclude filters for type, tags/categories, cost, distance, evolution, IDs, dex ranges, moves, and move types;
- subject/target shields and starting energy;
- import from a current or archived cup;
- eligible Pokémon list;
- custom target group;
- per-Pokémon moveset overrides;
- JSON settings import/export.

It invokes `Ranker` directly and displays generated rankings without requiring the prebuilt static pipeline. This is a strong prototype for inventory-aware ranking, but large pools can be expensive on the main browser thread.

### 8.5 Team Builder

`team-builder.php` and `TeamInterface` evaluate a team, usually up to three Pokémon, against a chosen cup/meta. Inputs can come from individual selectors, group import, or URL.

Configurable analysis includes:

- maximum team and scorecard length;
- Shadow inclusion;
- meta prioritization;
- XL recommendations;
- same-species allowance;
- shield model and bait behavior;
- custom threats and alternatives;
- excluded threats and alternatives.

The output includes:

- matchup coverage across the meta;
- defensive/type coverage;
- threats and their team-wide danger;
- suggested counters and alternative Pokémon;
- team grades for coverage, bulk, safety, and consistency;
- histograms and supporting match details.

`TeamRanker.rank(team, cp, cup, exclusionList, context)` is the computational engine. It:

- establishes an eligible target set or uses explicit targets;
- optionally applies recommended ranking movesets;
- evaluates chosen shield scenarios;
- averages every candidate/opponent result against the team;
- returns scores, battle ratings, move details, and context-specific counter/alternative results;
- can prioritize candidates present in the selected meta group.

This existing flow is the closest match to the planned “recommend teams from inventory, then simulate against meta” feature.

### 8.6 CMP chart

`attack-cmp-chart.php` and `AttackChartInterface` list effective attack stats for a selected format/group and optionally a focused Pokémon. Because charged-move priority goes to higher current attack, it is useful for comparing IV builds and identifying ties. It reuses multi-select, Pokémon initialization, search, and link serialization.

### 8.7 Moves

`moves.php` and `MovesInterface` render sortable fast/charged move tables with power, energy, turns, DPT/EPT/DPE, archetype, buffs, and learnsets. Users can change display options and search/filter. Clicking a move can enumerate Pokémon with a matching moveset.

### 8.8 Pokédex

`pokedex.php` and `PokedexInterface` provide a sortable stat-oriented Pokémon list by league. It initializes Pokémon at the selected cap and exposes calculated CP/stat data. It is a useful existing surface for adding ownership counts or collection filters.

### 8.9 Settings

`settings.php` and `Settings.js` edit:

- theme;
- active default/custom Game Master;
- Pokebox linkage fields;
- performance and colorblind modes;
- ad and XL behavior;
- default IV preference;
- ranking-details layout;
- hard moveset URL encoding.

Changes POST to `data/settingsCookie.php`, which stores the submitted object as a long-lived JSON cookie and reloads. PHP defensively adds missing properties on future requests.

### 8.10 Pokémon selection components

These are critical reusable UI pieces:

- `PokeSearch`: lightweight search field behavior;
- `PokeSelect`: one Pokémon, including moves, IV/level, Shadow, and battle settings;
- `PokeMultiSelect`: groups/rosters, quick-fill, custom groups, CSV import/export, move-count UI, and URL serialization;
- `Pokebox`: optional external-style collection selector/sync hooks;
- `SortableTable`, `ModalWindow`, and `BattleHistogram`: generic supporting widgets.

`PokeMultiSelect` is almost 1,900 lines and mixes rendering, group persistence, selection rules, import/export, and battle settings. It provides immediate leverage for inventory but is not a clean standalone data layer.

## 9. Training subsystem

### 9.1 Training setup and match flow

`train/index.php` renders setup plus a complete battle scene from modules:

- `top.php`;
- `scene.php`;
- `controls.php`;
- `end-screen.php`.

`TrainingSetupInterface` manages:

- league/cup and difficulty;
- player roster/team;
- opponent roster;
- team-selection method;
- imported teams and featured teams;
- tournament round setup.

`MatchHandler` moves between setup, battle, and result states. It supports ordinary matches and tournament-like rounds, initializes `Player` and `Battle`, asks the AI for teams, advances rounds, and returns to setup.

`BattleInterface` is the live renderer/input adapter. It receives `Battle.dispatchUpdate()` callbacks and handles:

- health/energy/shield bars;
- move buttons and tapping;
- charged-move minigame;
- shield decisions;
- switching;
- animations, messages, clocks, pauses, restart/quit;
- automatic tapping;
- end-screen results;
- optional analytics submission.

### 9.2 Training AI

`TrainingAI` is separate from the simpler simulation `ActionLogic`. It selects rosters/teams and makes full-match strategic decisions.

Roster/team generation can use:

- static team-pool files under `data/training/teams/<cup>/<cp>.json`;
- cup slots, presets, synergies, roles, and restricted picks;
- custom local-storage team pools;
- randomness and prior battle performance;
- selected difficulty/strategy set.

During battle it evaluates:

- current and bench matchups via quick simulation;
- switch clock and switch advantage;
- counter-switching and farm-down opportunities;
- shield baiting, energy farming, overfarming;
- projected damage and knockout risk;
- preserving Pokémon/shields;
- advanced shielding and protection from obviously bad decisions.

Difficulty maps to progressively richer strategy flags such as basic switching, timing optimization, shield baiting, energy farming, switch-advantage preservation, and advanced shielding.

### 9.3 Training team editor

`train/editor.php` and `TrainingEditor` let a developer/user build team pools, save/load them in local storage, import/export JSON, define rosters/presets, and delete pools. These data structures could seed recommendation constraints or curated archetypes.

### 9.4 Training analytics

When enabled, `BattleInterface.reportBattleAnalytics()` posts Pokémon and team rows to `data/training/postTraining.php`. The endpoint:

- starts a PHP session;
- limits a session to one submission per 120 seconds;
- requires Pokémon and team arrays;
- inserts prepared rows into `training_pokemon` and `training_team`.

The SQL schema records Pokémon ID, format, team position, player/bot type, team score, individual score, shields, team string, and timestamp.

`getTraining.php` aggregates the last 14 days by format:

- total performers and teams;
- average individual/team score and game count by Pokémon;
- usage trend in ten three-day windows for sufficiently used Pokémon;
- average team score and games by team string.

`train/analysis.php` normally loads generated JSON under `data/training/analysis/<cup>/<cp>.json`; `TrainRankingInterface` displays Pokémon and team performance. The text explicitly warns this is sampled site-bot play, not direct GO Battle League data.

Potential operational concerns to preserve in planning:

- submission validation trusts many client-provided values;
- rate limiting is session-only;
- there is no authentication, CSRF token, format allowlist, or transaction around related inserts;
- aggregation can divide by zero in empty periods;
- the checked-in data snapshot has directories but no obvious current analysis/team JSON at some expected glob locations;
- `train/analytics.php` contains stale-looking script paths (`js/battle/TimelineEvent.js`, `js/battle/TeamRanker.js`) while current files live in subdirectories.

## 10. Editors and developer tools

### 10.1 Game Master editor

`gm-editor/` is a browser-local editor:

- `index.php` lists/imports/exports/selects custom Game Masters;
- `edit.php` shows Pokémon or move tables;
- `pokemon.php` edits identity, stats, types, moves, metadata, family/forms, and JSON;
- `move.php` edits move stats, buffs/forms, metadata, learnset, and JSON.

The `GMEditor*Interface` classes and `GMEditorUtils` provide table editing, validation, comparison to the original Game Master, saving to local storage, change detection across tabs, and export/import. Activating a custom Game Master changes `settings.gamemaster`.

The editor notes an important boundary: pages driven directly by Game Master data change, but published static rankings and dependent artifacts do not automatically regenerate. A fork must explicitly define whether inventory recommendations use official rankings, custom live simulations, or regenerated rankings.

### 10.2 Override editor

`data/overrideEditor.php` and `OverrideInterface` load a cup/league override file, edit movesets, weights, editor scores/notes, add Pokémon, sort/filter, import league movesets, and export JSON. Publishing uses AJAX/write paths and should be treated as an administrative tool.

### 10.3 RSS and article tooling

`RSSReader` loads the XML feed for shared news UI. `RSSFeedInterface`/`rss/feedEditor.php` support feed editing. Articles are individual PHP documents, with an `articles.json` metadata index and `ArticlesInterface` listing them. `ArticleChecklist` loads checklist data and persists user progress locally.

## 11. Tera Raid calculator

`src/tera/` is essentially a separate small application for Scarlet/Violet, sharing only broad site conventions.

- its own header/footer and CSS;
- its own `tera/data/gamemaster.json`;
- `tera/js/GameMaster.js` loads Pokémon and trait data;
- `Pokemon.js` models boss/attacker stats, Tera type, and enabled traits;
- `Trait.js` applies ability-style immunity, resistance, and stat effects;
- `TeraRanker.js` scores offense and defense and ranks counters;
- `TeraInterface.js` owns boss, Tera type, attack type, trait, sort, search, results, modal, and URL state.

It should not be confused with Pokémon GO battle logic. Its type chart/objects are separate and should remain isolated from inventory features unless the fork deliberately supports main-series games.

## 12. Styling, assets, ads, and analytics

`css/style.scss` is the large main stylesheet; `style.css` is checked-in compiled output. Training and article extras have separate SCSS/CSS, and themes have overrides such as Night. There is no checked-in Sass build script, so compilation is manual/external.

Images include:

- UI/theme art and icons;
- type icons;
- Pokémon sprites loaded by naming convention;
- article/infographic assets;
- Tera imagery.

Ads are fragmented under `modules/ads/` and `tera/modules/ads/`. Most are tiny provider snippets. `modules/analytics.php` is a shared injection point. Environment values in config are blank by default.

## 13. Testing and quality controls

No automated unit, integration, browser, snapshot, or performance tests were found. There is no CI configuration, linter configuration, package manager metadata, or PHP dependency manifest in this snapshot.

Existing quality controls are:

- runtime validation and console errors;
- Game Master editor validation;
- manual browser rank generation;
- developer-facing tools and debug logs;
- JSON parsing checks in selected write scripts;
- prepared statements in training SQL endpoints;
- side-by-side simulation outputs and curated overrides.

High-risk regression areas for future work are battle timing, special forms, move buffs, URL parsing, eligibility filters, and mutable Pokémon reuse. Before extending the fork substantially, characterization tests around these areas would provide the best safety return.

## 14. Architectural strengths

- The complete battle and ranking logic is client-visible and reusable.
- Domain data is explicit JSON rather than hidden in a service.
- Species/move IDs consistently join most subsystems.
- Static rankings make public browsing fast and cheap.
- URLs make almost every analysis reproducible/shareable.
- Cup filtering is expressive and centralized.
- Components already support custom groups, imported rosters, and custom movesets.
- Team Builder already implements the core recommendation primitives.
- Training AI demonstrates full-team tactical selection beyond isolated matchups.
- The project is dependency-light and easy to inspect.

## 15. Architectural constraints and noteworthy risks

These are observations, not fixes:

- Global variables and script order create implicit coupling.
- Interface files mix DOM manipulation, state, serialization, and domain orchestration.
- `GameMaster` and `Pokemon` have very broad responsibilities.
- Pokémon are highly mutable and sometimes cached/reused.
- Static ranking JSON can become inconsistent with Game Master or custom data.
- Rankings are heuristic simulation products, not empirical GBL truth.
- Main-thread matrix/ranking work can be expensive; there are no Web Workers.
- Many mechanics are encoded as species/move-specific branches.
- Data compilation and ranking writes are web-accessible PHP scripts without authentication.
- Settings are trusted from a client cookie and emitted back into JavaScript/HTML with uneven type handling.
- Local-storage formats are informal and unversioned.
- Some paths/comments appear stale after directory reorganizations.
- The Docker setup is incomplete for training and contains a suspicious Dockerfile command.
- The service-worker registration currently points at an empty file and relative scope may differ on nested routes.
- No test suite protects simulation correctness.
- Generated artifacts are numerous and large; upstream data updates will create large diffs.
- Copyright/trademarked image/data use and upstream attribution should remain visible even though code is MIT.

## 16. Best path for the planned inventory/team-recommendation fork

### 16.1 Suggested conceptual layers

Keep existing simulation objects as the calculation core, but introduce clear fork-owned layers:

```text
Inventory records
    -> eligibility + availability projection
    -> candidate generator using rankings/meta/groups
    -> team combination generator
    -> TeamRanker/Battle evaluation
    -> recommendation explanation
    -> deep links into existing Battle and Team Builder views
```

An inventory record needs to distinguish a species template from an owned specimen. Useful fields include:

- stable inventory UUID;
- species/form ID and Shadow/Purified state;
- nickname/tags/favorite;
- level, CP, attack/defense/HP IVs;
- current and available/legacy moves;
- second-move unlock state;
- powered-up/evolution readiness and resource cost;
- league eligibility and calculated stats;
- source/update timestamp.

Do not use `speciesId` alone as inventory identity: one player can own many builds of the same species.

### 16.2 Reuse opportunities

- Use `Pokemon` to calculate every specimen’s league stats instead of storing derived values as authority.
- Use cup filtering once at species level, then apply specimen-level CP/evolution/readiness constraints.
- Adapt `PokeMultiSelect` import/export and search syntax for bulk inventory entry.
- Treat existing ranking JSON as a candidate shortlist, not the final recommendation.
- Use `GameMaster.loadGroupData()` to define the opponent meta.
- Use `TeamRanker` to score shortlisted teams against that meta.
- Use Team Builder threats/counters to explain recommendations.
- Generate existing Battle and Team Builder URLs so a recommendation can be inspected immediately.
- Use training team-pool presets as optional known-good team archetypes.

### 16.3 Recommendation strategy

Brute-forcing every combination of a large inventory against a full meta is combinatorial. A practical pipeline is:

1. normalize owned specimens and calculate legal league builds;
2. rank individual candidates using static role rankings, ownership readiness, and user cost preferences;
3. preserve role/type diversity and shortlist candidates;
4. generate team combinations with duplicate/cup constraints;
5. pre-score combinations from the static matchup matrix where possible;
6. run detailed `TeamRanker`/`Battle` simulations only for finalists;
7. return several recommendations optimized for different goals such as strongest now, cheapest upgrade, safest, most consistent, or anti-meta;
8. explain uncovered threats, recommended moves, IV/build assumptions, and upgrade requirements.

Cache matchup results by a complete build key:

```text
game-data version + cup + CP/level cap
+ species/form/shadow + level/IVs + moves
+ opponent build + shields/energy/bait/timing settings
```

Species-only caching would be incorrect because IVs, moves, Shadow state, and starting conditions materially change outcomes.

### 16.4 Persistence choices

Local storage is suitable for a private prototype and matches the current project, but add:

- explicit schema version;
- migrations;
- validation;
- export/import backup;
- storage quota/error handling.

Cross-device inventory requires a backend and therefore decisions the upstream project intentionally avoided: accounts, authentication, authorization, privacy, deletion/export, database schema, synchronization/conflicts, and abuse protection.

### 16.5 Correctness boundaries to expose to users

Recommendations should state:

- Game Master/data timestamp;
- cup, CP, and level cap;
- assumed moves and whether they are owned/Elite/legacy;
- IV and level assumptions;
- shield, energy, bait, and move-timing assumptions;
- meta group and ranking snapshot;
- whether a result came from static rankings or fresh simulation.

This makes differences between “best species in theory,” “best build owned,” and “best affordable next upgrade” understandable.

## 17. Practical change map

When adding a feature, likely touch points are:

| Goal | Primary existing files |
| --- | --- |
| Load/query game data | `js/GameMaster.js`, `data/gamemaster/*.json` |
| Model an owned build | `js/pokemon/Pokemon.js` plus a new inventory model/repository |
| Add inventory UI | new PHP page/interface; reuse `PokeSearch`, `PokeSelect`, `PokeMultiSelect` |
| Filter by cup | `GameMaster.generateFilteredPokemonList()` |
| Recommend counters/alternatives | `TeamRanker.js`, `TeamInterface.js` |
| Simulate exact builds | `Pokemon.js`, `Battle.js`, `DamageCalculator.js`, `ActionLogic.js` |
| Use published meta | `data/groups/`, `data/rankings/`, Game Master loaders |
| Build share links | Pokémon URL methods, `.htaccess`, page interface URL methods |
| Persist locally | patterns in `Settings`, `TrainingEditor`, GM editor, custom groups |
| Add server persistence | new authenticated API/database; do not copy public write endpoints as-is |
| Update game data | `data/gamemaster/` chunks then `compile.php`, followed by ranking regeneration |
| Change battle mechanics | Game Master move/form data plus all core engine and relevant UI/serialization paths |

## 18. Recommended onboarding order

For a developer learning this fork:

1. Run the site and use Single Battle, Rankings, and Team Builder.
2. Read `header.php`, one simple page such as `pokedex.php`, and its interface.
3. Read the top and loader methods of `GameMaster.js`.
4. Follow one Pokémon from `pokemon.json` through `Pokemon.initialize()`.
5. Follow one `Battle.simulate()` through action choice, damage, and rating.
6. Trace `TeamRanker.rank()` from Team Builder input to threats/alternatives.
7. Inspect one group and one overall ranking JSON.
8. Read `Ranker` and `RankerOverall` to understand artifact provenance.
9. Explore `PokeMultiSelect` and local-storage group formats.
10. Read training only after the two-Pokémon engine is clear; it layers rather than replaces it.

## 19. Glossary of important terms in this code

- **Game Master:** compiled local JSON containing Pokémon, moves, formats, cups, and metadata.
- **Format:** UI/navigation pairing of cup, CP, and meta group.
- **Cup:** executable eligibility and special-rule object.
- **Group/meta:** named list of Pokémon, often with prescribed movesets.
- **Ranking override:** curated moveset, weight, or editorial adjustment used during generation.
- **Battle rating:** simulator’s matchup result around a neutral value of 500.
- **Role category:** lead, closer, switch, charger, or attacker scenario.
- **Overall ranking:** aggregation of role rankings plus consistency/editorial adjustments.
- **TeamRanker:** repeated-matchup engine used for team coverage, matrices, counters, and alternatives.
- **Simulate:** fast automated battle calculation.
- **Emulate:** live full-team battle with phases, timers, UI callbacks, and optional AI.
- **Sandbox:** authored/forced battle action mode.
- **Pokebox/custom group:** browser-persisted set of Pokémon selections; not a durable specimen inventory.
- **Custom Game Master:** locally stored replacement Pokémon/move dataset; it does not automatically replace static rankings.

## 20. Bottom line

PvPoke already contains nearly all of the hard calculation primitives required for the proposed fork. The shortest route is not to rewrite the simulator; it is to add a first-class owned-specimen inventory model, project that inventory into the existing cup/meta/ranking world, shortlist combinations intelligently, and feed finalists through `TeamRanker` and `Battle`. The main engineering work will be clean persistence, build identity, performance/caching, and explanations—not basic matchup math.

The safest development posture is to treat the current code as a coupled legacy calculation engine behind adapters. New inventory and recommendation code can establish clearer boundaries without first attempting a platform rewrite, while characterization tests lock down the battle outputs the fork depends on.
