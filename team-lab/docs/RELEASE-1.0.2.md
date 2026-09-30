# Release v1.0.2

## Current PvPoke data
- Refreshed the pinned PvPoke data bundle with current Great, Ultra, and Master rankings, meta groups, Pokémon stats, and move updates.
- Kept the data sync gate strict about gameplay differences while ignoring whitespace-only format changes.

## Faster roster setup
- Added bulk inventory entry for up to 500 Pokémon names or PvPoke IDs at a time, with preview and one atomic save.
- Added league-default IVs, calculated CP, and recommended moves to bulk-created records.
- Improved autocomplete for friendly names and normalized PvPoke IDs, with keyboard and touch support.

## Mobile and production polish
- Kept inventory and team form actions in document flow so they remain usable with the mobile keyboard open.
- Clarified local browser storage and backup expectations.
- Added validated PNG favicons and published security disclosure metadata at both supported paths.
