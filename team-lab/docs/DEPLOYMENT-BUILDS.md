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
