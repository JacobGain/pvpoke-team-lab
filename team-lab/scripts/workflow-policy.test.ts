import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateDeploymentPolicy } from "./workflow-policy.ts";

const release = readFileSync(new URL("../../.github/workflows/team-lab-release.yml", import.meta.url), "utf8");
const codeql = readFileSync(new URL("../../.github/workflows/team-lab-codeql.yml", import.meta.url), "utf8");

describe("release workflow policy", () => {
  it("preserves staging deployments for both PR targets, protected master releases, and artifact provenance", () => {
    expect(() => validateDeploymentPolicy(release, codeql)).not.toThrow();
  });

  it.each([
    ["PR creation", "types: [opened, synchronize", "types: [synchronize"],
    ["PR retargeting", "ready_for_review, edited", "ready_for_review"],
    ["master PR staging deployment", "github.base_ref == 'master'", "github.base_ref == 'main'"],
    ["fork isolation", "github.event.pull_request.head.repo.full_name == github.repository", "true"],
    ["selected stack preview", "contains(github.event.pull_request.labels.*.name, 'staging-preview')", "false"],
    ["label trigger", ", labeled]", "]"],
    ["Dependabot author isolation", "github.event.pull_request.user.login != 'dependabot[bot]'", "true"],
    ["dependency branch isolation", "!startsWith(github.head_ref, 'dependabot/')", "true"],
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

  it.each(["branches: [staging, master]", "branches-ignore: [feature/**]"])("rejects restricting stacked PR checks with %s", (filter) => {
    for (const target of ["release", "codeql"]) {
      const restricted = (target === "release" ? release : codeql).replace("  pull_request:\n", `  pull_request:\n    ${filter}\n`);
      expect(() => validateDeploymentPolicy(target === "release" ? restricted : release, target === "codeql" ? restricted : codeql)).toThrow();
    }
  });
});
