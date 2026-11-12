# Dependency maintenance

TeamLab uses Dependabot for weekly version discovery and GitHub's repository
security settings for vulnerability alerts and automated security fixes.
Routine version maintenance is deliberately separate from production releases.

## 1.4.0 minimatch security remediation

The inherited 1.3.2 lockfile reported ten moderate development-tool findings
through [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
ESLint 10.14.0, config-array 0.23.5, and TypeScript-ESLint through 8.72.2 still
request minimatch 10.x, while the advisory's patched version is 11.0.1. npm's
automatic suggestions downgrade the lint stack and are not used.

The remediation uses exact minimatch 11.0.1 overrides scoped to its three
consumers: `eslint`, `@eslint/config-array`, and
`@typescript-eslint/typescript-estree`. This intentionally crosses their
declared major-version ranges. It is a reviewed compatibility exception, not a
claim that their 10.x ranges include 11.x. The patched package replaces its
internal matching implementation; its published README explains why the change
will not be backported. Inspect upstream parent releases when removing the
overrides rather than retaining them indefinitely.

Source review confirms these consumers use exported `Minimatch`, its `pattern`
and `match(path, partial)` APIs, or exported `minimatch(path, pattern, options)`;
11.0.1 retains those APIs, including dot, negation, and partial-path options.
Its Node engine range includes all TeamLab-supported Node versions. No lint rule,
parser, project-service setting, dependency-audit threshold, or TypeScript major
policy is weakened. The lockfile changes only minimatch and its new nonrecursive
matcher dependency. They remain development dependencies.

`scripts/lint-toolchain.test.ts` verifies source/TSX/script coverage, generated
and vendor exclusions, and enforcement of typed TypeScript and React Hooks
rules. The complete lint, unit, production-artifact, and CodeQL gates remain
required; a zero-vulnerability audit alone is insufficient compatibility proof.
The first clean locked install with these overrides reports zero vulnerabilities.
Final artifact and remote checks must still be recorded for the release.

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
PRs targeting `staging` or `master`, explicitly selected `staging-preview` PRs,
and production pushes to `master`.

Land a stack from bottom to top using merge commits to preserve ancestry.
After each parent lands, retarget the next PR to `staging` and wait for fresh
required checks against that base. If a parent is squash-merged instead,
restack the remaining branches before proceeding so already landed commits do
not reappear in their diffs. Do not merge the top PR into its parent as a
shortcut for landing the whole stack.

### Previewing the complete stack

Apply the `staging-preview` label to the top same-repository PR to deploy the
complete stack to the shared staging Pages alias before its parents land.
Adding the label triggers the full artifact gate and then deploys those exact
verified files. Keep this label on the one stack tip you want to preview.

Dependency PRs are excluded by author and branch name as well as run actor, so
editing or rerunning a Dependabot PR as a maintainer cannot deploy its older
application version. Normal trusted PRs into `staging` or `master` remain
eligible for preview deployments. The label never authorizes production;
production still requires a successful push to `master`.
