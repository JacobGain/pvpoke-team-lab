# Deployment Build Targets

TeamLab has separate public and maintainer build targets. Engine diagnostics
are a build capability, not a runtime menu preference.

## Public production build

```bash
npm run build
```

Output: `dist/`

This target compiles diagnostics out of:

- the router, so `/diagnostics/simulation` resolves to the ordinary 404 page;
- desktop and mobile navigation;
- the data-health indicator link;
- emitted JavaScript chunks.

The build finishes by scanning the emitted JavaScript and fails if diagnostic
page signatures remain. Backup, restore, inventory clearing, saved-team
clearing, and full reset remain available under **Backups & reset**.

Run the real-Chrome workflow against the exact production artifact with:

```bash
npm run test:production
```

This builds `dist/`, serves it through Vite’s production preview server, and
exercises direct-route SPA fallback, release metadata, the diagnostics 404,
inventory, teams, backup/restore, simulations, and recommendations. When CI
already has the artifact, `npm run test:production:artifact` tests the existing
`dist/` without rebuilding it.

## Maintainer diagnostics build

```bash
npm run build:admin
npm run preview:admin
```

Output: `dist-admin/`

This target includes engine characterization and TeamRanker diagnostics.
Development mode (`npm run dev`) also enables them for browser workflow tests.

The admin build is not an authorization mechanism. Do not deploy it to a
public origin unless the hosting layer enforces authentication and access
control. Use the standard `dist/` artifact for public releases.

## Configuration

`.env.admin` enables `VITE_ENABLE_DIAGNOSTICS` for the explicit admin mode.
Normal production configuration leaves it false. `vite.config.ts` converts
the setting into a compile-time constant so bundling can remove the disabled
code path completely.

`VITE_BASE_PATH` works identically for both targets.

## Release identity

Every build emits `release.json` at the artifact root. It records:

- a stable release ID derived from app version, build target, source commit,
  and PvPoke manifest hash;
- build timestamp and public/admin target;
- source commit and dirty-worktree state when Git metadata is available;
- enabled diagnostics capability;
- database, backup, inventory-record, and saved-team schema versions;
- PvPoke data version and complete manifest SHA-256.

CI systems without a `.git` directory can supply `TEAMLAB_COMMIT_SHA`.
Common provider variables such as `GITHUB_SHA`, `CF_PAGES_COMMIT_SHA`, and
`VERCEL_GIT_COMMIT_SHA` are also recognized.

The build capability validator rejects missing, malformed, or target-mismatched
metadata before an artifact is considered deployable.
