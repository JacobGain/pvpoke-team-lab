# 1.0.2 — Faster roster setup and current PvPoke data

TeamLab 1.0.2 refreshes its pinned PvPoke bundle to upstream commit
`a93147bf1f2e829758958bfb5b37e56bbadc9678`, including the September 9, 2026
Game Master, current Great/Ultra/Master rankings, meta groups, Pokémon stats,
and move updates. The sync gate continues to reject gameplay-data divergence
between PvPoke's full and minified Game Masters while tolerating whitespace-only
differences in human-readable format rules.

Inventory now includes a bulk-add flow for up to 500 names or PvPoke IDs per
batch. Recognized entries preview before one atomic save and use the selected
league's PvPoke default IV spread, calculated CP, and recommended moves. Any
unmatched or ambiguous entries stay visible for correction, and repeated names
create separate inventory records.

On narrow mobile viewports, inventory and team form actions now remain in normal
document flow. This prevents the on-screen keyboard and autocomplete suggestions
from fighting a viewport-anchored action bar. Inventory copy also explains that
records stay only in the current browser's IndexedDB, have no app-defined expiry,
and can disappear when site data is cleared.

The public artifact now ships 48×48 and 96×96 PNG favicons plus an ICO fallback,
all derived from the existing TeamLab mark. Build validation checks their
presence, formats, and dimensions. RFC 9116 disclosure metadata is available at
both the canonical `/.well-known/security.txt` path and `/security.txt`, with
Cloudflare Pages content-type and cache rules for both locations.
