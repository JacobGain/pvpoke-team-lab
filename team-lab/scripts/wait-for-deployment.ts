import { waitForDeploymentReadiness } from "./deployment-readiness.ts";

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

const origin =
  argumentValue("origin") ??
  process.env.TEAMLAB_DEPLOYMENT_ORIGIN?.trim();
const expectedCommitSha =
  argumentValue("expected-commit") ??
  process.env.TEAMLAB_EXPECTED_COMMIT_SHA?.trim();

if (!origin || !expectedCommitSha) {
  throw new Error(
    "Usage: wait-for-deployment.ts --origin=https://deployed.example/ --expected-commit=<commit SHA>",
  );
}

const readiness = await waitForDeploymentReadiness({
  origin,
  expectedCommitSha,
  onRetry: (message) => {
    process.stdout.write(`[deployment-readiness] ${message}\n`);
  },
});

process.stdout.write(
  `[deployment-readiness] ready after ${readiness.attempts} attempt(s): ${readiness.releaseId}; commit ${readiness.commitSha}; ${readiness.assetCount} entry assets available at ${readiness.origin}\n`,
);
