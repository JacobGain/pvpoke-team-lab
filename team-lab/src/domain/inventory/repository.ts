import type { InventoryPokemon } from "@/domain/inventory/schemas";

export type InventoryRestoreMode = "merge" | "replace";

export interface InventoryRestoreResult {
  readonly mode: InventoryRestoreMode;
  readonly incoming: number;
  readonly inserted: number;
  readonly updated: number;
  readonly removed: number;
  readonly finalCount: number;
}

export interface InventoryRepository {
  list(): Promise<readonly InventoryPokemon[]>;
  get(inventoryId: string): Promise<InventoryPokemon | undefined>;
  create(record: InventoryPokemon): Promise<void>;
  update(record: InventoryPokemon): Promise<void>;
  delete(inventoryId: string): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
  restore(
    records: readonly InventoryPokemon[],
    mode: InventoryRestoreMode,
  ): Promise<InventoryRestoreResult>;
}

export class InventoryRecordAlreadyExistsError extends Error {
  constructor(inventoryId: string) {
    super(`Inventory record ${inventoryId} already exists.`);
    this.name = "InventoryRecordAlreadyExistsError";
  }
}

export class InventoryRecordNotFoundError extends Error {
  constructor(inventoryId: string) {
    super(`Inventory record ${inventoryId} does not exist.`);
    this.name = "InventoryRecordNotFoundError";
  }
}

export class InvalidStoredInventoryRecordError extends Error {
  readonly inventoryId: string;
  override readonly cause: unknown;

  constructor(inventoryId: string, cause: unknown) {
    super(
      `Stored inventory record ${inventoryId} does not match a supported schema.`,
    );
    this.name = "InvalidStoredInventoryRecordError";
    this.inventoryId = inventoryId;
    this.cause = cause;
  }
}
