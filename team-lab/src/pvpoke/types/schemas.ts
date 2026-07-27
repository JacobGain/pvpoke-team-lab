import { z } from "zod";

const idSchema = z.string().min(1);
const typeSchema = z.string().min(1);

export const ivCombinationSchema = z.tuple([
  z.number(),
  z.number().int().min(0).max(15),
  z.number().int().min(0).max(15),
  z.number().int().min(0).max(15),
]);

export const pokemonSchema = z
  .object({
    dex: z.number().int().nonnegative(),
    speciesName: z.string().min(1),
    speciesId: idSchema,
    baseStats: z.object({
      atk: z.number().positive(),
      def: z.number().positive(),
      hp: z.number().positive(),
    }),
    types: z.array(typeSchema).min(1).max(2),
    fastMoves: z.array(idSchema),
    chargedMoves: z.array(idSchema),
    defaultIVs: z.record(z.string(), ivCombinationSchema).optional(),
    tags: z.array(idSchema).optional(),
    legacyMoves: z.array(idSchema).optional(),
    eliteMoves: z.array(idSchema).optional(),
    released: z.boolean(),
    levelFloor: z.number().optional(),
    levelCap: z.number().optional(),
    family: z
      .object({
        id: idSchema.optional(),
        parent: idSchema.optional(),
        evolutions: z.array(idSchema).optional(),
      })
      .optional(),
  })
  .passthrough();

export const moveSchema = z
  .object({
    moveId: idSchema,
    name: z.string().min(1),
    type: typeSchema,
    power: z.number(),
    energy: z.number(),
    energyGain: z.number(),
    cooldown: z.number().nonnegative(),
    turns: z.number().positive().optional(),
    archetype: z.string().optional(),
    abbreviation: z.string().optional(),
    buffs: z.tuple([z.number(), z.number()]).optional(),
    buffApplyChance: z.coerce.number().min(0).max(1).optional(),
    buffTarget: z.enum(["self", "opponent", "both"]).optional(),
  })
  .passthrough();

export const formatSchema = z
  .object({
    title: z.string().min(1),
    cup: idSchema,
    cp: z.number().int().positive(),
    meta: idSchema,
    showCup: z.boolean().optional(),
    showFormat: z.boolean().optional(),
    showMeta: z.boolean().optional(),
    hideRankings: z.boolean().optional(),
    rules: z.array(z.string()).optional(),
  })
  .passthrough();

export const cupFilterSchema = z
  .object({
    filterType: z.string().min(1),
    values: z.array(z.unknown()),
  })
  .passthrough();

export const cupSchema = z
  .object({
    name: idSchema,
    title: z.string().min(1),
    include: z.array(cupFilterSchema),
    exclude: z.array(cupFilterSchema),
    league: z.number().int().positive().optional(),
    levelCap: z.number().positive().optional(),
    rankingAlias: idSchema.optional(),
  })
  .passthrough();

export const gameMasterSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    timestamp: z.string().min(1),
    settings: z.object({
      partySize: z.number().int().positive(),
      maxBuffStages: z.number().int().nonnegative(),
      buffDivisor: z.number().positive(),
    }),
    pokemon: z.array(pokemonSchema),
    moves: z.array(moveSchema),
    formats: z.array(formatSchema),
    cups: z.array(cupSchema),
  })
  .passthrough();

export const rankedMatchupSchema = z.object({
  opponent: idSchema,
  rating: z.number(),
});

export const rankingMoveUsageSchema = z.object({
  moveId: idSchema,
  uses: z.number().nonnegative().nullable(),
});

export const rankingSchema = z
  .object({
    speciesId: idSchema,
    speciesName: z.string().min(1),
    rating: z.number(),
    matchups: z.array(rankedMatchupSchema),
    counters: z.array(rankedMatchupSchema),
    moves: z
      .object({
        fastMoves: z.array(rankingMoveUsageSchema),
        chargedMoves: z.array(rankingMoveUsageSchema),
      })
      .optional(),
    moveset: z.array(idSchema),
    score: z.number(),
    scores: z.array(z.number()),
    editorScore: z.number().optional(),
    editorNotes: z.string().optional(),
    stats: z
      .object({
        product: z.number(),
        atk: z.number(),
        def: z.number(),
        hp: z.number(),
      })
      .optional(),
  })
  .passthrough();

export const rankingCollectionSchema = z.array(rankingSchema);

export const metaGroupEntrySchema = z
  .object({
    speciesId: idSchema,
    fastMove: idSchema.optional(),
    chargedMoves: z.array(idSchema).optional(),
  })
  .passthrough();

export const metaGroupSchema = z.array(metaGroupEntrySchema);

export type GameMasterData = z.infer<typeof gameMasterSchema>;
export type PokemonData = z.infer<typeof pokemonSchema>;
export type MoveData = z.infer<typeof moveSchema>;
export type FormatData = z.infer<typeof formatSchema>;
export type CupData = z.infer<typeof cupSchema>;
export type Ranking = z.infer<typeof rankingSchema>;
export type MetaGroupEntry = z.infer<typeof metaGroupEntrySchema>;
