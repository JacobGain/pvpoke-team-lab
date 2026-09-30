# TeamLab Local User Guide

TeamLab 1.2.2 treats **Season 28 — Twilight Trails** as the active season for
rankings, recommended moves, meta opponents, and simulations. The dashboard
identifies the active season. Existing inventory and saved teams remain stored;
re-run analyses to evaluate them against the new season. There is no preview
mode or season selector.

## Choosing a league

Use **Active league** in the desktop sidebar or the mobile navigation menu to
switch between Great League (1500 CP), Ultra League (2500 CP), and Master League
(no CP limit). Check **Mega** to use the corresponding Mega league. The selection is remembered on this browser. Switching returns to the dashboard; save any
form edits first.

Rankings, default IVs, build analysis, teams, recommendations, and simulation
opponents follow the selected league. Owned inventory is shared across all
leagues; saved teams remain specific to the selected league. The inventory
defaults to builds best suited to that league. Change **League eligibility** to
show every eligible build or all owned Pokémon. Older records remain available
across leagues whenever their CP is legal.
Master League defaults use 15/15/15 IVs at level 50 (or a lower species level
cap). Planned builds maximize level with the entered IVs. Existing support for
exact Best Buddy builds remains available; default rankings use level 50.
Backups and reset tools cover all formats together; switching leagues does
not remove any records.

## What TeamLab does

TeamLab is a local-first Great, Ultra, and Master League inventory and team-planning
application built on the data and simulation engine in this PvPoke fork.

The MVP lets you:

- record exact Pokémon you own and builds you plan;
- compare IVs, effective stats, roles, moves, named-opponent thresholds, and
  matchup-backed build options;
- save ordered lead, safe-switch, and closer teams;
- run exact teams against the selected league’s meta;
- build recommendations around one or two owned anchors;
- revisit saved recommendation results and compare them against refreshed PvPoke data;
- save selected recommendations as teams;
- back up and restore inventory, saved teams, and recommendation history as JSON.

TeamLab does not require an account. Inventory, saved teams, and
recommendation history remain in the current browser profile.

## Before you start

The local application requires:

- Node.js 22.12 or newer;
- npm 11 or newer;
- a current desktop or mobile browser.

TeamLab ships its validated PvPoke-derived data and classic simulation scripts
inside the application. Docker and a separately running PvPoke server are not
required.

## Start TeamLab locally

From `team-lab/`:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally:

```text
http://localhost:5173
```

The home page’s bundled data card should say **Ready** and **Schema valid**.
If it says **Data unavailable**, reinstall or rebuild from a checkout that
contains `public/vendor/pvpoke/`.

### Keep the same browser origin

Inventory, saved teams, and recommendation history stay in IndexedDB on the current device and browser
profile. TeamLab does not upload them and does not set an automatic expiration.
They remain available until the browser, operating system, or user clears that
site's data, or the inventory is reset in TeamLab. Private browsing and some
mobile storage-pressure policies may remove data sooner, so export backups
regularly.

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
confirm bundled data is ready
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
application. **Backups & reset** is available in the utility menu.

On a phone, the same four primary destinations remain in the bottom navigation.
Choose **More** for Rankings and **Backups & reset**.

Public production builds show the data indicator as status only and do not
contain engine diagnostics. Local development and the protected maintainer
build make the indicator and **Engine diagnostics** destination available.

The Dashboard suggests one next action from your current inventory and team
data. It does
not lock the rest of the application; use global navigation whenever you want
to move to a different workflow.

## Explore the catalog

Open **Rankings** from the desktop navigation or the mobile **More** menu.

The catalog shows normalized released Pokémon with:

- Pokédex and form identity;
- types and Shadow state;
- overall rank in the selected league where published;
- fast and charged moves;
- current-meta membership.

Search accepts a species name or species ID. The meta-only control narrows the
list to the current checked-in league meta group.

The catalog is reference data. Adding a Pokémon to inventory happens through
**Open your inventory**.

## Build your inventory

Open **Open your inventory**, then choose **Add Pokémon**.

For a large roster, choose **Bulk add** instead. Paste one Pokémon name or
PvPoke species ID per line (commas and semicolons also work), review any names
that could not be matched, and add the recognized entries together. While
typing, autocomplete suggestions show the friendly form name and PvPoke ID;
for example, `zacian`, `zacian hero`, or `zacian_hero` suggests
**Zacian (Hero)**. Choosing a suggestion completes only the entry around the
cursor. Arrow-key navigation keeps the active option visible inside the list,
and selection returns focus to the input so another entry can be added without
reopening the keyboard. Bulk-added
records use PvPoke's default rank-one IV spread, calculated CP, and recommended
moves for the selected league. Edit individual records afterward when exact
build details matter. Repeated names intentionally create repeated records.

### Current Pokémon

Search and select the exact species, form, and Shadow state in the combined
autocomplete field. Then record:

- current CP;
- actual IVs or the explicit PvPoke rank-one assumption;
- current fast move;
- one or two current charged moves;
- favorite status;
- an optional Mega form for species that can Mega evolve;
- optional notes.

TeamLab infers level from species, CP, and IVs. A CP/IV combination must map to
a legal supported level before the record can be saved.
In a Mega league, a Mega enabled current build uses the same IVs, moves, and
level with the Mega form's stats. TeamLab calculates its Mega CP and offers it
only in leagues whose cap it fits. The normal build remains available in open
leagues. The default inventory filter places a normal build in its lowest CP
league and its Mega form in the next eligible league; choose **Eligible** to
see the same build in other leagues it can enter.

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

### Compare build options in matchups

On the analysis page, use **Matchup-backed build planning** to compare a
current or planned baseline with temporary build candidates.

1. Choose whether the baseline uses the current or planned build. If its CP
   maps to multiple levels, select the level to simulate.
2. Select up to three ranked threats from the active league. Each uses PvPoke's
   published default league IVs and recommended moves; the result displays
   those exact builds.
3. Add up to three candidates. A candidate can change IVs, moves, or both.
   IV choices include the stat-product rank-one, highest-Attack,
   highest-Defense, and a custom spread. Moves can stay as entered, use
   PvPoke's recommendation, or be chosen from the species' legal movepool.
4. Choose the shield count for each side and run the comparison.

Retaining the source IVs preserves that build's CP and selected level. An
alternate IV spread represents a different specimen and is fitted to the
highest legal level under the active league's CP cap, up to level 50. It never
changes the owned Pokémon. The candidates and results are temporary and are
not saved.

Results show each build's win/loss/tie, battle rating, and remaining HP,
energy, and shields. Candidate ratings are compared with the baseline for the
same threat and shield scenario. Change the shield pair and run again to
inspect another scenario; TeamLab does not average these matchups into a team
score. These are one-on-one simulations and do not model starting energy,
switching, or a full three-Pokémon battle. The data version and engine
assumptions are available below the results.

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

- the number of ranked targets: Top 5, 10, 20, 48, 100, or 250;
- your shield count;
- the target shield count.

Then choose **Run exact team matrix**.

The result includes:

- exact battle count and measured engine duration;
- coverage, bulk, safety, and consistency scorecards;
- the selected meta scope and data version;
- major threats and core breakers;
- owned and unowned published-counter alternatives;
- plain-language per-member win/loss/tie results and battle scores;
- separately labeled target and team fast-move damage.

Coverage uses the exact simulated target ratings across the selected scope.
Each target is weighted by `1 / √rank`, using its overall rank in the current
league. This gives higher-ranked Pokémon more influence while keeping
lower-ranked targets in the calculation:

```text
weighted target rating = Σ(target rating × 1 / √rank) / Σ(1 / √rank)
Coverage value = 1200 - weighted target rating
```

The value is scored against TeamLab's 680-point reference goal. The displayed
answered-target and positive-matchup counts are raw counts and are not
rank-weighted. Changing the selected Top-N scope changes which targets
contribute; lower-ranked targets contribute less to the score.

### Compare a one-slot change

Below the scorecard, use **What if you change one slot?** to choose Lead, Safe
switch, or Closer and replace it with another eligible owned build. **Compare
exact swap** runs the replacement against the same target list and shield
settings as the current report. Review the before-and-after scorecard, gained
or lost raw answer counts, rank-weighted Coverage score, and changed threat
matchups before keeping the result.

The preview leaves your saved team unchanged. Choose **Update saved team** and
confirm to replace its members, or choose **Save as a separate team** and name
the copy. Candidates must be eligible for the selected league and satisfy the
team species clause. The published-counter alternatives above remain
recommendations; the what-if comparison is the exact resimulation.

Larger target scopes perform more synchronous upstream battles and may
temporarily occupy the browser tab. Start with Top 5 or Top 10 for routine
iteration.

Simulation uses the exact selected inventory builds, one shield scenario, and
the current checked-in PvPoke engine. It is decision support, not a guarantee
of battle outcomes.

## Generate anchor-based recommendations

Open **Generate team recommendations**.

At least one valid inventory record is required to open recommendations. Full
inventory generation needs at least three eligible owned species.

### Choose constraints

- Select **Build from my full inventory** to consider every eligible owned
  build for all three positions. This mode only uses Pokémon in your inventory
  and may take longer with a large collection.
- Or select one required anchor.
- Optionally enable a second anchor.
- Leave an anchor on **Best-fit role**, or lock it to Lead, Safe Switch, or
  Closer.
- Request one to five or ten result teams (five by default).
- Choose ready-now and planned builds together, ready-now only, or planned
  only.
- With an anchor, optionally include highly ranked Pokémon outside your inventory. These use
  PvPoke’s recommended moves and default IVs for the selected league.
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
- build readiness, changes needed to reach a planned build, and suggested
  changes to match published movesets;
- coverage, bulk, safety, and consistency;
- why the team was selected;
- tradeoffs and major threats;
- owned and unowned alternatives;
- methods and assumptions.

Choose **Save this team** to persist a fully owned result in Saved Teams.
Whenever a run produces at least one result, TeamLab automatically stores a
compact history record on this device. The record keeps the anchors, all run
settings, result scorecards and threats, the recommendation formula versions,
and the PvPoke data version. Open **Recommendation history** below the
recommendation controls to revisit a result after changing routes or reloading
the browser. History is local to this browser profile; download a TeamLab backup
to move it or keep a recovery copy. Delete a run or clear all history from that
page when it is no longer needed.

A saved history run can be **Re-run and compared** using the current data for
its league. TeamLab reuses the saved anchors and settings, saves the refreshed
run as a new history item, and compares the selected teams by their three
Pokémon species. A missing anchor or changed inventory can prevent a comparison
or change the available results. When recommendation formulas have changed,
the comparison calls that out because score movement then reflects both data
and formula updates.

A result containing a ranked
Pokémon you do not own can still be simulated in TeamLab, but it cannot be
saved until those Pokémon are added to inventory.

If fewer teams satisfy the request, TeamLab reports a shortfall instead of
silently duplicating teams.

## Back up and restore local data

Open **Inventory**, then **Backup and restore**.

### Download a recovery copy

Choose **Download JSON backup**.

The current version-three backup contains:

- every inventory record;
- every saved team;
- recommendation history and its archived result snapshots;
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
- inventory, saved-team, and recommendation-history counts;
- broken catalog values;
- missing saved-team references;
- species-clause failures;
- every blocking issue it can collect.

Restore controls appear only after successful inspection.

### Merge

**Merge** preserves unrelated local records. Incoming inventory, team, and
history records replace matching IDs. TeamLab validates the complete final
inventory and team state, plus every archived history record, before writing.

Merge can fail when incoming inventory would make an existing unrelated team
invalid. No partial restore is applied.

### Replace

**Replace** makes the backup authoritative. Local inventory, teams, and
recommendation history absent from the file are removed.

Replace requires an explicit confirmation and runs all collection changes in
one transaction.

### Legacy inventory-only backups

Version-one backups remain importable, but they contain no saved teams or
recommendation history. Version-two backups contain inventory and saved teams
without recommendation history.

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

Atomically deletes inventory, saved teams, and recommendation history. You
must type:

```text
RESET
```

before confirmation is enabled.

Every operation reports exact removal counts. These actions have no undo
inside TeamLab; recovery requires a previously downloaded backup.

Use **Recommendation history** to delete one archived run or clear history
without changing inventory and saved teams. Clearing inventory leaves history
available because each record contains its own saved result snapshot.

## Data versions and refreshes

TeamLab reads the Game Master, open and Mega league rankings and meta
groups, and simulation scripts from its checked-in
`public/vendor/pvpoke/` directory.

The loaded data version appears throughout analysis and simulation results.
Maintainers can refresh that bundle with `npm run sync:pvpoke` after updating
an upstream checkout. Saved teams and inventory remain local, while new builds
use the refreshed data. See [PvPoke asset maintenance](PVPOKE-DATA.md).

An upstream change can make an old species, form, move, or team reference
invalid. Repair the affected inventory or team before exporting a new backup.

## Troubleshooting

### The home page says “Data unavailable”

Check:

1. `public/vendor/pvpoke/manifest.json` exists;
2. the Game Master, ranking, and group files listed in the manifest exist;
3. `npm run validate:data` succeeds;
4. Vite was restarted after a data sync.

### Simulation scripts fail to load

Run `npm run sync:pvpoke` and confirm the engine files listed in
`public/vendor/pvpoke/manifest.json` are present. TeamRanker needs the bundled
jQuery, Battle, GameMaster, Pokémon, and TeamRanker classic scripts.

### A CP and IV combination cannot be saved

Confirm:

- CP is between 10 and the selected league’s cap (1500 or 2500); Master League has no CP limit;
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

- Open Great League (1500 CP), Open Ultra League (2500 CP), and Open Master League (no CP limit);
- manual inventory entry;
- local browser persistence;
- current and planned owned builds;
- one explicit shield scenario per simulation run;
- current checked-in PvPoke data and classic engine.

The MVP does not include:

- limited cups;
- third-party inventory imports;
- accounts, cloud synchronization, or multi-device storage;
- PWA/offline guarantees;
- exact resource-cost calculation;
- persisted analysis caches;
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

The browser suite is self-contained and requires only a Chromium-compatible
browser. Set `TEAMLAB_CHROME_PATH` when Chrome is installed somewhere other
than the supported default locations.

## Further reading

- [Project plan](PROJECT-PLAN.md)
- [PvPoke asset maintenance](PVPOKE-DATA.md)
- [Implementation records](implementation/README.md)
- [Phase 8 hardening overview](implementation/phase-08-mvp-hardening/README.md)
