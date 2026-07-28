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

`.github/workflows/team-lab-release.yml` runs on every pull request, push, and
manual dispatch. Its stable required-check name is **Verify public artifact**.
Configure the protected release branch or repository ruleset to require that
check before merging or deploying.

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
8. upload `dist/` as `team-lab-public-<commit SHA>`.

Artifacts are retained for 30 days. GitHub records a SHA-256 artifact digest,
and the job exposes the artifact ID, URL, and digest as outputs for a future
provider-specific deployment job.

### Deployment handoff contract

A hosting integration must consume the artifact produced by a successful
**Verify public artifact** job. It must not check out the source and rebuild
TeamLab independently. This keeps the tested bytes identical to the deployed
bytes and prevents a hosting provider from accidentally selecting the admin
target.

The hosting adapter remains intentionally separate from the release gate. Once
a provider is selected, add a dependent deployment job that:

- downloads `team-lab-public-<commit SHA>` from the successful workflow run;
- deploys those files as a static single-page application;
- maps unknown application routes to `index.html`;
- preserves `release.json` at the origin root;
- reports the deployed origin and artifact digest without generating a second
  build.

## Post-deployment verification

Run the real browser suite against an HTTPS deployment after the hosting layer
publishes the verified artifact:

```bash
TEAMLAB_EXPECTED_COMMIT_SHA=<commit SHA> \
  npm run test:deployment -- --origin=https://teamlab.example
```

The origin must be the HTTP or HTTPS origin root without credentials, a path,
query parameters, or a fragment. HTTP is supported for local infrastructure
testing; the GitHub workflow requires HTTPS.

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

A hosting workflow can call it after deployment:

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
