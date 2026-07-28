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

1. reject mutable Action references and privileged untrusted-code triggers;
2. install `package-lock.json` exactly with `npm ci`;
3. reject high-severity advisories across runtime and build dependencies;
4. run lint, typechecking, and the deterministic unit suite;
5. run the MVP scale characterization alone, using the median of three
   cache-cold recommendation samples;
6. validate the bundled PvPoke data;
7. build only the public `dist/`;
8. run the real-Chrome workflow against that exact artifact;
9. fail if `dist-admin/` exists;
10. upload `dist/` as `team-lab-public-<commit SHA>`;
11. on `master`, make those same files available to the Cloudflare deployment
   job.

Every external Action is pinned to a full commit SHA with its release line
recorded as a comment. `validate:workflows` makes immutable references a release
invariant, while Dependabot checks both GitHub Actions and the npm lockfile
weekly for maintainable updates.

### Repository release protections

`.github/rulesets/master-protection.json` is the auditable source for the active
`master` ruleset. It prevents deletion and force-push, requires changes through
a pull request with resolved review threads, and requires the up-to-date
**Verify public artifact** and **Analyze TeamLab (javascript-typescript)**
checks before merge. `validate:workflows` also rejects a local ruleset that
drops either check, weakens strictness, or adds a bypass actor.

The `cloudflare-pages` GitHub environment accepts only protected branches, so
the deployment job cannot be reused from an unprotected ref. GitHub secret
scanning and push protection cover repository history and new pushes;
Dependabot security updates provide dependency analysis. The advanced CodeQL
workflow scans only `team-lab/`, the application that is built and deployed.
It intentionally excludes the preserved upstream PvPoke tree at the repository
root, keeping upstream source untouched and preventing unrelated legacy
findings from obscuring TeamLab release findings. Repository Actions retain
read-only default permissions, with `security-events: write` granted only to
CodeQL and `deployments: write` granted only to the deployment job.

For the one-time transition from GitHub's repository-wide default setup, first
push the branch that contains `.github/workflows/team-lab-codeql.yml`. Then use
**Settings → Advanced Security → CodeQL analysis → Switch to advanced** to
disable default setup before opening the release pull request to `master`.
Default setup blocks advanced-analysis uploads, while the required
**Analyze TeamLab (javascript-typescript)** check prevents the release from
merging until the scoped replacement succeeds.

Artifacts are retained for 30 days. GitHub records a SHA-256 artifact digest,
and the job exposes the generic artifact ID, URL, and digest as outputs.

### Cloudflare Pages deployment

Successful pushes to `master` deploy the Pages artifact produced by
**Verify public artifact**. The deployment job checks out only the repository
configuration; it does not install application dependencies, rebuild TeamLab,
or invoke a Cloudflare build. It downloads the named GitHub artifact and sends
those exact files through pinned Wrangler. This keeps the tested bytes
identical to the deployed bytes and prevents the hosting layer from selecting
the admin target.

The verified build uses `VITE_BASE_PATH=/` for the `pages.dev` site. Production
`dist/` intentionally has no top-level `404.html`, allowing Cloudflare Pages to
apply its native SPA fallback and return HTTP 200 on direct application routes.
The deployment:

- uses the workflow-owned `cloudflare-pages` GitHub environment as its only
  GitHub deployment record;
- requires scoped `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` repository
  secrets;
- publishes only after the complete public release gate succeeds;
- preserves `release.json` at the application base;
- requires the browser security and alias-indexing policy in `_headers`;
- rejects a provider-specific `404.html`, any `_worker.js`, and `dist-admin/`;
- reports the unique deployed URL without generating a second build;
- runs the reusable deployed-origin browser workflow against the exact commit.

Wrangler does not receive its optional `gitHubToken`; enabling that integration
would duplicate the workflow environment's deployment record under GitHub's
default `production` environment. The environment URL is the unique immutable
Cloudflare URL for traceability, while the custom domain continues to serve the
current production deployment.

Pull requests and manual release-gate runs verify artifacts but never deploy.
The application remains static-only and configures no Functions, Workers, D1,
KV, R2, authentication, or server-side persistence. See
[Cloudflare Pages deployment](CLOUDFLARE-DEPLOYMENT.md) for account bootstrap,
credential setup, local emulation, and production-host details. GitHub Pages is
not a supported deployment target; GitHub remains the source, CI, artifact, and
release-orchestration platform for the Cloudflare deployment.

## Post-deployment verification

Wait for the expected immutable artifact and then run the real browser suite
against it after the hosting layer publishes the verified files:

```bash
npm run wait:deployment -- \
  --origin=https://pvpoke-team-lab.pages.dev/ \
  --expected-commit=<commit SHA>

TEAMLAB_EXPECTED_COMMIT_SHA=<commit SHA> \
  npm run test:deployment -- \
    --origin=https://pvpoke-team-lab.pages.dev/
```

The URL must be the HTTP or HTTPS application base without credentials, query
parameters, or a fragment. A path is supported for static project sites. HTTP
is supported for local infrastructure testing; the GitHub workflow requires
HTTPS.

`wait:deployment` polls cache-busted `release.json`, root HTML, and every
same-origin script or stylesheet referenced by that HTML. It succeeds only when
the public, diagnostics-disabled release identifies the expected commit and all
entry assets return non-empty responses.

Deployment browser mode does not build or start TeamLab locally. It opens the
supplied origin in a temporary Chrome profile and verifies:

- `release.json` identifies a public, diagnostics-disabled artifact;
- the deployed source commit matches `TEAMLAB_EXPECTED_COMMIT_SHA` when set;
- diagnostics navigation is absent and its direct route renders TeamLab's 404;
- bundled PvPoke data reaches the ready state;
- inventory, teams, simulations, recommendations, backup/reset/restore, SPA
  route fallback, and responsive routes work through the deployed hosting
  layer.

The temporary browser profile is deleted after the check, so the fixture data
does not enter an existing user profile.

Only the first navigation to a deployed origin receives bounded retries. A
failed attempt clears Chrome's cache and backs off before trying again. All
subsequent route and workflow assertions remain strict and single-attempt.
Terminal navigation errors include a document snapshot plus recent HTTP,
network, runtime, browser-log, and console failures.

### GitHub workflow

`.github/workflows/team-lab-deployment-check.yml` provides:

- a manual **Team Lab deployment check** action with `origin` and optional
  `expected_commit` inputs;
- a reusable workflow for the final job in a provider-specific deployment
  pipeline;
- an immutable-artifact readiness boundary before Chrome starts;
- a stable **Verify deployed origin** status name.

The release workflow calls it after Cloudflare Pages deployment:

```yaml
verify-deployment:
  needs: deploy-cloudflare
  uses: ./.github/workflows/team-lab-deployment-check.yml
  with:
    origin: ${{ needs.deploy-cloudflare.outputs.origin }}
    expected_commit: ${{ github.sha }}
```

The reusable form requires an explicit expected commit. This prevents a
successful check against a healthy but stale deployment. The release workflow
passes Wrangler's immutable deployment URL so the check proves the exact files
that were just uploaded instead of relying on an alias or custom-domain DNS.

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
