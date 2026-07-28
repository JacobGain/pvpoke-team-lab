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
const workflowNames = (await readdir(workflowsDirectory))
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();
const mutableActions: string[] = [];
const unsafeTriggers: string[] = [];
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

process.stdout.write(
  `Workflow security check passed: ${actionCount} external Action references are immutable, no privileged untrusted-code triggers are present, and the artifact and TeamLab CodeQL release checks are enforced.\n`,
);
