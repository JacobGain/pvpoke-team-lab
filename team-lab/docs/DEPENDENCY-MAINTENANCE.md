# Dependency maintenance

TeamLab uses Dependabot for weekly version discovery and GitHub's repository
security settings for vulnerability alerts and automated security fixes.
Routine version maintenance is deliberately separate from production releases.

## Version-update policy

Dependabot checks npm and GitHub Actions every Monday at 09:00
America/Toronto. Version-update pull requests target `staging`, never
`master`, so they cannot deploy directly.

The configuration keeps the review queue bounded:

- npm minor and patch releases are grouped into one pull request;
- both references to `github/codeql-action` are updated together;
- other GitHub Actions minor and patch releases are grouped;
- major releases remain isolated for explicit compatibility review;
- each ecosystem may have at most three open version-update pull requests.

TypeScript 7 is temporarily ignored because `typescript-eslint` 8.x declares
support only through TypeScript 6.0. Remove that ignore only after the installed
lint toolchain supports the newer major.

Workflow validation also requires every CodeQL `init` and `analyze` reference
to use the same immutable commit. This complements the Dependabot grouping rule
and prevents a partial CodeQL update from passing the release gate.

## Reviewing updates

Never merge a dependency pull request only because CodeQL succeeds. The
**Verify public artifact** check must also pass: it installs the exact lockfile,
audits dependencies, builds the public artifact, and exercises it in Chrome.
The browser workflow allows IndexedDB persistence additional time on a loaded
CI runner while retaining the exact saved-record assertion. A persistence
failure reports the current route, rendered record count, submit state, and
visible application error for triage.

For grouped routine updates:

1. review the changelogs represented in the pull request;
2. require the complete artifact gate to pass;
3. merge into `staging`;
4. include the tested staging state in the next release pull request.

Review major upgrades individually. In particular, changes to Node setup,
Wrangler, TypeScript, React, Vite, or routing can alter build or deployment
behavior even when Dependabot can update the referenced version mechanically.

Dependabot pull requests never deploy. Only a successful push to `master`
reuses the verified artifact and publishes it through the Cloudflare Pages
deployment job.

## Stacking related pull requests

Dependabot continues to open updates against `staging`. Maintainers may
organize an existing related set into a temporary stack, with each PR targeting
the branch immediately below it. The bottom PR targets `staging`; none target
`master`. Include prerequisites and the landing order in every description.
Human commits on Dependabot branches can prevent its automatic rebases, so
maintainers own updates to these temporarily stacked branches.

Artifact verification and CodeQL run for PRs targeting any branch, and rerun
when PR metadata or the base changes. Deployment remains limited to eligible
PRs targeting `staging` or `master`, and production pushes to `master`.

Land a stack from bottom to top using merge commits to preserve ancestry.
After each parent lands, retarget the next PR to `staging` and wait for fresh
required checks against that base. If a parent is squash-merged instead,
restack the remaining branches before proceeding so already landed commits do
not reappear in their diffs. Do not merge the top PR into its parent as a
shortcut for landing the whole stack.
