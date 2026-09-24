import assert from "node:assert/strict";
import { parse } from "yaml";

interface Workflow {
  on: Record<string, { branches?: string[]; types?: string[] } | null>;
  concurrency: { group: string; "cancel-in-progress": boolean | string };
  jobs: Record<string, {
    name: string;
    if?: string;
    needs?: string;
    uses?: string;
    environment?: { name: string };
    concurrency?: { group: string; "cancel-in-progress": boolean };
    with?: Record<string, unknown>;
    steps?: { name: string; uses?: string; with?: Record<string, unknown> }[];
  }>;
}

const productionCondition = "github.event_name == 'push' && github.ref == 'refs/heads/master'";
const deploymentCondition = `(${productionCondition}) ||
  (github.event_name == 'pull_request' &&
   (github.base_ref == 'staging' || github.base_ref == 'master') &&
   github.event.pull_request.head.repo.full_name == github.repository &&
   github.actor != 'dependabot[bot]')`;
const normalize = (value: string | undefined) => value?.replace(/\s+/g, " ").trim();

export function validateDeploymentPolicy(releaseSource: string, codeqlSource: string): void {
  const release = parse(releaseSource) as Workflow;
  const codeql = parse(codeqlSource) as Workflow;
  assert.deepEqual(release.on.pull_request?.branches, ["staging", "master"], "Validate PRs to both release branches.");
  assert.deepEqual(release.on.pull_request?.types, ["opened", "synchronize", "reopened", "ready_for_review"], "PR creation and updates must trigger staging deployment.");
  assert.deepEqual(release.on.push?.branches, ["master"], "Only master pushes need a second artifact build for production.");
  assert.deepEqual(codeql.on.pull_request?.branches, ["staging", "master"], "CodeQL must catch findings before the production PR.");
  assert.equal(release.concurrency["cancel-in-progress"], "${{ github.event_name == 'pull_request' }}", "Do not cancel production deployments.");

  const deploy = release.jobs["deploy-cloudflare"];
  assert.ok(deploy, "Keep one shared deployment job.");
  assert.equal(normalize(deploy.if), normalize(deploymentCondition), "Deploy only master pushes and trusted PRs into staging or master, never forks or Dependabot.");
  assert.equal(deploy.needs, "verify-public-artifact", "Deploy only a verified artifact.");
  assert.equal(release.jobs["verify-public-artifact"]?.name, "Verify public artifact", "Preserve the required branch-protection check.");
  assert.equal(deploy.environment?.name, "${{ github.event_name == 'push' && 'cloudflare-pages' || 'cloudflare-pages-staging' }}");
  assert.deepEqual(deploy.concurrency, {
    group: "cloudflare-pages-${{ github.event_name == 'push' && 'master' || 'staging' }}",
    "cancel-in-progress": false,
  }, "Serialize uploads to shared aliases.");

  const steps = Object.values(release.jobs).flatMap(job => job.steps ?? []);
  const uploads = steps.filter(step => step.uses?.startsWith("actions/upload-artifact@"));
  const downloads = deploy.steps?.filter(step => step.uses?.startsWith("actions/download-artifact@")) ?? [];
  assert.equal(uploads.length, 1);
  assert.equal(downloads.length, 1);
  assert.equal(uploads[0]?.with?.name, "team-lab-public-${{ github.sha }}");
  assert.equal(downloads[0]?.with?.name, uploads[0]?.with?.name, "Deploy the artifact tested for this exact merge SHA.");
  const deployments = steps.filter(step => step.uses?.startsWith("cloudflare/wrangler-action@"));
  assert.equal(deployments.length, 1, "Keep one upload implementation for both environments.");
  assert.ok(String(deployments[0]?.with?.command).includes("--branch=${{ github.event_name == 'push' && 'master' || 'staging' }}"));
  assert.ok(String(deployments[0]?.with?.command).includes("--commit-hash=${{ github.sha }}"));

  const verify = release.jobs["verify-deployment"];
  assert.equal(verify?.needs, "deploy-cloudflare");
  assert.equal(verify?.with?.origin, "${{ needs.deploy-cloudflare.outputs.origin }}");
  assert.equal(verify?.with?.expected_commit, "${{ github.sha }}");
  const canonical = release.jobs["verify-production-canonical-origin"];
  assert.equal(canonical?.if, productionCondition);
  assert.equal(canonical?.needs, "deploy-cloudflare");
  assert.equal(canonical?.with?.require_indexable, true, "Keep canonical search discovery verification.");
}
