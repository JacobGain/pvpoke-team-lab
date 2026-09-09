import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ACTIVE_SEASON } from "../src/pvpoke/season.ts";
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

const executeFile = promisify(execFile);
const useCheckout = Boolean(process.env.PVPOKE_SOURCE_DIR);

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
  readonly sourceLabel?: string;
  readonly outputPath: string;
  readonly relativePath: string;
  readonly contents: Buffer;
}

function sha256(contents: Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function readSource(path: string): Promise<Buffer> {
  if (useCheckout) return readFile(resolve(sourceDirectory, path));
  const gitPath = path === "../LICENSE" ? "LICENSE" : `src/${path}`;
  try {
    const result = await executeFile("git", ["show", `${ACTIVE_SEASON.upstreamCommit}:${gitPath}`], {
      cwd: projectRoot,
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024,
    });
    return result.stdout;
  } catch (cause) {
    throw new Error(`Cannot read pinned season source ${gitPath}. Fetch it with: git fetch https://github.com/pvpoke/pvpoke.git ${ACTIVE_SEASON.upstreamBranch}`, { cause });
  }
}

async function prepareFile(relativePath: string): Promise<PreparedFile> {
  const sourcePath = resolve(sourceDirectory, relativePath);
  return {
    sourcePath,
    outputPath: resolve(outputDirectory, relativePath),
    relativePath,
    contents: await readSource(relativePath),
  };
}

function normalizeFormatRuleWhitespace<T extends { formats: readonly { rules?: readonly string[] }[] }>(
  gameMaster: T,
): T {
  return {
    ...gameMaster,
    formats: gameMaster.formats.map((format) => ({
      ...format,
      rules: format.rules?.map((rule) => rule.replace(/\s+/gu, "")),
    })),
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
    contents: await readSource("../LICENSE"),
  });

  const byPath = new Map(
    preparedFiles.map((file) => [file.relativePath, file.contents]),
  );
  const gameMaster = gameMasterSchema.parse(
    JSON.parse(byPath.get("data/gamemaster.min.json")!.toString("utf8")),
  );
  const greatRankings = rankingCollectionSchema.parse(
    JSON.parse(
      byPath
        .get("data/rankings/all/overall/rankings-1500.json")!
        .toString("utf8"),
    ),
  );
  metaGroupSchema.parse(
    JSON.parse(byPath.get("data/groups/great.json")!.toString("utf8")),
  );
  const ultraRankings = rankingCollectionSchema.parse(JSON.parse(byPath.get("data/rankings/all/overall/rankings-2500.json")!.toString("utf8")));
  metaGroupSchema.parse(JSON.parse(byPath.get("data/groups/ultra.json")!.toString("utf8")));
  const masterRankings = rankingCollectionSchema.parse(JSON.parse(byPath.get("data/rankings/all/overall/rankings-10000.json")!.toString("utf8")));
  metaGroupSchema.parse(JSON.parse(byPath.get("data/groups/master.json")!.toString("utf8")));
  const fullGameMaster = gameMasterSchema.parse(JSON.parse(byPath.get("data/gamemaster.json")!.toString("utf8")));
  if (
    JSON.stringify(normalizeFormatRuleWhitespace(fullGameMaster)) !==
    JSON.stringify(normalizeFormatRuleWhitespace(gameMaster))
  ) {
    throw new Error("Full and minified Game Master data must match.");
  }

  const pokemonById = new Map(
    gameMaster.pokemon.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const leaders = (rankings: typeof greatRankings) =>
    rankings.slice(0, 3).map((ranking, index) => {
      const pokemon = pokemonById.get(ranking.speciesId);
      if (!pokemon) {
        throw new Error(
          `Dashboard leader ${ranking.speciesId} is missing from the Game Master.`,
        );
      }
      return {
        rank: index + 1,
        speciesId: ranking.speciesId,
        speciesName: ranking.speciesName,
        types: pokemon.types,
        recommendedMoveIds: ranking.moveset.filter((moveId) => moveId !== "none"),
      };
    });
  const dashboardData = {
    formatVersion: 1,
    dataVersion: gameMaster.timestamp,
    speciesNames: Object.fromEntries(
      gameMaster.pokemon.map((pokemon) => [pokemon.speciesId, pokemon.speciesName]),
    ),
    leaders: {
      "great-league": leaders(greatRankings),
      "ultra-league": leaders(ultraRankings),
      "master-league": leaders(masterRankings),
    },
  };
  const dashboardContents = Buffer.from(
    `${JSON.stringify(dashboardData)}\n`,
    "utf8",
  );
  preparedFiles.push({
    sourcePath: resolve(projectRoot, "scripts/sync-pvpoke-assets.ts"),
    sourceLabel: "generated by scripts/sync-pvpoke-assets.ts",
    outputPath: resolve(outputDirectory, "data/dashboard.json"),
    relativePath: "data/dashboard.json",
    contents: dashboardContents,
  });

  for (const file of preparedFiles) {
    await mkdir(dirname(file.outputPath), { recursive: true });
    await writeFile(file.outputPath, file.contents);
  }

  const manifest = {
    formatVersion: 1,
    dataVersion: gameMaster.timestamp,
    source: useCheckout ? "PvPoke source directory override" : "PvPoke pinned season revision",
    season: useCheckout ? undefined : ACTIVE_SEASON,
    files: Object.fromEntries(
      preparedFiles.map((file) => [
        file.relativePath,
        {
          source: file.sourceLabel ?? relative(sourceDirectory, file.sourcePath),
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
