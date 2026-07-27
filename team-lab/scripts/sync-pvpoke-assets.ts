import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import {
  gameMasterSchema,
  metaGroupSchema,
  rankingCollectionSchema,
} from "../src/pvpoke/types/schemas.ts";
import {
  PVPOKE_BUNDLED_DATA_PATHS,
  PVPOKE_ENGINE_SCRIPT_PATHS,
} from "../src/pvpoke/assetPaths.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceDirectory = resolve(
  projectRoot,
  process.env.PVPOKE_SOURCE_DIR ?? "../src",
);
const outputDirectory = resolve(projectRoot, "public/vendor/pvpoke");

const bundledFiles = [
  ...PVPOKE_BUNDLED_DATA_PATHS,
  ...PVPOKE_ENGINE_SCRIPT_PATHS,
] as const;

interface PreparedFile {
  readonly sourcePath: string;
  readonly outputPath: string;
  readonly relativePath: string;
  readonly contents: Buffer;
}

function sha256(contents: Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function prepareFile(relativePath: string): Promise<PreparedFile> {
  const sourcePath = resolve(sourceDirectory, relativePath);
  return {
    sourcePath,
    outputPath: resolve(outputDirectory, relativePath),
    relativePath,
    contents: await readFile(sourcePath),
  };
}

async function main(): Promise<void> {
  const preparedFiles: PreparedFile[] = await Promise.all(
    bundledFiles.map((relativePath) => prepareFile(relativePath)),
  );
  const licensePath = resolve(sourceDirectory, "../LICENSE");
  preparedFiles.push({
    sourcePath: licensePath,
    outputPath: resolve(outputDirectory, "LICENSE"),
    relativePath: "LICENSE",
    contents: await readFile(licensePath),
  });

  const byPath = new Map(
    preparedFiles.map((file) => [file.relativePath, file.contents]),
  );
  const gameMaster = gameMasterSchema.parse(
    JSON.parse(byPath.get("data/gamemaster.min.json")!.toString("utf8")),
  );
  rankingCollectionSchema.parse(
    JSON.parse(
      byPath
        .get("data/rankings/all/overall/rankings-1500.json")!
        .toString("utf8"),
    ),
  );
  metaGroupSchema.parse(
    JSON.parse(byPath.get("data/groups/great.json")!.toString("utf8")),
  );
  JSON.parse(byPath.get("data/gamemaster.json")!.toString("utf8"));

  for (const file of preparedFiles) {
    await mkdir(dirname(file.outputPath), { recursive: true });
    await writeFile(file.outputPath, file.contents);
  }

  const manifest = {
    formatVersion: 1,
    dataVersion: gameMaster.timestamp,
    source: "PvPoke upstream checkout",
    files: Object.fromEntries(
      preparedFiles.map((file) => [
        file.relativePath,
        {
          source: relative(sourceDirectory, file.sourcePath),
          bytes: file.contents.byteLength,
          sha256: sha256(file.contents),
        },
      ]),
    ),
  };
  await writeFile(
    resolve(outputDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  process.stdout.write(
    `Bundled ${preparedFiles.length} validated PvPoke files for data version ${gameMaster.timestamp}.\n`,
  );
}

await main();
