import { z } from "zod";

import { INVENTORY_RECORD_SCHEMA_VERSION } from "@/domain/schemaVersions";

export { INVENTORY_RECORD_SCHEMA_VERSION } from "@/domain/schemaVersions";

const inventoryIdSchema = z.string().uuid();
const speciesIdSchema = z.string().trim().min(1).max(120);
const moveIdSchema = z.string().trim().min(1).max(120);
const ivValueSchema = z.number().int().min(0).max(15);
const cpSchema = z.number().int().min(10).max(1500);

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
  })
  .superRefine((moveset, context) => {
    if (new Set(moveset.chargedMoveIds).size !== moveset.chargedMoveIds.length) {
      context.addIssue({
        code: "custom",
        message: "Charged moves must be unique.",
        path: ["chargedMoveIds"],
      });
    }
  });

export const inventoryBuildSchema = z.object({
  cp: cpSchema,
  ivProfile: inventoryIvProfileSchema,
  moveset: inventoryMovesetSchema,
});

export const plannedInventoryBuildSchema = z.object({
  targetSpeciesId: speciesIdSchema,
  targetCp: cpSchema.optional(),
  desiredMoveset: inventoryMovesetSchema,
});

const inventoryMetadataShape = {
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

export const inventoryPokemonSchema = z
  .discriminatedUnion("buildStatus", [
    currentInventoryPokemonSchema,
    plannedInventoryPokemonSchema,
  ])
  .superRefine((record, context) => {
    if (Date.parse(record.updatedAt) < Date.parse(record.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "updatedAt cannot be earlier than createdAt.",
        path: ["updatedAt"],
      });
    }
  });

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
