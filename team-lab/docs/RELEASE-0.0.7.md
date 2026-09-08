# 0.0.7 — Ultra League

- Added a persistent league selector for desktop and mobile.
- Bundled Open Ultra League rankings and meta alongside Great League.
- Applied the 2500 CP cap, Ultra League default IVs, and league-specific IV ranking to owned and planned builds.
- Scoped inventory, teams, and recommendations to the selected league.
- Passed the selected CP cap to exact PvPoke team simulations and used its 35,000 Ultra League bulk goal.
- Preserved legacy Great League records and included both leagues in full backups and reset counts.

The record and backup schema versions remain compatible with existing backups;
missing inventory format IDs continue to mean Great League.

Validation covers 94 unit tests, the 120-record scale characterization,
TypeScript, ESLint, bundle hashes and catalogs, workflow security, the public
build, and development/production browser workflows. Browser coverage creates
an Ultra League roster and team, runs the real engine matrix, verifies the
35,000 bulk goal, and switches back to the preserved Great League inventory.
Desktop and mobile visual baselines were reviewed and refreshed for the selector
and current bundled data.
