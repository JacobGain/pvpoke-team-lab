# Cloudflare Pages deployment

TeamLab 0.0.5 uses a hardened static-only Cloudflare Pages deployment. The
application does not use Pages Functions, Workers, D1, KV, R2, authentication,
or any other metered server-side service. PvPoke data and simulation code ship
inside the public artifact, while inventory and teams remain in browser
IndexedDB.

## One-time account setup

Create a free Cloudflare account, then create a **Direct Upload** Pages project.
Do not connect Cloudflare's Git integration: GitHub Actions already builds and
tests the release, and Direct Upload lets it deploy those exact bytes without a
second build.

From `team-lab/`, authenticate Wrangler and create the project:

```bash
npx wrangler login
npx wrangler pages project create pvpoke-team-lab --production-branch=master
```

The project name must match `wrangler.jsonc` and
`.github/workflows/team-lab-release.yml`. If the name is unavailable, change it
in both files before creating the project.

In the Cloudflare dashboard:

1. Open **My Profile → API Tokens → Create Token → Custom token**.
2. Grant **Account → Cloudflare Pages → Edit** for only the TeamLab account.
3. Copy the token when it is shown and find the account ID in the account
   overview.

Add both values as GitHub Actions repository secrets. These commands prompt for
the values without putting them in shell history:

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_API_TOKEN
```

Production uses the `cloudflare-pages` GitHub environment, while staging uses
`cloudflare-pages-staging`. Add required reviewers to the production environment
later if deployment approvals are wanted. Both environments use the same
repository secrets and Cloudflare Pages project. No additional domain, billing
method, Pages Function, or storage binding is required.

The workflow-owned environment is the only GitHub deployment record for a
release. Wrangler intentionally receives no `gitHubToken`: that optional input
would register the same Cloudflare upload a second time under GitHub's default
`production` environment. The `cloudflare-pages` environment URL remains
Wrangler's unique immutable deployment URL rather than the custom domain so
each GitHub deployment identifies the exact uploaded artifact.

## Release pipeline

PRs targeting `staging` or `master` run the complete **Verify public artifact**
gate and both CodeQL analyses. A same-repository PR targeting `staging` deploys
on `opened`, `synchronize`, `reopened`, and `ready_for_review`. Fork and Dependabot
PRs validate without deploying because they do not receive deployment secrets.
PRs targeting `master` validate without deploying. A merge into protected
`master` produces the push that deploys production; the active master ruleset
requires a PR and passing checks, with no bypass actors. Manual runs validate
without deploying. Staging pushes do not repeat the PR's build and checks.

Each deployment:

1. builds the public root-hosted `dist/` exactly once;
2. validates diagnostics are absent and Cloudflare static limits are met;
3. browser-tests that exact artifact;
4. uploads it as `team-lab-public-<commit SHA>`;
5. downloads the verified artifact in the deployment job;
6. deploys it to the matching `pvpoke-team-lab` Pages branch with pinned
   Wrangler (matching the project dependency);
7. polls the returned immutable HTTPS URL until its public release metadata
   identifies the expected commit and every entry asset is available;
8. browser-tests that exact URL, with bounded retries for only the initial
   remote navigation.

The deployment job rejects `404.html`, `_worker.js`, and `dist-admin/`. Without
a top-level `404.html`, Cloudflare Pages applies its native SPA fallback, so
direct routes such as `/catalog` return HTTP 200. The verified artifact remains
available in GitHub Actions for 30 days and Cloudflare keeps deployment history
for rollback.

The public artifact also contains a required `_headers` policy. It restricts
scripts, network requests, frames, browser capabilities, and cross-origin
resource use; enables HSTS and MIME protections; and prevents the default and
immutable `pages.dev` aliases from competing with `pogoteamlab.com` in search
results. `validate:cloudflare` fails the build if the policy is absent,
incomplete, or permits inline or evaluated scripts.

The readiness poll uses cache-busting requests for `release.json`, `index.html`,
and each same-origin JavaScript or stylesheet referenced by the index. It waits
for the expected commit rather than accepting a healthy stale deployment. If
Chrome still encounters a transient first-load failure, the browser check clears
its cache and retries that initial navigation up to two times with backoff.
Later workflow navigation and application assertions remain single-attempt so
the retries cannot conceal product regressions. A terminal navigation failure
reports the current URL, document state, rendered heading and body excerpt,
HTTP failures, network load failures, runtime exceptions, and console errors.

Every deployment is browser-tested at the immutable URL returned by Wrangler.
Production additionally verifies `https://pogoteamlab.com`, including HTTPS
redirects, canonical tags, robots.txt, sitemap.xml, and the expected commit.
Both checks remain mandatory; a healthy Pages URL does not prove the custom
domain works.

A single deployment job selects the production or staging environment and
branch alias from the event. Uploads to each shared alias are serialized.
Superseded PR runs can be cancelled; production runs are not interrupted.
The artifact is built once (including TypeScript checks), and artifact
compression uses level 1 to avoid spending CPU recompressing bundled assets.

The deployment job intentionally fails if the project or
either credential is missing. This prevents a release commit from appearing
successful when its environment was not updated.

The production branch remains available at `pvpoke-team-lab.pages.dev` and its
custom domain. The latest successful staging deployment is available at the
stable `staging.pvpoke-team-lab.pages.dev` branch alias. Cloudflare also returns
an immutable deployment URL for each upload; post-deployment verification uses
that immutable URL to prove the exact commit before the stable alias is used for
manual acceptance testing.

## Cloudflare challenges

A response with `cf-mitigated: challenge` is an access-policy failure, not
slow deployment propagation. Readiness stops immediately and reports the
Cloudflare Ray ID. In **Security → Events**, locate that request and inspect the
matching rule/service. Adjust the responsible rule so authorized CI verification
can reach the public application, release metadata, assets, and discovery files.
A WAF Skip rule can exempt narrowly identified verification traffic from the
applicable challenge rules; Bot Fight Mode requires changing its own setting
and cannot be bypassed with a WAF Skip rule. Do not exempt traffic solely because
it supplies the public readiness query parameter.

Cloudflare policy changes require zone security permissions; the Pages deployment
token and the usual Wrangler OAuth scopes do not include them. After fixing the
policy, rerun only the failed canonical verification job or manually run **Team
Lab deployment check** with `origin=https://pogoteamlab.com`, the deployed commit,
and `require_indexable=true`. Do not redeploy production just to retry a check.

References: [Cloudflare Skip rules](https://developers.cloudflare.com/waf/custom-rules/skip/)
and [Bot Fight Mode limitations](https://developers.cloudflare.com/bots/get-started/free/).

## Local Cloudflare verification

Build and validate the production artifact:

```bash
npm ci
npm run build
npx wrangler pages dev dist --port 4173
```

In another terminal, exercise the same deployed-origin workflow:

```bash
TEAMLAB_EXPECTED_COMMIT_SHA=$(git rev-parse HEAD) \
  npm run test:deployment -- \
    --origin=http://127.0.0.1:4173/
```

The local Pages emulator should return HTTP 200 for both `/` and direct
application routes. Local verification does not require a Cloudflare account.

## Supported production host

Cloudflare Pages is TeamLab's only supported production host. GitHub Pages was
retired after the 0.0.3 cutover, and the repository no longer contains a
provider-specific GitHub Pages build target or fallback artifact generator.

The application remains deployment-neutral static output. `VITE_BASE_PATH`
continues to support a path-based static host when intentionally configured,
but release CI always builds TeamLab at `/` and deploys only through Cloudflare.

IndexedDB remains isolated by web origin. The canonical
`https://pogoteamlab.com` origin does not share inventory or saved teams with
the `pages.dev` alias, so users should consistently use the custom domain and
move data between origins with a full-data JSON backup when necessary.

## Future changes

PvPoke move, species, sprite, and ranking refreshes continue through the
existing sync pipeline and produce the same static artifact. They do not
require Cloudflare configuration changes.

Do not add Functions, Workers, D1, KV, R2, or authentication merely for
deployment. Those services become relevant only if TeamLab intentionally adds
accounts, cross-device synchronization, or server-owned data in a future
product release.
