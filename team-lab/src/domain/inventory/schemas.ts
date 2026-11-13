import { LEAGUE_IDS } from "@/domain/leagues";
import { z } from "zod";

import { INVENTORY_RECORD_SCHEMA_VERSION } from "@/domain/schemaVersions";
import { LEGACY_MEGA_LEVELS } from "./legacyMegaLevels";

export { INVENTORY_RECORD_SCHEMA_VERSION } from "@/domain/schemaVersions";

const inventoryIdSchema = z.string().uuid();
const speciesIdSchema = z.string().trim().min(1).max(120);
const moveIdSchema = z.string().trim().min(1).max(120);
const ivValueSchema = z.number().int().min(0).max(15);
const cpSchema = z.number().int().min(10).max(10000);
export const megaLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const inventoryIvsSchema = z.object({
  attack: ivValueSchema,
  defense: ivValueSchema,
  hp: ivValueSchema,
});

export const inventoryIvProfileSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("user-entered"),
    ivs: inventoryIvsSchema,
  }),
  z.object({
    source: z.literal("assumed-rank-1"),
    ivs: inventoryIvsSchema,
  }),
]);

export const inventoryMovesetSchema = z
  .object({
    fastMoveId: moveIdSchema,
    chargedMoveIds: z.array(moveIdSchema).min(1).max(2),
    extraChargedMoveId: moveIdSchema.optional(),
  })
  .superRefine((moveset, context) => {
    const allChargedMoves = [...moveset.chargedMoveIds, ...(moveset.extraChargedMoveId ? [moveset.extraChargedMoveId] : [])];
    if (new Set(allChargedMoves).size !== allChargedMoves.length) {
      context.addIssue({
        code: "custom",
        message: "Charged moves must be unique.",
        path: ["chargedMoveIds"],
      });
    }
  });

export const inventoryBuildSchema = z.object({
  megaLevel: megaLevelSchema.optional(),
  cp: cpSchema,
  ivProfile: inventoryIvProfileSchema,
  moveset: inventoryMovesetSchema,
});

export const plannedInventoryBuildSchema = z.object({
  megaLevel: megaLevelSchema.optional(),
  targetSpeciesId: speciesIdSchema,
  targetCp: cpSchema.optional(),
  desiredMoveset: inventoryMovesetSchema,
});

const inventoryMetadataShape = {
  formatId: z.enum(LEAGUE_IDS).optional(),
  megaSpeciesId: speciesIdSchema.optional(),
  schemaVersion: z.literal(INVENTORY_RECORD_SCHEMA_VERSION),
  inventoryId: inventoryIdSchema,
  favorite: z.boolean(),
  notes: z.string().trim().max(2000),
  sourceDataVersion: z.string().trim().min(1).max(200),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

const currentInventoryPokemonSchema = z.object({
  ...inventoryMetadataShape,
  buildStatus: z.literal("current"),
  speciesId: speciesIdSchema,
  currentBuild: inventoryBuildSchema,
});

const plannedInventoryPokemonSchema = z.object({
  ...inventoryMetadataShape,
  buildStatus: z.literal("planned"),
  speciesId: speciesIdSchema,
  currentBuild: inventoryBuildSchema,
  plannedBuild: plannedInventoryBuildSchema,
});

const currentInventoryPokemonRecordSchema = z
  .discriminatedUnion("buildStatus", [
    currentInventoryPokemonSchema,
    plannedInventoryPokemonSchema,
  ])
  .superRefine((record, context) => {
    const cpCap = 10000;
    if (record.currentBuild.cp > cpCap) {
      context.addIssue({
        code: "custom",
        path: ["currentBuild", "cp"],
        message: `CP must be at most ${cpCap} for this league.`,
      });
    }
    if (record.buildStatus === "planned" && (record.plannedBuild.targetCp ?? 0) > cpCap) {
      context.addIssue({
        code: "custom",
        path: ["plannedBuild", "targetCp"],
        message: `Target CP must be at most ${cpCap} for this league.`,
      });
    }
    if (Date.parse(record.updatedAt) < Date.parse(record.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "updatedAt cannot be earlier than createdAt.",
        path: ["updatedAt"],
      });
    }
  });

const legacyInventoryMigrationSchema = z.object({
    schemaVersion: z.literal(1), speciesId: speciesIdSchema,
    megaSpeciesId: speciesIdSchema.optional(),
    currentBuild: z.object({
      cp: cpSchema, ivProfile: inventoryIvProfileSchema,
      moveset: z.object({ fastMoveId: moveIdSchema, chargedMoveIds: z.array(moveIdSchema).min(1).max(2) }).strict(),
    }).strict(),
    plannedBuild: z.object({
      targetSpeciesId: speciesIdSchema, targetCp: cpSchema.optional(),
      desiredMoveset: z.object({ fastMoveId: moveIdSchema, chargedMoveIds: z.array(moveIdSchema).min(1).max(2) }).strict(),
    }).strict().optional(),
  }).passthrough();

/** Version-specific reader. Older builds never gain a new attack or changed
 * CP during migration. Reject new settings mislabeled as the legacy schema. */
function migrateLegacyInventoryRecord(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("schemaVersion" in value) || value.schemaVersion !== 1) return value;
  const legacy = legacyInventoryMigrationSchema.safeParse(value);
  if (!legacy.success) return value; // Current parser reports the invalid version/shape.
  const record = legacy.data;
  return {
    ...record, schemaVersion: INVENTORY_RECORD_SCHEMA_VERSION,
    currentBuild: { ...record.currentBuild, megaLevel: LEGACY_MEGA_LEVELS[record.megaSpeciesId ?? record.speciesId] },
    ...(record.plannedBuild ? { plannedBuild: { ...record.plannedBuild, megaLevel: LEGACY_MEGA_LEVELS[record.plannedBuild.targetSpeciesId] } } : {}),
  };
}

export const inventoryPokemonSchema = z.preprocess(migrateLegacyInventoryRecord, currentInventoryPokemonRecordSchema);
export const inventoryPokemonArraySchema = z.array(inventoryPokemonSchema);

export type InventoryIvs = z.infer<typeof inventoryIvsSchema>;
export type InventoryIvProfile = z.infer<typeof inventoryIvProfileSchema>;
export type InventoryMoveset = z.infer<typeof inventoryMovesetSchema>;
export type InventoryBuild = z.infer<typeof inventoryBuildSchema>;
export type PlannedInventoryBuild = z.infer<
  typeof plannedInventoryBuildSchema
>;
export type InventoryPokemon = z.infer<typeof inventoryPokemonSchema>;
export type CurrentInventoryPokemon = Extract<
  InventoryPokemon,
  { buildStatus: "current" }
>;
export type PlannedInventoryPokemon = Extract<
  InventoryPokemon,
  { buildStatus: "planned" }
>;
