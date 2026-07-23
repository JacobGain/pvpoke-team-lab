import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  gameMasterSchema,
  metaGroupSchema,
  rankingCollectionSchema,
} from "../src/pvpoke/types/schemas.ts";

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

console.log(
  [
    `Game Master: ${gameMaster.title} (${gameMaster.timestamp})`,
    `Pokémon: ${gameMaster.pokemon.length}`,
    `Moves: ${gameMaster.moves.length}`,
    `Open Great League rankings: ${rankings.length}`,
    `Great League meta entries: ${metaGroup.length}`,
  ].join("\n"),
);
