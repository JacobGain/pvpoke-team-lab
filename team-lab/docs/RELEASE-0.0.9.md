# 0.0.9 — Season 28 preparation

Twilight Trails is now TeamLab’s active season across Great, Ultra, and Master
League. No preview mode is required.

- Pinned upstream `twilight-trails` at `d4c5b76a76fbd13194b72113d7ecdd495dc805be`.
- Refreshed the Game Master, all three ranking/meta datasets, and the matching
  battle engine, including the new charged/fast attack timing behavior.
- Refreshed artwork mappings and added local Maschiff and Mabosstiff artwork.
- Added active-season identification to the dashboard and release metadata.
- Versioned data and engine URLs to prevent reuse of outgoing-season assets.
- Preserved inventory, teams, and backup schema compatibility.

The source pin follows the target of PvPoke’s “Preview next season” link:
https://pvpoke.com/twilight-trails/rankings/
The official season announcement is:
https://pokemongo.com/news/go-battle-league-twilight-trails

Only TeamLab’s allowlisted runtime assets are imported. The sibling upstream
source tree is unchanged. Normal syncs use the pinned revision rather than the
outgoing-season files in that tree.
