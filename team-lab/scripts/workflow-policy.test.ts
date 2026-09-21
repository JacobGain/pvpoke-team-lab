import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateDeploymentPolicy } from "./workflow-policy.ts";

const release = readFileSync(new URL("../../.github/workflows/team-lab-release.yml", import.meta.url), "utf8");
const codeql = readFileSync(new URL("../../.github/workflows/team-lab-codeql.yml", import.meta.url), "utf8");

describe("release workflow policy", () => {
  it("preserves PR staging deployments, protected master releases, and artifact provenance", () => {
    expect(() => validateDeploymentPolicy(release, codeql)).not.toThrow();
  });

  it.each([
    ["PR creation", "types: [opened, synchronize", "types: [synchronize"],
    ["fork isolation", "github.event.pull_request.head.repo.full_name == github.repository", "true"],
    ["Dependabot isolation", "github.actor != 'dependabot[bot]'", "true"],
    ["production trigger", "github.ref == 'refs/heads/master'", "github.ref == 'refs/heads/staging'"],
    ["artifact gate", "needs: verify-public-artifact", "needs: other-job"],
    ["production cancellation", "cancel-in-progress: ${{ github.event_name == 'pull_request' }}", "cancel-in-progress: true"],
    ["alias serialization", "cancel-in-progress: false", "cancel-in-progress: true"],
    ["indexability", "require_indexable: true", "require_indexable: false"],
    ["artifact identity", "name: team-lab-public-${{ github.sha }}", "name: latest"],
  ])("rejects a regression in %s", (_name, before, after) => {
    expect(release).toContain(before);
    expect(() => validateDeploymentPolicy(release.replace(before, after), codeql)).toThrow();
  });

  it("requires CodeQL on staging PRs", () => {
    expect(() => validateDeploymentPolicy(release, codeql.replace("branches: [staging, master]", "branches: [master]"))).toThrow();
  });
});
