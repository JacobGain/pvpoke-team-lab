import { inventoryPokemonSchema, type InventoryPokemon } from "@/domain/inventory/schemas";
import {
  type InventoryRepository,
  InvalidStoredInventoryRecordError,
  InventoryRecordAlreadyExistsError,
  InventoryRecordNotFoundError,
} from "@/domain/inventory/repository";
import type { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";

function parseStoredRecord(value: unknown): InventoryPokemon {
  const result = inventoryPokemonSchema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const inventoryId =
    typeof value === "object" &&
    value !== null &&
    "inventoryId" in value &&
    typeof value.inventoryId === "string"
      ? value.inventoryId
      : "unknown";

  throw new InvalidStoredInventoryRecordError(inventoryId, result.error);
}

export class DexieInventoryRepository implements InventoryRepository {
  constructor(private readonly database: TeamLabDatabase) {}

  async list(): Promise<readonly InventoryPokemon[]> {
    const records = await this.database.inventory
      .orderBy("updatedAt")
      .reverse()
      .toArray();

    return records.map(parseStoredRecord);
  }

  async get(inventoryId: string): Promise<InventoryPokemon | undefined> {
    const record = await this.database.inventory.get(inventoryId);
    return record === undefined ? undefined : parseStoredRecord(record);
  }

  async create(record: InventoryPokemon): Promise<void> {
    const validatedRecord = inventoryPokemonSchema.parse(record);

    try {
      await this.database.inventory.add(validatedRecord);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "ConstraintError"
      ) {
        throw new InventoryRecordAlreadyExistsError(record.inventoryId);
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "ConstraintError"
      ) {
        throw new InventoryRecordAlreadyExistsError(record.inventoryId);
      }

      throw error;
    }
  }

  async update(record: InventoryPokemon): Promise<void> {
    const validatedRecord = inventoryPokemonSchema.parse(record);
    const updatedCount = await this.database.inventory.update(
      record.inventoryId,
      validatedRecord,
    );

    if (updatedCount === 0) {
      throw new InventoryRecordNotFoundError(record.inventoryId);
    }
  }

  async delete(inventoryId: string): Promise<void> {
    const existingRecord = await this.database.inventory.get(inventoryId);

    if (existingRecord === undefined) {
      throw new InventoryRecordNotFoundError(inventoryId);
    }

    await this.database.inventory.delete(inventoryId);
  }

  count(): Promise<number> {
    return this.database.inventory.count();
  }

  clear(): Promise<void> {
    return this.database.inventory.clear();
  }
}
