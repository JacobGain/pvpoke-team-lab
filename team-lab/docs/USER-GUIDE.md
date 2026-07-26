# TeamLab Local User Guide

## What TeamLab does

TeamLab is a local-first Open Great League inventory and team-planning
application built on the data and simulation engine in this PvPoke fork.

The MVP lets you:

- record exact Pokémon you own and builds you plan;
- compare IVs, effective stats, roles, moves, and named-opponent thresholds;
- save ordered lead, safe-switch, and closer teams;
- run exact teams against the current Open Great League meta;
- build recommendations around one or two owned anchors;
- save selected recommendations as teams;
- back up and restore inventory and saved teams as JSON.

TeamLab does not require an account. Inventory and saved teams remain in the
current browser profile.

## Before you start

The local application requires:

- the complete PvPoke fork checkout, with `team-lab/` beside the inherited
  `src/` directory;
- Docker with Docker Compose for the inherited PvPoke server;
- Node.js 22.12 or newer;
- npm 11 or newer;
- a current desktop or mobile browser.

Docker serves the inherited PvPoke data and classic simulation scripts.
Vite serves the TeamLab React application and proxies PvPoke requests to
Docker.

## Start TeamLab locally

Use two terminals.

### Terminal 1: start inherited PvPoke

From the repository root, one directory above `team-lab/`:

```bash
make up
```

This builds and starts the local Apache/PHP container on port 80. Leave it
running.

### Terminal 2: start TeamLab

From `team-lab/`:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally:

```text
http://localhost:5173
```

The home page’s PvPoke data card should say **Connected** and **Schema valid**.
Do not begin entering data while the card says **Connection failed**.

### Use a different PvPoke port

If port 80 is unavailable, start the container on another port:

```bash
PVPOKE_PORT=8080 make up
```

Create `team-lab/.env.local`:

```dotenv
VITE_PVPOKE_BASE_URL=/pvpoke/src
PVPOKE_DEV_PROXY_TARGET=http://localhost:8080
```

Restart `npm run dev` after changing environment values.

### Keep the same browser origin

IndexedDB is isolated by browser origin. These are different local data stores:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:5174
```

Use the same hostname and port each time if you expect to see the same
inventory. Export a JSON backup before intentionally changing origins or
browser profiles.

## Recommended first-use workflow

```text
confirm PvPoke connection
        ↓
explore the catalog
        ↓
add at least one owned anchor
        ↓
analyze individual builds
        ↓
create and simulate a saved team
        ↓
generate recommendations around an anchor
        ↓
download a JSON backup
```

## Navigate TeamLab

On desktop, the top navigation keeps **Dashboard**, **Inventory**,
**Rankings**, **Teams**, and **Recommend** available throughout the
application. The data indicator opens engine diagnostics. Local backup/reset
tools are in the utility menu.

On a phone, the same four primary destinations remain in the bottom navigation.
Choose **More** for Rankings, local data, and diagnostics.

The Dashboard suggests one next action from your current local data. It does
not lock the rest of the application; use global navigation whenever you want
to move to a different workflow.

## Explore the catalog

Open **Rankings** from the desktop navigation or the mobile **More** menu.

The catalog shows normalized released Pokémon with:

- Pokédex and form identity;
- types and Shadow state;
- overall Open Great League rank where published;
- fast and charged moves;
- current-meta membership.

Search accepts a species name or species ID. The meta-only control narrows the
list to the current checked-in Great League group.

The catalog is reference data. Adding a Pokémon to inventory happens through
**Open your inventory**.

## Build your inventory

Open **Open your inventory**, then choose **Add Pokémon**.

### Current Pokémon

Search and select the exact species, form, and Shadow state in the combined
autocomplete field. Then record:

- current CP;
- actual IVs or the explicit PvPoke rank-one assumption;
- current fast move;
- one or two current charged moves;
- favorite status;
- optional notes.

TeamLab infers level from species, CP, and IVs. A CP/IV combination must map to
a legal supported level before the record can be saved.

New records default to **Enter actual IVs**. The form begins with legal
suggested values; replace them with the Attack, Defense, and HP values shown by
Pokémon appraisal. Use **PvPoke’s default rank-one spread** only when you
intentionally want an assumption. Assumed IVs remain marked as assumptions
throughout TeamLab.

The entry flow has three short steps:

1. required exact specimen details, CP, IVs, and moves;
2. required current-versus-planned intent; and
3. a review with optional notes.

When PvPoke publishes a recommended moveset for the selected Pokémon, TeamLab
preselects that fast move and both charged moves. Change any move when your
actual build differs.

A new record starts with no Pokémon selected. Type a species or form name and
choose an autocomplete suggestion; CP, IV, and move controls load only after
that choice.

### Current versus planned

Choose **Current** to analyze what the Pokémon can use now.

Choose **Planned** when you want to retain the current specimen but
analyze a desired evolution, CP, or moveset. The current and planned builds are
kept separate, and screens identify which one is being used.

Planned builds are qualitative plans. TeamLab does not calculate Stardust,
Candy, XL Candy, Elite TM, or evolution-item costs in the MVP.

### Faster entry and maintenance

- **Save and add another** carries the previous form forward.
- **Duplicate** creates a new record from an existing one.
- **Edit** changes an existing record without changing its inventory ID.
- **Favorite** makes a record available to the favorites-only filter.
- Dashboard search includes species names and notes.
- Sort by update time, species name, or CP.

Individual **Delete** uses a browser confirmation. Deleting a record referenced
by a saved team leaves that team in a repair state. Bulk inventory clearing is
stricter and is blocked while saved teams exist.

## Analyze a build

Choose **Analyze** on an inventory card.

The analysis screen can show:

- inferred level and exact effective Attack, Defense, and HP;
- stat product, IV rank, percentile, and rank-one comparison;
- Attack percentile and broad CMP context;
- overall and role-specific PvPoke ranking evidence;
- published recommended moves compared with the entered moves;
- qualitative build requirements;
- current and planned analysis as separate panels;
- named-opponent CMP, fast-move breakpoints, and defensive bulkpoints.

Read the assumptions shown on the page. IV rank measures stat product, not
universal matchup quality. Named-opponent thresholds use the displayed default
opponent build and do not replace full battle simulation.

## Create saved teams

Open **Build saved teams**, then choose **Create team**.

A team requires three different inventory records:

1. Lead
2. Safe Switch
3. Closer

The editor preselects the first three available records. Change them as needed,
use the move-to-position controls to reorder, add a name and notes, and save.

Species clause is checked against the species each selected build represents.
Two inventory records cannot occupy the same team when they resolve to the
same species. A planned record uses its planned target species for this check.

Saved teams hold inventory IDs, not copies of their members. Editing an
inventory record automatically affects future team analysis. Deleting a
referenced inventory record makes the team incomplete until you repair or
remove it.

## Simulate and inspect a saved team

Choose **Simulate** on a complete saved team.

Select:

- the number of current meta targets: Top 5, 10, 20, or 48;
- your shield count;
- the target shield count.

Then choose **Run exact team matrix**.

The result includes:

- exact battle count and measured engine duration;
- coverage, bulk, safety, and consistency scorecards;
- the selected meta scope and data version;
- major threats and core breakers;
- owned and unowned alternatives;
- plain-language per-member win/loss/tie results and battle scores;
- separately labeled target and team fast-move damage;
- links into the inherited PvPoke UI for further inspection.

Larger target scopes perform more synchronous upstream battles and may
temporarily occupy the browser tab. Start with Top 5 or Top 10 for routine
iteration.

Simulation uses the exact selected inventory builds, one shield scenario, and
the current checked-in PvPoke engine. It is decision support, not a guarantee
of battle outcomes.

## Generate anchor-based recommendations

Open **Generate team recommendations**.

At least one valid inventory record is required because every recommendation
starts from an exact owned anchor.

### Choose constraints

- Select one required anchor.
- Optionally enable a second anchor.
- Leave an anchor on **Best-fit role**, or lock it to Lead, Safe Switch, or
  Closer.
- Request one to five result teams.
- Choose ready-now and planned builds together, ready-now only, or planned
  only.
- Optionally include highly ranked Pokémon outside your inventory. These use
  PvPoke’s recommended moves and default Great League IVs.
- Choose the meta-target and shield scope.

### Run and review

Choose **Generate recommendations**.

TeamLab:

1. resolves exact owned anchors and the selected teammate scope;
2. applies species clause and anchor positions;
3. prioritizes ready-now evidence;
4. generates and statically pre-scores a bounded shortlist;
5. simulates exact finalists;
6. selects materially distinct results.

Progress appears between finalists. **Cancel after current finalist** stops
before the next finalist; it cannot interrupt a battle matrix already executing
inside the inherited synchronous engine.

Each selected result explains:

- order and exact movesets;
- build readiness and requirements;
- coverage, bulk, safety, and consistency;
- why the team was selected;
- tradeoffs and major threats;
- owned and unowned alternatives;
- methods and assumptions.

Choose **Save this team** to persist a fully owned result in Saved Teams.
Recommendations are not saved automatically. A result containing a ranked
Pokémon you do not own can still be simulated and opened in PvPoke, but it
cannot be saved until those Pokémon are added to inventory.

If fewer teams satisfy the request, TeamLab reports a shortfall instead of
silently duplicating teams.

## Back up and restore local data

Open **Inventory**, then **Backup and restore**.

### Download a recovery copy

Choose **Download JSON backup**.

The current version-two backup contains:

- every inventory record;
- every saved team;
- schema versions;
- export time and source-data metadata.

TeamLab refuses to export a snapshot that cannot be restored legally. Keep the
download somewhere outside the browser profile.

Download a backup before:

- clearing or resetting data;
- replacing from another backup;
- clearing browser site data;
- changing browsers or local origins;
- making a risky bulk edit.

### Inspect before restoring

Select a TeamLab JSON file. Inspection does not change IndexedDB.

TeamLab reports:

- whether the envelope and record schemas are valid;
- inventory and saved-team counts;
- broken catalog values;
- missing saved-team references;
- species-clause failures;
- every blocking issue it can collect.

Restore controls appear only after successful inspection.

### Merge

**Merge** preserves unrelated local records. Incoming records replace local
records with matching IDs. TeamLab validates the complete final inventory and
team state before writing.

Merge can fail when incoming inventory would make an existing unrelated team
invalid. No partial restore is applied.

### Replace

**Replace** makes the backup authoritative. Local inventory and teams absent
from the file are removed.

Replace requires an explicit confirmation and runs inventory and team changes
in one transaction.

### Legacy inventory-only backups

Version-one backups remain importable, but they contain no saved teams.

Merging a legacy backup preserves unrelated local teams when they remain
valid. Replacing with a legacy backup produces an inventory-only final state
and removes local saved teams. The UI discloses this before confirmation.

## Destructive controls

The backup page’s danger zone provides three distinct operations:

### Clear saved teams

Deletes every saved team while preserving inventory.

### Clear inventory

Deletes every inventory record only when no saved team would be orphaned.
Clear saved teams first if this action is blocked.

### Reset TeamLab

Atomically deletes inventory and saved teams. You must type:

```text
RESET
```

before confirmation is enabled.

Every operation reports exact removal counts. These actions have no undo
inside TeamLab; recovery requires a previously downloaded backup.

## Data versions and refreshes

TeamLab reads the Game Master, Open Great League rankings, and Great League
meta group from the local inherited PvPoke checkout.

The loaded data version appears throughout analysis and simulation results.
Refresh TeamLab after updating the inherited PvPoke data. Saved teams and
inventory remain local, while analysis and simulations use the newly loaded
upstream data.

An upstream change can make an old species, form, move, or team reference
invalid. Repair the affected inventory or team before exporting a new backup.

## Troubleshooting

### The home page says “Connection failed”

Check:

1. the inherited PvPoke Docker container is running;
2. the configured `PVPOKE_DEV_PROXY_TARGET` uses the correct port;
3. `VITE_PVPOKE_BASE_URL` is `/pvpoke/src` for the normal local setup;
4. Vite was restarted after environment changes.

The source must serve Game Master, ranking, group, and classic JavaScript
files—not only the TeamLab frontend.

### Simulation scripts fail to load

Confirm the inherited path is reachable through the same base URL as the JSON
data. TeamRanker needs the checked-in jQuery, Battle, GameMaster, Pokémon, and
TeamRanker classic scripts.

### A CP and IV combination cannot be saved

Confirm:

- CP is between 10 and 1500;
- every IV is between 0 and 15;
- the CP is reachable for that exact species/form and IV spread;
- the selected moves belong to that form.

### A saved team needs attention

One of its inventory records was deleted or no longer resolves in the current
catalog. Open **Repair team** and select a valid inventory member.

### Recommendations return no teams

Check that:

- inventory contains at least three species-distinct analyzable builds;
- the chosen ready/planned scope includes enough records;
- anchors are different records and do not violate species clause;
- anchor position locks leave a legal ordering;
- selected species have current ranking/move evidence.

### Local data appears to be missing

Return to the same browser profile, hostname, and port used previously.
Private-browsing storage, another browser, or another Vite port is a different
IndexedDB store.

If the original browser storage was cleared, TeamLab can recover only from a
downloaded JSON backup.

### A backup is rejected

Read every inspection issue. Do not edit IDs or schema versions manually
unless you understand all cross-record references. Repair the source data and
export a new backup when possible.

## Current MVP boundaries

TeamLab currently supports:

- Open Great League;
- manual inventory entry;
- local browser persistence;
- current and planned owned builds;
- one explicit shield scenario per simulation run;
- current checked-in PvPoke data and classic engine.

The MVP does not include:

- limited cups, Ultra League, or Master League;
- third-party inventory imports;
- accounts, cloud synchronization, or multi-device storage;
- PWA/offline guarantees;
- exact resource-cost calculation;
- recommendation history or persisted analysis caches;
- exhaustive matchup truth or tournament outcome prediction.

## Maintainer validation

Normal validation from `team-lab/`:

```bash
npm test
npm run test:scale
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

Real-Chrome critical workflow coverage:

```bash
npm run test:browser
```

The browser suite is self-contained but requires a Chromium-compatible browser
and the inherited `src/` directory. Set `TEAMLAB_CHROME_PATH` when Chrome is
installed somewhere other than the supported default locations.

## Further reading

- [Project plan](PROJECT-PLAN.md)
- [Implementation records](implementation/README.md)
- [Phase 8 hardening overview](implementation/phase-08-mvp-hardening/README.md)
