# Release v1.4.0

## Complete Mega builds
- Choose Mega levels 1–4 and an optional extra charged attack from the form’s separate move pool, alongside one or two ordinary charged moves.
- Keep independent current and planned settings in inventory, CSV imports, bulk entry, and build comparisons. Mega level 4 supports effective battle levels up to 52 without counting its bonus levels as purchased power-ups.
- Carry the full build through saved-team simulations, recommendations, history, and turn-by-turn battle replay. Default meta opponents retain their published extra attack when one is specified.
- Verify battle results against the pinned PvPoke engine, including damage bonuses, exact move slots, replay, and team matrices. Published ranking positions can still differ from custom simulations because their inputs and scoring differ.

## Safe upgrades and backups
- Upgrade existing inventory and saved-team records while preserving entered CP, IVs, moves, timestamps, and references. Older builds do not gain an extra attack automatically.
- Apply the two-level bonus when projecting an owned base Pokémon at Mega level 4. Its evolved CP and league eligibility may change; review and rerun existing Mega teams after upgrading.
- Export full-data backup version 4 and continue importing versions 1–3. New backups retain Mega settings and recommendation snapshots; older TeamLab versions cannot restore the new format.
- Track exact saved-team build inputs so changed Mega settings require fresh analysis even when an import preserves timestamps. Existing analyzed teams should be rerun after upgrading.
- Include Mega capability and extra-attack changes in roster update review. The six existing open/Mega formats remain supported; limited cups such as LAIC remain separate future work.

## Maintenance
- Resolve the ten moderate ESLint/minimatch dependency findings with a scoped, compatibility-tested tooling update. The updated lockfile reports no vulnerabilities, without downgrading the lint stack or weakening audit checks.
- Add a reproducible characterization of the existing upstream Minior form-level calculation concern. That known upstream behavior remains documented; the bundled battle-engine files are unchanged.
