# Release v1.2.1

## Recommendation history
- Automatically saved recommendation runs that produced results, including anchors, search settings, selected teams, scorecards, threats, formula versions, and PvPoke data version.
- Added a responsive history page to revisit results after navigation or a browser reload, remove individual runs, or clear the history.
- Added a rerun-and-compare action that repeats a saved scope with current league data and compares scores for matching Pokémon trios.
- Archived only the result evidence needed to review a run; full battle matrices remain temporary.

## Data protection and versioning
- Added recommendation history to TeamLab JSON backups and atomic merge/replace restore.
- Included history in the reset-all data action.
- Bumped the IndexedDB schema to version 4 and backup format to version 3 while retaining support for older backups.
