import { teamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieInventoryRepository } from "@/infrastructure/inventory/DexieInventoryRepository";

export const inventoryRepository = new DexieInventoryRepository(
  teamLabDatabase,
);

export { DexieInventoryRepository };
