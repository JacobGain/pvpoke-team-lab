# Cloudflare Pages deployment

TeamLab 0.0.3 is prepared for a static-only Cloudflare Pages deployment. The
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

The deployment uses the `cloudflare-pages` GitHub environment. Add required
reviewers there later if production deployment approvals are wanted. No domain,
billing method, Pages Function, or storage binding is required.

## Release pipeline

Pull requests run the complete **Verify public artifact** gate but never
deploy. A push to `master`:

1. builds the public root-hosted `dist/` exactly once;
2. validates diagnostics are absent and Cloudflare static limits are met;
3. browser-tests that exact artifact;
4. uploads it as `team-lab-public-<commit SHA>`;
5. downloads the verified artifact in the deployment job;
6. deploys it to the `pvpoke-team-lab` production branch with pinned Wrangler;
7. browser-tests the returned HTTPS deployment URL and exact commit metadata.

The deployment job rejects `404.html`, `_worker.js`, and `dist-admin/`. Without
a top-level `404.html`, Cloudflare Pages applies its native SPA fallback, so
direct routes such as `/catalog` return HTTP 200. The verified artifact remains
available in GitHub Actions for 30 days and Cloudflare keeps deployment history
for rollback.

The workflow intentionally fails on `master` if the project or either
credential is missing. This prevents a release commit from appearing successful
when production was not updated.

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

## Cutover from GitHub Pages

The 0.0.3 workflow no longer updates GitHub Pages. The existing 0.0.2 site stays
available during the first Cloudflare deployment, providing a recoverable
cutover instead of switching both systems at once.

IndexedDB is isolated by web origin. Inventory and teams stored at the
`github.io` address cannot automatically appear at the new `pages.dev` address.
Before switching bookmarks or links:

1. open **Backups & reset** on the GitHub Pages deployment;
2. download a full-data JSON backup;
3. open the verified Cloudflare deployment;
4. restore that backup and confirm inventory and saved teams;
5. update public links to the Cloudflare production URL;
6. disable GitHub Pages in **Repository Settings → Pages**.

After Pages is disabled, only Cloudflare hosts the production application. Keep
the `build:github-pages` script solely as an emergency compatibility target; it
is not used by release CI.

## Future changes

PvPoke move, species, sprite, and ranking refreshes continue through the
existing sync pipeline and produce the same static artifact. They do not
require Cloudflare configuration changes.

Do not add Functions, Workers, D1, KV, R2, or authentication merely for
deployment. Those services become relevant only if TeamLab intentionally adds
accounts, cross-device synchronization, or server-owned data in a future
product release.
