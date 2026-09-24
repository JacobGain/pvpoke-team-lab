# 1.1.1 — PvPoke data refresh

TeamLab 1.1.1 updates its pinned PvPoke source and runtime bundle to upstream
commit `9dab4bcc8ce8cf201cca34c7632688674084eb16`, with Game Master data
dated September 23, 2026. The update includes PvPoke's latest cup and
tournament definitions in the full Game Master. TeamLab retains Great, Ultra,
and Master as its three main league choices, with a Mega toggle for each.

The checked-in PvPoke source also gains the new cup datasets and upstream site
fixes. TeamLab's deployed bundle includes the open and Mega rankings and meta
groups used by those formats. Existing inventory, saved teams, and backups
remain compatible.

Owned inventory is shared across leagues. Mega eligible Pokémon can enable a
Mega form; TeamLab derives its CP from the owned Pokémon's IVs and level.
Saved teams remain format specific. The inventory defaults to each build's
best fit league, with filters for other eligible builds and all owned records.

Team simulations now offer Top 100 and Top 250 ranked opponents. Recommendations
default to five teams and can produce ten. Battle controls place advanced IV
and level settings in a collapsible section, and replay starts when simulation
finishes. Dashboard and mobile layout spacing have been adjusted.
