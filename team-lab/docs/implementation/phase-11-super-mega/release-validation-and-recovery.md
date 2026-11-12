# Release validation and recovery

## Scope and current status

Local implementation acceptance passed on November 12, 2026. Remote feature
checks and protected production release are pending at this checkpoint; this
record does not substitute for the final GitHub checks or deployed metadata.
The phase overview tracks completion. Maintenance landed separately in
[PR #104](https://github.com/JacobGain/pvpoke-team-lab/pull/104), with passing
artifact, both CodeQL analyses, deployment, and immutable-origin verification.

## Reproducible local validation

Use a supported Node installation. This machine used Node 24.21.0 and npm 11;
its user npm configuration required `NPM_CONFIG_USERCONFIG=/dev/null`. From
`team-lab/`, each command below ran with that Node directory first in PATH:

```bash
rtk npm ci
rtk npm run audit:security
rtk npm run validate:workflows
rtk npm run lint
rtk npm test
rtk npm run test:scale
rtk npm run validate:data
rtk npm run typecheck
rtk npm run build
rtk npm run build:admin
rtk npm run test:production:artifact
rtk npm run test:visual
rtk npm run test:browser
```

Observed results:

- Zero dependency vulnerabilities after exact scoped minimatch overrides.
- 303 tests in 50 files, including real engine parity and migration failures.
- The 120-record scale characterization passed; full data validation checked
  all 27 manifest files with no diagnostics. Exactly six formats remain exposed.
- Workflow security validated 14 immutable action references. TypeScript and
  ESLint passed with typed and Hooks rule enforcement unchanged.
- Public build passed capability isolation, headers, prerender, and Cloudflare
  static constraints (1,238 files; largest file 1,712,041 bytes). Maintainer build
  separately passed diagnostics-enabled validation and is excluded from deploys.
- Complete public-artifact and development browser workflows passed, including
  Super Mega Top-250 targets, ten recommendations, legacy upgrade, independent
  current/planned settings, CSV/bulk, history backup/restore, replay, and clearing.
- All 21 visual baselines passed. Three release snapshots were updated for
  1.4.0 and four Super Mega snapshots added after visual inspection.

The local public artifact identifies app 1.4.0, database 5, backup 4, inventory
2, saved team 2, diagnostics false, and manifest SHA-256
`d4955c4deacb07c38eabb7e53a1d743564a4fc3f603fe26deebfc70e38e0fdee`.
Its worktree was dirty during local acceptance; only the subsequent clean CI
artifact establishes the release commit identity. The engine/data revision
remains `a9dfd500421cacf2842d54d8adcb15830c1eef2b`.

## Previous artifact and recovery rehearsal

Preserved the actual successful 1.3.2 production artifact from
[run 42760268603](https://github.com/JacobGain/pvpoke-team-lab/actions/runs/42760268603):

- Source: `59d3c7bd4be20c5d3e6e1d61cba629b8a7ff3b1d`.
- Artifact: `team-lab-public-59d3c7bd4be20c5d3e6e1d61cba629b8a7ff3b1d`,
  GitHub artifact ID `13737257478`, archive digest
  `sha256:5aeb912282760e3d240662666b8902917196241062a7b38122935001b8110b03`.
- GitHub expiry: December 10, 2026; Cloudflare deployment history is a separate
  recovery source. The local copy is `/private/tmp/teamlab-1.3.2-recovery-artifact`.

Rehearsed in disposable Chrome on one unchanged local origin, switching the
served artifact while leaving its IndexedDB intact:

1. Serve the preserved 1.3.2 artifact. Seed a native database v40 (Dexie v4)
   with a schema-v1 Mega Sableye record, known CP/IVs, timestamps, and notes.
2. Open inventory and download its full schema-v3 backup before upgrading.
3. Close the SPA by navigating to static manifest JSON, then serve 1.4.0 at the
   same origin. Open inventory, verify migration, edit Mega level to 2 and add
   Night Shade+, save, then export a schema-v4 backup.
4. Close the SPA and serve the exact old artifact again. Opening inventory
   reports: “Stored inventory record … does not match a supported schema.”
   Compare raw IndexedDB before/after: the new fields and entire row are intact.
5. Close the SPA and restore 1.4.0 at that origin. Inventory opens with Mega
   level 2 and Night Shade+ intact; the complete raw row is unchanged.

All assertions passed. Pre-upgrade and post-upgrade exports were parsed and
preserved as `/private/tmp/teamlab-recovery-v3.json` and
`/private/tmp/teamlab-recovery-v4.json`. These contain disposable fixture data.
The mandatory browser suite independently tests full reset/restore including
teams and history; database unit tests verify upgrades from v1–v4, rollback of
inventory failure, and rollback after a later team normalization failure.

## Recovery decision and limitations

Dexie can open a newer native database when indexes match; that does not undo
its migration or make schema-v2 rows readable by 1.3.2. Artifact-only rollback
therefore loses access to the upgraded inventory UI. Prefer a forward fix that
reads database v5, or restore the known 1.4.0 artifact to regain access and export
a verified v4 backup. Never tell users to clear storage to resolve this error.

A deliberate return to 1.3.2 requires preserving the complete post-upgrade v4
backup and using a separately verified pre-upgrade v3 backup in a clean recovery
profile/origin. That old backup cannot contain edits made after upgrading. No
automatic destructive downgrade or v4-to-v3 conversion is provided. Browser
databases are origin-specific; staging cannot prove or alter a person's
canonical-origin inventory.

## Remote release evidence to close

Require fresh feature/release artifact and both CodeQL checks. Verify the exact
immutable staging deployment's commit and schema metadata. Merge tested staging
through a protected PR to master, reuse its single verified artifact, and require
both immutable and canonical production checks. Record final PR/run/deployment
identities in this section before marking the release complete. Do not accept
the shared staging alias alone as proof of the intended artifact.
