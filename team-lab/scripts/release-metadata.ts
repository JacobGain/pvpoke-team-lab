import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import {
  INVENTORY_RECORD_SCHEMA_VERSION,
  SAVED_TEAM_SCHEMA_VERSION,
  TEAM_LAB_BACKUP_SCHEMA_VERSION,
  TEAM_LAB_DATABASE_VERSION,
} from "../src/domain/schemaVersions.ts";

const executeFile = promisify(execFile);

interface PackageManifest {
  readonly version: string;
}

interface PvpokeManifest {
  readonly dataVersion: string;
}

export interface TeamLabReleaseMetadata {
  readonly formatVersion: 1;
  readonly releaseId: string;
  readonly appVersion: string;
  readonly builtAt: string;
  readonly target: "public" | "admin";
  readonly source: {
    readonly commitSha: string;
    readonly dirty: boolean | null;
  };
  readonly capabilities: {
    readonly diagnostics: boolean;
  };
  readonly schemas: {
    readonly database: number;
    readonly backup: number;
    readonly inventoryRecord: number;
    readonly savedTeam: number;
  };
  readonly pvpoke: {
    readonly dataVersion: string;
    readonly manifestSha256: string;
  };
}

function sha256(contents: Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function gitOutput(
  projectRoot: string,
  args: readonly string[],
): Promise<string | undefined> {
  try {
    const result = await executeFile("git", [...args], {
      cwd: projectRoot,
    });
    return result.stdout.trim();
  } catch {
    return undefined;
  }
}

function environmentCommitSha(): string | undefined {
  return [
    process.env.TEAMLAB_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.COMMIT_SHA,
  ].find((value) => value?.trim())?.trim();
}

export async function createReleaseMetadata(
  projectRoot: string,
  target: "public" | "admin",
): Promise<TeamLabReleaseMetadata> {
  const [packageContents, pvpokeManifestContents, gitCommitSha, gitStatus] =
    await Promise.all([
      readFile(`${projectRoot}/package.json`, "utf8"),
      readFile(
        `${projectRoot}/public/vendor/pvpoke/manifest.json`,
      ),
      gitOutput(projectRoot, ["rev-parse", "HEAD"]),
      gitOutput(projectRoot, ["status", "--porcelain", "--untracked-files=normal"]),
    ]);
  const packageManifest = JSON.parse(packageContents) as PackageManifest;
  const pvpokeManifest = JSON.parse(
    pvpokeManifestContents.toString("utf8"),
  ) as PvpokeManifest;
  const commitSha =
    environmentCommitSha() ?? gitCommitSha ?? "unknown";
  const manifestSha256 = sha256(pvpokeManifestContents);
  const sourceDirty = gitStatus === undefined ? null : gitStatus.length > 0;

  return {
    formatVersion: 1,
    releaseId: [
      packageManifest.version,
      target,
      commitSha.slice(0, 12),
      manifestSha256.slice(0, 12),
    ].join("-"),
    appVersion: packageManifest.version,
    builtAt: new Date().toISOString(),
    target,
    source: {
      commitSha,
      dirty: sourceDirty,
    },
    capabilities: {
      diagnostics: target === "admin",
    },
    schemas: {
      database: TEAM_LAB_DATABASE_VERSION,
      backup: TEAM_LAB_BACKUP_SCHEMA_VERSION,
      inventoryRecord: INVENTORY_RECORD_SCHEMA_VERSION,
      savedTeam: SAVED_TEAM_SCHEMA_VERSION,
    },
    pvpoke: {
      dataVersion: pvpokeManifest.dataVersion,
      manifestSha256,
    },
  };
}
