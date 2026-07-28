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

## Automated release gate

`.github/workflows/team-lab-release.yml` runs on every pull request, every push
to `master`, and manual dispatch. Feature-branch pushes are covered by their
pull-request event instead of starting a duplicate push run. Its stable
required-check name is **Verify public artifact**. Configure the protected
release branch or repository ruleset to require that check before merging or
deploying.

The job uses a read-only GitHub token and performs this sequence from a fresh
checkout:

1. install `package-lock.json` exactly with `npm ci`;
2. run lint, typechecking, and the deterministic unit suite;
3. run the MVP scale characterization alone, using the median of three
   cache-cold recommendation samples;
4. validate the bundled PvPoke data;
5. build only the public `dist/`;
6. run the real-Chrome workflow against that exact artifact;
7. fail if `dist-admin/` exists;
8. upload `dist/` as `team-lab-public-<commit SHA>`;
9. on `master`, package those same files as the GitHub Pages artifact.

Artifacts are retained for 30 days. GitHub records a SHA-256 artifact digest,
and the job exposes the generic artifact ID, URL, and digest as outputs.

### GitHub Pages deployment

Successful pushes to `master` deploy the Pages artifact produced by
**Verify public artifact**. The deployment job does not check out source,
install dependencies, or rebuild TeamLab. This keeps the tested bytes identical
to the deployed bytes and prevents the hosting layer from selecting the admin
target.

The verified build uses `VITE_BASE_PATH=/pvpoke-team-lab/` for the repository
site. `dist/404.html` is an exact copy of `dist/index.html`, allowing GitHub
Pages to bootstrap React Router on direct application routes. The deployment:

- uses the standard `github-pages` protected environment;
- requires only `pages: write` and `id-token: write` in the deployment job;
- publishes only after the complete public release gate succeeds;
- preserves `release.json` at the application base;
- reports the deployed URL without generating a second build;
- runs the reusable deployed-origin browser workflow against the exact commit.

Pull requests and manual release-gate runs verify artifacts but never deploy.
Changing hosting providers later requires replacing only the two deployment
jobs and `VITE_BASE_PATH`; the public build and artifact contract remain
provider-neutral.

## Post-deployment verification

Run the real browser suite against an HTTPS deployment after the hosting layer
publishes the verified artifact:

```bash
TEAMLAB_EXPECTED_COMMIT_SHA=<commit SHA> \
  npm run test:deployment -- \
    --origin=https://jacobgain.github.io/pvpoke-team-lab/
```

The URL must be the HTTP or HTTPS application base without credentials, query
parameters, or a fragment. A path is supported for static project sites. HTTP
is supported for local infrastructure testing; the GitHub workflow requires
HTTPS.

Deployment mode does not build or start TeamLab locally. It opens the supplied
origin in a temporary Chrome profile and verifies:

- `release.json` identifies a public, diagnostics-disabled artifact;
- the deployed source commit matches `TEAMLAB_EXPECTED_COMMIT_SHA` when set;
- diagnostics navigation is absent and its direct route renders TeamLab's 404;
- bundled PvPoke data reaches the ready state;
- inventory, teams, simulations, recommendations, backup/reset/restore, SPA
  route fallback, and responsive routes work through the deployed hosting
  layer.

The temporary browser profile is deleted after the check, so the fixture data
does not enter an existing user profile.

### GitHub workflow

`.github/workflows/team-lab-deployment-check.yml` provides:

- a manual **Team Lab deployment check** action with `origin` and optional
  `expected_commit` inputs;
- a reusable workflow for the final job in a provider-specific deployment
  pipeline;
- a stable **Verify deployed origin** status name.

The release workflow calls it after GitHub Pages deployment:

```yaml
verify-deployment:
  needs: deploy
  uses: ./.github/workflows/team-lab-deployment-check.yml
  with:
    origin: ${{ needs.deploy.outputs.origin }}
    expected_commit: ${{ github.sha }}
```

The reusable form requires an explicit expected commit. This prevents a
successful check against a healthy but stale deployment.

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
