import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import sharp from "sharp";

const SPRITES_REVISION = "8dfa3d97e953caaafaafd4963eff7621811af08e";
const POKEAPI_LIST_URL = "https://pokeapi.co/api/v2/pokemon?limit=100000";
const SPRITE_SOURCE_ROOT =
  `https://raw.githubusercontent.com/PokeAPI/sprites/${SPRITES_REVISION}` +
  "/sprites/pokemon/other/home";
const POKEMINERS_REVISION = "c5e20d0e580469395ef3cec33f243e1544550008";
const POKEMINERS_SOURCE_ROOT =
  `https://raw.githubusercontent.com/PokeMiners/pogo_assets/${POKEMINERS_REVISION}` +
  "/Images/Pokemon%20-%20256x256/Addressable%20Assets";
const projectRoot = resolve(import.meta.dirname, "..");
const gameMasterPath = resolve(
  projectRoot,
  "public/vendor/pvpoke/data/gamemaster.min.json",
);
const assetDirectory = resolve(projectRoot, "public/assets/pokemon");
const manifestPath = resolve(
  projectRoot,
  "src/generated/pokemonSprites.ts",
);
const attributionPath = resolve(
  projectRoot,
  "public/assets/pokemon/ATTRIBUTION.md",
);

interface GameMasterPokemon {
  readonly dex: number;
  readonly speciesId: string;
  readonly speciesName: string;
  readonly released?: boolean;
}

interface GameMaster {
  readonly pokemon: readonly GameMasterPokemon[];
}

interface PokeApiList {
  readonly results: readonly {
    readonly name: string;
    readonly url: string;
  }[];
}

interface SpriteManifestEntry {
  readonly path: string;
  readonly pokeApiId: number;
  readonly match: "exact" | "base-fallback";
}

interface SpriteSource {
  readonly assetId: string;
  readonly pokeApiId: number;
  readonly sourceUrl: string;
}

const pokemonGoFormArtwork: Readonly<Record<string, string>> = {
  burmy_plant: "pm412.fBURMY_PLANT.icon.png",
  burmy_sandy: "pm412.fBURMY_SANDY.icon.png",
  burmy_trash: "pm412.fBURMY_TRASH.icon.png",
  cherrim_overcast: "pm421.fOVERCAST.icon.png",
  cherrim_sunny: "pm421.fSUNNY.icon.png",
  genesect_burn: "pm649.fBURN.icon.png",
  genesect_chill: "pm649.fCHILL.icon.png",
  genesect_douse: "pm649.fDOUSE.icon.png",
  genesect_shock: "pm649.fSHOCK.icon.png",
  mewtwo_armored: "pm150.fA.icon.png",
};

const explicitAliases: Readonly<Record<string, string>> = {
  basculin: "basculin-red-striped",
  darmanitan_galarian_standard: "darmanitan-galar-standard",
  deoxys: "deoxys-normal",
  dudunsparce: "dudunsparce-two-segment",
  farfetchd: "farfetchd",
  frillish: "frillish-male",
  mr_mime: "mr-mime",
  mr_rime: "mr-rime",
  mime_jr: "mime-jr",
  ho_oh: "ho-oh",
  porygon_z: "porygon-z",
  type_null: "type-null",
  jangmo_o: "jangmo-o",
  hakamo_o: "hakamo-o",
  kommo_o: "kommo-o",
  nidoran_female: "nidoran-f",
  nidoran_male: "nidoran-m",
  flabebe: "flabebe",
  jellicent: "jellicent-male",
  maushold: "maushold-family-of-four",
  meowstic: "meowstic-male",
  mimikyu: "mimikyu-disguised",
  necrozma_dawn_wings: "necrozma-dawn",
  necrozma_dusk_mane: "necrozma-dusk",
  oinkologne: "oinkologne-male",
  pikachu_libre: "pikachu-libre",
  pikachu_pop_star: "pikachu-pop-star",
  pikachu_rock_star: "pikachu-rock-star",
  pyroar: "pyroar-male",
  squawkabilly: "squawkabilly-green-plumage",
  sirfetchd: "sirfetchd",
  tauros_aqua: "tauros-paldea-aqua-breed",
  tauros_blaze: "tauros-paldea-blaze-breed",
  tauros_combat: "tauros-paldea-combat-breed",
  toxtricity: "toxtricity-amped",
  zacian_crowned_sword: "zacian-crowned",
  zacian_hero: "zacian",
  zamazenta_crowned_shield: "zamazenta-crowned",
  zamazenta_hero: "zamazenta",
  zygarde: "zygarde-50",
};

function slugCandidates(speciesId: string): readonly string[] {
  const direct = explicitAliases[speciesId] ?? speciesId.replaceAll("_", "-");
  const transformed = direct
    .replace(/-alolan$/, "-alola")
    .replace(/-galarian$/, "-galar")
    .replace(/-hisuian$/, "-hisui")
    .replace(/-paldean$/, "-paldea");
  const candidates = new Set([direct, transformed]);

  if (transformed.endsWith("-mega-x") || transformed.endsWith("-mega-y")) {
    candidates.add(transformed);
  } else if (transformed.endsWith("-mega")) {
    candidates.add(transformed);
  }

  return [...candidates];
}

function idFromPokeApiUrl(url: string): number | undefined {
  const match = url.match(/\/pokemon\/(\d+)\/?$/);
  const value = match?.[1] ? Number(match[1]) : Number.NaN;
  return Number.isInteger(value) ? value : undefined;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": "TeamLab sprite synchronizer" },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

async function downloadSprite(sourceUrl: string): Promise<Uint8Array | undefined> {
  const response = await fetch(sourceUrl, {
    headers: { "user-agent": "TeamLab sprite synchronizer" },
  });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(
      `Sprite request failed (${response.status}) for ${sourceUrl}`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

function renderManifest(
  manifest: Readonly<Record<string, SpriteManifestEntry>>,
): string {
  return `export interface PokemonSpriteAsset {
  readonly path: string;
  readonly pokeApiId: number;
  readonly match: "exact" | "base-fallback";
}

export const pokemonSpriteManifest: Readonly<
  Record<string, PokemonSpriteAsset>
> = ${JSON.stringify(manifest, null, 2)};
`;
}

async function main() {
  const gameMaster = JSON.parse(
    await readFile(gameMasterPath, "utf8"),
  ) as GameMaster;
  const pokeApiList = await fetchJson<PokeApiList>(POKEAPI_LIST_URL);
  const pokeApiIds = new Map<string, number>();

  for (const result of pokeApiList.results) {
    const id = idFromPokeApiUrl(result.url);
    if (id !== undefined) pokeApiIds.set(result.name, id);
  }

  const uniquePokemon = new Map<string, GameMasterPokemon>();
  for (const pokemon of gameMaster.pokemon) {
    if (pokemon.released === false) continue;
    const normalizedId = pokemon.speciesId.replace(/_shadow$/, "");
    if (!uniquePokemon.has(normalizedId)) {
      uniquePokemon.set(normalizedId, pokemon);
    }
  }

  await mkdir(assetDirectory, { recursive: true });
  const manifest: Record<string, SpriteManifestEntry> = {};
  const fallbacks: string[] = [];
  const resolvedPokemon = [...uniquePokemon]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([speciesId, pokemon]) => {
      const pokemonGoFile = pokemonGoFormArtwork[speciesId];
      if (pokemonGoFile) {
        const source: SpriteSource = {
          assetId: `go-${speciesId}`,
          pokeApiId: pokemon.dex,
          sourceUrl: `${POKEMINERS_SOURCE_ROOT}/${pokemonGoFile}`,
        };
        return {
          speciesId,
          pokemon,
          source,
          match: "exact" as const,
        };
      }
      const exactId = slugCandidates(speciesId)
        .map((candidate) => pokeApiIds.get(candidate))
        .find((candidate): candidate is number => candidate !== undefined);
      const resolvedId = exactId ?? pokemon.dex;
      const source: SpriteSource = {
        assetId: String(resolvedId),
        pokeApiId: resolvedId,
        sourceUrl: `${SPRITE_SOURCE_ROOT}/${resolvedId}.png`,
      };

      return {
        speciesId,
        pokemon,
        source,
        match: exactId === undefined
          ? ("base-fallback" as const)
          : ("exact" as const),
      };
    });
  const uniqueSources = [
    ...new Map(
      resolvedPokemon.map(({ source }) => [source.assetId, source]),
    ).values(),
  ];
  const missingSpriteIds = new Set<string>();
  let downloadedCount = 0;

  for (let index = 0; index < uniqueSources.length; index += 16) {
    const batch = uniqueSources.slice(index, index + 16);
    await Promise.all(
      batch.map(async (source) => {
        const outputPath = resolve(assetDirectory, `${source.assetId}.webp`);
        const sourcePath = resolve(assetDirectory, `${source.assetId}.png`);
        try {
          await access(outputPath);
        } catch {
          let image: Uint8Array | Buffer | undefined;
          try {
            image = await readFile(sourcePath);
          } catch {
            image = await downloadSprite(source.sourceUrl);
          }
          if (!image) {
            missingSpriteIds.add(source.assetId);
            return;
          }
          await mkdir(dirname(outputPath), { recursive: true });
          await sharp(image)
            .resize(256, 256, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82, alphaQuality: 90, effort: 4 })
            .toFile(outputPath);
          try {
            await unlink(sourcePath);
          } catch {
            // No source PNG remains after an earlier completed sync.
          }
          downloadedCount += 1;
        }
      }),
    );
    process.stdout.write(
      `Prepared ${Math.min(index + batch.length, uniqueSources.length)}/${uniqueSources.length} sprite files.\n`,
    );
  }

  for (const resolved of resolvedPokemon) {
    const { speciesId, pokemon } = resolved;
    const hasExactArtwork = !missingSpriteIds.has(resolved.source.assetId);
    const pokeApiId = hasExactArtwork ? resolved.source.pokeApiId : pokemon.dex;
    const match = hasExactArtwork ? resolved.match : "base-fallback";
    const assetId = hasExactArtwork ? resolved.source.assetId : String(pokemon.dex);
    const outputPath = resolve(assetDirectory, `${assetId}.webp`);

    if (match === "base-fallback") {
      fallbacks.push(
        `${speciesId} (${pokemon.speciesName}) -> National Dex ${pokemon.dex}`,
      );
    }

    manifest[speciesId] = {
      path: `/assets/pokemon/${basename(outputPath)}`,
      pokeApiId,
      match,
    };
  }

  await writeFile(manifestPath, renderManifest(manifest));
  await writeFile(
    attributionPath,
    `# Pokémon artwork attribution

Generated from PokeAPI/sprites revision \`${SPRITES_REVISION}\`.

- Source: https://github.com/PokeAPI/sprites
- Repository license: CC0 1.0 Universal
- The source license states that image contents are Copyright The Pokémon Company.
- Battle-relevant Pokémon GO form artwork: https://github.com/PokeMiners/pogo_assets/tree/${POKEMINERS_REVISION}
- PokeMiners states that its mined image contents remain property of The Pokémon Company and Niantic.
- Pokémon and Pokémon character names are trademarks of Nintendo.

Manifest SHA-256: \`${createHash("sha256")
      .update(JSON.stringify(manifest))
      .digest("hex")}\`

## Intentional base-art fallbacks

The following cosmetic or duplicate PvPoke entries use their National Dex base
artwork while retaining their exact TeamLab label.

${fallbacks.map((fallback) => `- ${fallback}`).join("\n")}
`,
  );

  process.stdout.write(
    [
      `Prepared ${uniqueSources.length} unique sprite files (${downloadedCount} downloaded).`,
      `Mapped ${Object.keys(manifest).length} PvPoke species/form IDs.`,
      `${fallbacks.length} mappings use base artwork fallbacks.`,
      `Source revision ${SPRITES_REVISION}.`,
    ].join("\n") + "\n",
  );
}

await main();
