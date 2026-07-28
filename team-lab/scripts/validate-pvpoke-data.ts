import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { countCatalogDiagnostics } from "../src/domain/pokemon/catalog.ts";
import {
  gameMasterSchema,
  metaGroupSchema,
  rankingCollectionSchema,
} from "../src/pvpoke/types/schemas.ts";
import { buildPokemonCatalog } from "../src/pvpoke/adapters/buildPokemonCatalog.ts";

const dataDirectory = resolve(
  process.env.TEAMLAB_PVPOKE_DATA_DIR ??
    "public/vendor/pvpoke/data",
);
const bundleDirectory = resolve(dataDirectory, "..");

interface BundleManifest {
  readonly formatVersion: number;
  readonly files: Readonly<
    Record<
      string,
      {
        readonly bytes: number;
        readonly sha256: string;
      }
    >
  >;
}

async function readJson(relativePath: string): Promise<unknown> {
  const filePath = resolve(dataDirectory, relativePath);
  const contents = await readFile(filePath, "utf8");

  return JSON.parse(contents) as unknown;
}

async function validateBundleManifest(): Promise<number> {
  const manifest = JSON.parse(
    await readFile(resolve(bundleDirectory, "manifest.json"), "utf8"),
  ) as BundleManifest;

  if (manifest.formatVersion !== 1 || !manifest.files) {
    throw new Error("Unsupported or invalid PvPoke bundle manifest.");
  }

  const bundlePrefix = `${bundleDirectory}${sep}`;
  for (const [relativePath, expected] of Object.entries(manifest.files)) {
    const filePath = resolve(bundleDirectory, relativePath);
    if (!filePath.startsWith(bundlePrefix)) {
      throw new Error(`Bundle manifest path escapes its root: ${relativePath}`);
    }

    const contents = await readFile(filePath);
    const digest = createHash("sha256").update(contents).digest("hex");
    if (
      contents.byteLength !== expected.bytes ||
      digest !== expected.sha256
    ) {
      throw new Error(`Bundle manifest mismatch for ${relativePath}.`);
    }
  }

  return Object.keys(manifest.files).length;
}

const [gameMaster, rankings, metaGroup, bundledFileCount] = await Promise.all([
  readJson("gamemaster.min.json").then((data) => gameMasterSchema.parse(data)),
  readJson("rankings/all/overall/rankings-1500.json").then((data) =>
    rankingCollectionSchema.parse(data),
  ),
  readJson("groups/great.json").then((data) => metaGroupSchema.parse(data)),
  validateBundleManifest(),
]);

const catalog = buildPokemonCatalog(gameMaster, rankings, metaGroup);
const diagnosticCount = countCatalogDiagnostics(catalog.diagnostics);

console.log(
  [
    `Game Master: ${gameMaster.title} (${gameMaster.timestamp})`,
    `Pokémon: ${gameMaster.pokemon.length}`,
    `Moves: ${gameMaster.moves.length}`,
    `Open Great League rankings: ${rankings.length}`,
    `Great League meta entries: ${metaGroup.length}`,
    `Bundled files: ${bundledFileCount} (hashes valid)`,
    `Normalized catalog entries: ${catalog.entries.length}`,
    `Non-fatal catalog diagnostics: ${diagnosticCount}`,
  ].join("\n"),
);
