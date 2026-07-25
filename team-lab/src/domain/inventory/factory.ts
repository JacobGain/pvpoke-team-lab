import {
  INVENTORY_RECORD_SCHEMA_VERSION,
  inventoryPokemonSchema,
  type InventoryBuild,
  type InventoryIvs,
  type InventoryMoveset,
  type InventoryPokemon,
  type PlannedInventoryBuild,
} from "@/domain/inventory/schemas";
import { assertInventoryPokemonAgainstCatalog } from "@/domain/inventory/validation";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";

export interface InventoryFactoryDependencies {
  readonly catalog: PokemonCatalog;
  readonly createId?: () => string;
  readonly now?: () => Date;
}

interface InventoryInputBase {
  readonly speciesId: string;
  readonly currentBuild: InventoryBuildInput;
  readonly favorite?: boolean;
  readonly notes?: string;
}

export type InventoryIvInput =
  | { readonly source: "user-entered"; readonly ivs: InventoryIvs }
  | { readonly source: "assumed-rank-1" };

export interface InventoryBuildInput {
  readonly cp: number;
  readonly ivProfile: InventoryIvInput;
  readonly moveset: InventoryMoveset;
}

export interface CurrentInventoryInput extends InventoryInputBase {
  readonly buildStatus: "current";
}

export interface PlannedInventoryInput extends InventoryInputBase {
  readonly buildStatus: "planned";
  readonly plannedBuild: PlannedInventoryBuild;
}

export type CreateInventoryPokemonInput =
  | CurrentInventoryInput
  | PlannedInventoryInput;

function resolveBuild(
  input: InventoryBuildInput,
  speciesId: string,
  catalog: PokemonCatalog,
): InventoryBuild {
  if (input.ivProfile.source === "user-entered") {
    return {
      cp: input.cp,
      ivProfile: input.ivProfile,
      moveset: input.moveset,
    };
  }

  const pokemon = catalog.entries.find(
    (entry) => entry.speciesId === speciesId,
  );
  const defaultIvs = pokemon?.defaultGreatLeagueIvs;

  if (!pokemon || !defaultIvs) {
    throw new Error(
      `Cannot assume rank-one IVs for ${speciesId}; the catalog has no default spread.`,
    );
  }

  return {
    cp: input.cp,
    ivProfile: {
      source: "assumed-rank-1",
      ivs: {
        attack: defaultIvs.attack,
        defense: defaultIvs.defense,
        hp: defaultIvs.hp,
      },
    },
    moveset: input.moveset,
  };
}

export function createInventoryPokemon(
  input: CreateInventoryPokemonInput,
  dependencies: InventoryFactoryDependencies,
): InventoryPokemon {
  const now = (dependencies.now ?? (() => new Date()))().toISOString();
  const metadata = {
    schemaVersion: INVENTORY_RECORD_SCHEMA_VERSION,
    inventoryId:
      dependencies.createId?.() ?? globalThis.crypto.randomUUID(),
    favorite: input.favorite ?? false,
    notes: input.notes ?? "",
    sourceDataVersion: dependencies.catalog.dataVersion,
    createdAt: now,
    updatedAt: now,
  };
  const currentBuild = resolveBuild(
    input.currentBuild,
    input.speciesId,
    dependencies.catalog,
  );
  const candidate =
    input.buildStatus === "planned"
      ? {
          ...metadata,
          buildStatus: input.buildStatus,
          speciesId: input.speciesId,
          currentBuild,
          plannedBuild: input.plannedBuild,
        }
      : {
          ...metadata,
          buildStatus: input.buildStatus,
          speciesId: input.speciesId,
          currentBuild,
        };
  const record = inventoryPokemonSchema.parse(candidate);

  assertInventoryPokemonAgainstCatalog(record, dependencies.catalog);
  return record;
}

export function touchInventoryPokemon(
  record: InventoryPokemon,
  now: () => Date = () => new Date(),
): InventoryPokemon {
  return inventoryPokemonSchema.parse({
    ...record,
    updatedAt: now().toISOString(),
  });
}

export function updateInventoryPokemon(
  existingRecord: InventoryPokemon,
  input: CreateInventoryPokemonInput,
  dependencies: InventoryFactoryDependencies,
): InventoryPokemon {
  const updatedAt = (dependencies.now ?? (() => new Date()))().toISOString();
  const currentBuild = resolveBuild(
    input.currentBuild,
    input.speciesId,
    dependencies.catalog,
  );
  const metadata = {
    schemaVersion: INVENTORY_RECORD_SCHEMA_VERSION,
    inventoryId: existingRecord.inventoryId,
    favorite: input.favorite ?? false,
    notes: input.notes ?? "",
    sourceDataVersion: dependencies.catalog.dataVersion,
    createdAt: existingRecord.createdAt,
    updatedAt,
  };
  const candidate =
    input.buildStatus === "planned"
      ? {
          ...metadata,
          buildStatus: input.buildStatus,
          speciesId: input.speciesId,
          currentBuild,
          plannedBuild: input.plannedBuild,
        }
      : {
          ...metadata,
          buildStatus: input.buildStatus,
          speciesId: input.speciesId,
          currentBuild,
        };
  const record = inventoryPokemonSchema.parse(candidate);

  assertInventoryPokemonAgainstCatalog(record, dependencies.catalog);
  return record;
}
