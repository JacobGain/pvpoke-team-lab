import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const workflowsDirectory = resolve(process.cwd(), "../.github/workflows");
const masterRulesetPath = resolve(
  process.cwd(),
  "../.github/rulesets/master-protection.json",
);
const codeqlConfigPath = resolve(
  process.cwd(),
  "../.github/codeql/codeql-config.yml",
);
const dependabotConfigPath = resolve(
  process.cwd(),
  "../.github/dependabot.yml",
);
const workflowNames = (await readdir(workflowsDirectory))
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();
const mutableActions: string[] = [];
const unsafeTriggers: string[] = [];
const codeqlWorkflowNames = new Set<string>();
let actionCount = 0;

for (const workflowName of workflowNames) {
  const workflow = await readFile(
    resolve(workflowsDirectory, workflowName),
    "utf8",
  );

  for (const match of workflow.matchAll(/^\s*uses:\s*(\S+)/gm)) {
    const action = match[1];

    if (action.startsWith("./")) {
      continue;
    }

    actionCount += 1;
    if (!/@[0-9a-f]{40}$/.test(action)) {
      mutableActions.push(`${workflowName}: ${action}`);
    }
  }

  for (const trigger of ["pull_request_target", "workflow_run"]) {
    if (new RegExp(`^\\s*${trigger}:`, "m").test(workflow)) {
      unsafeTriggers.push(`${workflowName}: ${trigger}`);
    }
  }

  if (workflow.includes("gitHubToken:")) {
    throw new Error(
      `${workflowName} enables Wrangler's duplicate GitHub deployment integration.`,
    );
  }

  if (workflow.includes("github/codeql-action/init@")) {
    codeqlWorkflowNames.add(workflowName);
  }
}

if (actionCount === 0) {
  throw new Error("No external GitHub Actions were found to validate.");
}

if (mutableActions.length > 0) {
  throw new Error(
    `GitHub Actions must use immutable full commit SHAs:\n${mutableActions.join("\n")}`,
  );
}

if (unsafeTriggers.length > 0) {
  throw new Error(
    `Privileged untrusted-code triggers are not allowed:\n${unsafeTriggers.join("\n")}`,
  );
}

const expectedCodeqlWorkflowName = "team-lab-codeql.yml";
if (
  codeqlWorkflowNames.size !== 1 ||
  !codeqlWorkflowNames.has(expectedCodeqlWorkflowName)
) {
  throw new Error(
    `CodeQL must have exactly one workflow (${expectedCodeqlWorkflowName}); found: ${[...codeqlWorkflowNames].join(", ") || "none"}.`,
  );
}

const codeqlWorkflow = await readFile(
  resolve(workflowsDirectory, expectedCodeqlWorkflowName),
  "utf8",
);
if (
  (codeqlWorkflow.match(/github\/codeql-action\/init@/g)?.length ?? 0) !== 2 ||
  (codeqlWorkflow.match(/github\/codeql-action\/analyze@/g)?.length ?? 0) !==
    2 ||
  !/languages:\s*actions\b/.test(codeqlWorkflow) ||
  !/languages:\s*javascript-typescript\b/.test(codeqlWorkflow) ||
  !codeqlWorkflow.includes(
    "config-file: ./.github/codeql/codeql-config.yml",
  )
) {
  throw new Error(
    "The single CodeQL workflow must contain distinct GitHub Actions and TeamLab JavaScript/TypeScript analyses.",
  );
}

const masterRuleset = JSON.parse(
  await readFile(masterRulesetPath, "utf8"),
) as {
  readonly bypass_actors?: readonly unknown[];
  readonly enforcement?: string;
  readonly rules?: readonly {
    readonly type?: string;
    readonly parameters?: {
      readonly required_status_checks?: readonly {
        readonly context?: string;
      }[];
      readonly strict_required_status_checks_policy?: boolean;
    };
  }[];
};
const requiredChecksRule = masterRuleset.rules?.find(
  (rule) => rule.type === "required_status_checks",
);
const requiredChecks =
  requiredChecksRule?.parameters?.required_status_checks?.map(
    (check) => check.context,
  ) ?? [];
const requiredReleaseChecks = [
  "Verify public artifact",
  "Analyze TeamLab (javascript-typescript)",
  "Analyze workflows (actions)",
] as const;

if (
  masterRuleset.enforcement !== "active" ||
  (masterRuleset.bypass_actors?.length ?? 0) > 0 ||
  requiredReleaseChecks.some((check) => !requiredChecks.includes(check)) ||
  requiredChecksRule?.parameters?.strict_required_status_checks_policy !== true
) {
  throw new Error(
    "The master ruleset must actively require the up-to-date artifact and TeamLab CodeQL checks without bypass actors.",
  );
}

const codeqlConfig = await readFile(codeqlConfigPath, "utf8");
if (
  !/^paths:\s*\n\s+- team-lab\s*$/m.test(codeqlConfig) ||
  /^\s+- (?:src|data|js|index\.html)(?:\/|\s|$)/m.test(codeqlConfig)
) {
  throw new Error(
    "CodeQL must scan TeamLab without modifying or treating the preserved upstream PvPoke tree as release code.",
  );
}

const dependabotConfig = await readFile(dependabotConfigPath, "utf8");
const ecosystemCount = [
  ...dependabotConfig.matchAll(/^ {2}- package-ecosystem:/gm),
].length;
const stagingTargetCount = [
  ...dependabotConfig.matchAll(/^ {4}target-branch: staging$/gm),
].length;
const pullRequestLimitCount = [
  ...dependabotConfig.matchAll(/^ {4}open-pull-requests-limit: 3$/gm),
].length;
const requiredDependabotPolicies = [
  "npm-minor-patch:",
  "codeql-action:",
  "actions-minor-patch:",
  '- "github/codeql-action/*"',
  "version-update:semver-major",
] as const;

if (
  ecosystemCount !== 2 ||
  stagingTargetCount !== 2 ||
  pullRequestLimitCount !== 2 ||
  requiredDependabotPolicies.some(
    (policy) => !dependabotConfig.includes(policy),
  )
) {
  throw new Error(
    "Dependabot must target staging, cap both ecosystems at three PRs, group routine npm and Action updates, keep CodeQL actions together, and defer incompatible TypeScript major updates.",
  );
}

process.stdout.write(
  `Workflow security check passed: ${actionCount} external Action references are immutable, no privileged untrusted-code triggers are present, one CodeQL workflow covers TeamLab and GitHub Actions, dependency maintenance is bounded, and all release checks are enforced.\n`,
);
