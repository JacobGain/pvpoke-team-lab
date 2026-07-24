import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { countCatalogDiagnostics } from "../src/domain/pokemon/catalog.ts";
import {
  gameMasterSchema,
  metaGroupSchema,
  rankingCollectionSchema,
} from "../src/pvpoke/types/schemas.ts";
import { buildPokemonCatalog } from "../src/pvpoke/adapters/buildPokemonCatalog.ts";

const dataDirectory = resolve(
  process.env.PVPOKE_DATA_DIR ?? "../src/data",
);

async function readJson(relativePath: string): Promise<unknown> {
  const filePath = resolve(dataDirectory, relativePath);
  const contents = await readFile(filePath, "utf8");

  return JSON.parse(contents) as unknown;
}

const [gameMaster, rankings, metaGroup] = await Promise.all([
  readJson("gamemaster.min.json").then((data) => gameMasterSchema.parse(data)),
  readJson("rankings/all/overall/rankings-1500.json").then((data) =>
    rankingCollectionSchema.parse(data),
  ),
  readJson("groups/great.json").then((data) => metaGroupSchema.parse(data)),
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
    `Normalized catalog entries: ${catalog.entries.length}`,
    `Non-fatal catalog diagnostics: ${diagnosticCount}`,
  ].join("\n"),
);
