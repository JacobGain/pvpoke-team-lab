# 0.0.8 — Master League

- Added Open Master League to the persistent desktop and mobile selector.
- Bundled Master League rankings and meta opponents.
- Matched PvPoke defaults: 15/15/15 IVs at the species level cap, up to level 50.
- Added uncapped builds, IV analysis, saved teams, recommendations, and exact simulations with Master League’s 35,000 bulk goal.
- Preserved Great and Ultra League inventory and included all three leagues in portable backups.

PvPoke uses 10000 internally to identify Master League. The selector displays
“No CP limit”; valid entered builds are still checked against species stats,
IVs, and supported levels. Existing record and backup schema versions remain
compatible; inventory without a format ID continues to mean Great League.
