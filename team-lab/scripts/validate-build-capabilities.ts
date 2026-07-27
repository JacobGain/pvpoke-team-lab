import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const [, , outputArgument, expectation] = process.argv;

if (
  !outputArgument ||
  (expectation !== "diagnostics-enabled" &&
    expectation !== "diagnostics-disabled")
) {
  throw new Error(
    "Usage: validate-build-capabilities.ts <output-directory> <diagnostics-enabled|diagnostics-disabled>",
  );
}

const outputDirectory = resolve(outputArgument);
const releaseMetadata = JSON.parse(
  await readFile(resolve(outputDirectory, "release.json"), "utf8"),
) as {
  readonly formatVersion?: number;
  readonly releaseId?: string;
  readonly appVersion?: string;
  readonly builtAt?: string;
  readonly target?: string;
  readonly source?: {
    readonly commitSha?: string;
    readonly dirty?: boolean | null;
  };
  readonly capabilities?: {
    readonly diagnostics?: boolean;
  };
  readonly schemas?: {
    readonly database?: number;
    readonly backup?: number;
    readonly inventoryRecord?: number;
    readonly savedTeam?: number;
  };
  readonly pvpoke?: {
    readonly dataVersion?: string;
    readonly manifestSha256?: string;
  };
};
const files = await readdir(outputDirectory, {
  recursive: true,
  withFileTypes: true,
});
const javascriptPaths = files
  .filter((file) => file.isFile() && file.name.endsWith(".js"))
  .map((file) => resolve(file.parentPath, file.name));
const javascript = (
  await Promise.all(
    javascriptPaths.map((filePath) => readFile(filePath, "utf8")),
  )
).join("\n");
const includesDiagnostics =
  javascript.includes("PvPoke engine diagnostics") &&
  javascript.includes("Run characterization");
const expectsDiagnostics = expectation === "diagnostics-enabled";
const expectedTarget = expectsDiagnostics ? "admin" : "public";
const forbiddenProductionCopy = [
  "Local data",
  "local data",
  "saved locally",
  "Local-first",
  "Private to this browser",
].filter((phrase) => javascript.includes(phrase));

if (includesDiagnostics !== expectsDiagnostics) {
  throw new Error(
    expectsDiagnostics
      ? `The diagnostics-enabled build at ${outputDirectory} does not contain the diagnostics feature.`
      : `The production build at ${outputDirectory} still contains diagnostics code.`,
  );
}

if (
  releaseMetadata.formatVersion !== 1 ||
  releaseMetadata.target !== expectedTarget ||
  releaseMetadata.capabilities?.diagnostics !== expectsDiagnostics ||
  !releaseMetadata.releaseId ||
  !releaseMetadata.appVersion ||
  !releaseMetadata.source?.commitSha ||
  !releaseMetadata.pvpoke?.dataVersion ||
  !releaseMetadata.pvpoke.manifestSha256?.match(/^[a-f0-9]{64}$/) ||
  !releaseMetadata.builtAt ||
  Number.isNaN(Date.parse(releaseMetadata.builtAt)) ||
  !releaseMetadata.schemas?.database ||
  !releaseMetadata.schemas.backup ||
  !releaseMetadata.schemas.inventoryRecord ||
  !releaseMetadata.schemas.savedTeam
) {
  throw new Error(
    `The ${expectedTarget} artifact contains invalid release metadata.`,
  );
}

if (!expectsDiagnostics && forbiddenProductionCopy.length > 0) {
  throw new Error(
    `The production build contains deployment-specific local-storage copy: ${forbiddenProductionCopy.join(", ")}.`,
  );
}

process.stdout.write(
  `${expectsDiagnostics ? "Admin" : "Production"} build capability check passed for ${releaseMetadata.releaseId}: diagnostics ${expectsDiagnostics ? "included" : "excluded"}${expectsDiagnostics ? "" : " and production copy is deployment-neutral"}.\n`,
);
