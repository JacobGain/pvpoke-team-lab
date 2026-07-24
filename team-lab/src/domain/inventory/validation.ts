import type {
  InventoryMoveset,
  InventoryPokemon,
} from "@/domain/inventory/schemas";
import type {
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";

export interface InventoryValidationIssue {
  readonly code:
    | "species-not-found"
    | "target-species-not-found"
    | "fast-move-not-found"
    | "charged-move-not-found"
    | "assumed-ivs-unavailable";
  readonly path: string;
  readonly message: string;
}

export class InventoryCatalogValidationError extends Error {
  readonly issues: readonly InventoryValidationIssue[];

  constructor(issues: readonly InventoryValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "InventoryCatalogValidationError";
    this.issues = issues;
  }
}

function validateMoveset(
  moveset: InventoryMoveset,
  pokemon: PokemonCatalogEntry,
  path: string,
): InventoryValidationIssue[] {
  const issues: InventoryValidationIssue[] = [];
  const fastMoveIds = new Set(pokemon.fastMoves.map((move) => move.id));
  const chargedMoveIds = new Set(
    pokemon.chargedMoves.map((move) => move.id),
  );

  if (!fastMoveIds.has(moveset.fastMoveId)) {
    issues.push({
      code: "fast-move-not-found",
      path: `${path}.fastMoveId`,
      message: `${moveset.fastMoveId} is not a fast move for ${pokemon.speciesName}.`,
    });
  }

  for (const [index, moveId] of moveset.chargedMoveIds.entries()) {
    if (!chargedMoveIds.has(moveId)) {
      issues.push({
        code: "charged-move-not-found",
        path: `${path}.chargedMoveIds.${index}`,
        message: `${moveId} is not a charged move for ${pokemon.speciesName}.`,
      });
    }
  }

  return issues;
}

export function validateInventoryPokemonAgainstCatalog(
  record: InventoryPokemon,
  catalog: PokemonCatalog,
): readonly InventoryValidationIssue[] {
  const entries = new Map(
    catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const currentPokemon = entries.get(record.speciesId);
  const issues: InventoryValidationIssue[] = [];

  if (!currentPokemon) {
    return [
      {
        code: "species-not-found",
        path: "speciesId",
        message: `${record.speciesId} does not exist in catalog ${catalog.dataVersion}.`,
      },
    ];
  }

  issues.push(
    ...validateMoveset(
      record.currentBuild.moveset,
      currentPokemon,
      "currentBuild.moveset",
    ),
  );

  if (
    record.currentBuild.ivProfile.source === "assumed-rank-1" &&
    !currentPokemon.defaultGreatLeagueIvs
  ) {
    issues.push({
      code: "assumed-ivs-unavailable",
      path: "currentBuild.ivProfile",
      message: `${currentPokemon.speciesName} has no upstream default Great League IV spread.`,
    });
  }

  if (record.buildStatus === "planned") {
    const targetPokemon = entries.get(record.plannedBuild.targetSpeciesId);

    if (!targetPokemon) {
      issues.push({
        code: "target-species-not-found",
        path: "plannedBuild.targetSpeciesId",
        message: `${record.plannedBuild.targetSpeciesId} does not exist in catalog ${catalog.dataVersion}.`,
      });
    } else {
      issues.push(
        ...validateMoveset(
          record.plannedBuild.desiredMoveset,
          targetPokemon,
          "plannedBuild.desiredMoveset",
        ),
      );
    }
  }

  return issues;
}

export function assertInventoryPokemonAgainstCatalog(
  record: InventoryPokemon,
  catalog: PokemonCatalog,
): void {
  const issues = validateInventoryPokemonAgainstCatalog(record, catalog);

  if (issues.length > 0) {
    throw new InventoryCatalogValidationError(issues);
  }
}
