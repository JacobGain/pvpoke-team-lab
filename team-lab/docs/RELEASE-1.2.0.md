# Release v1.2.0

## What-if team changes
- Replaced one saved-team position with an eligible owned build and compared the exact result against the same targets and shield settings.
- Showed before-and-after scorecards, raw matchup changes, and changed threat evidence without altering the saved team during preview.
- Added explicit options to update the saved team or save the tested lineup as a separate team.

## Team recommendation changes
- Weighted Coverage target ratings by inverse square root of each Pokémon's overall meta rank, giving higher-ranked opponents more influence while retaining lower-ranked targets.
- Kept answered-target and favorable-matchup counts as raw, unweighted totals.
- Displayed suggested changes to match each owned Pokémon's published recommended moveset separately from changes needed to reach the selected build.
- Distinguished charged-move replacements from unlocking a second move slot and avoided Elite TM notices for moves already owned.

## League support and maintenance
- Continued support for Open Great, Ultra, and Master League, including their Mega formats.
- Updated Wrangler and its dependencies and patched vulnerable locked packages used by the build and audit workflows.
