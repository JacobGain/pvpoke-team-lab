import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const workflowsDirectory = resolve(process.cwd(), "../.github/workflows");
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

process.stdout.write(
  `Workflow security check passed: ${actionCount} external Action references are immutable and no privileged untrusted-code triggers are present.\n`,
);
