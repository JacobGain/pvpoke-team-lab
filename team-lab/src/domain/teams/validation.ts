import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import {
  getSavedTeamInventoryIds,
  type SavedTeam,
  type SavedTeamPosition,
} from "@/domain/teams/schemas";

export interface SavedTeamValidationIssue {
  readonly code:
    | "inventory-record-not-found"
    | "species-not-found"
    | "species-clause";
  readonly path: string;
  readonly message: string;
}

export class SavedTeamLegalityError extends Error {
  readonly issues: readonly SavedTeamValidationIssue[];

  constructor(issues: readonly SavedTeamValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "SavedTeamLegalityError";
    this.issues = issues;
  }
}

const positions: readonly SavedTeamPosition[] = [
  "lead",
  "switch",
  "closer",
];

function resolveTeamSpeciesId(record: InventoryPokemon): string {
  return record.buildStatus === "planned"
    ? record.plannedBuild.targetSpeciesId
    : record.speciesId;
}

export function validateSavedTeamLegality(
  team: SavedTeam,
  inventory: readonly InventoryPokemon[],
  catalog: PokemonCatalog,
): readonly SavedTeamValidationIssue[] {
  const inventoryById = new Map(
    inventory.map((record) => [record.inventoryId, record]),
  );
  const catalogById = new Map(
    catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const resolvedMembers: {
    readonly position: SavedTeamPosition;
    readonly speciesName: string;
    readonly dex: number;
  }[] = [];
  const issues: SavedTeamValidationIssue[] = [];

  for (const [index, inventoryId] of getSavedTeamInventoryIds(
    team.members,
  ).entries()) {
    const position = positions[index]!;
    const path = `members.${position}InventoryId`;
    const record = inventoryById.get(inventoryId);

    if (!record) {
      issues.push({
        code: "inventory-record-not-found",
        path,
        message: `The ${position} inventory record ${inventoryId} does not exist.`,
      });
      continue;
    }

    const speciesId = resolveTeamSpeciesId(record);
    const pokemon = catalogById.get(speciesId);

    if (!pokemon) {
      issues.push({
        code: "species-not-found",
        path,
        message: `${speciesId} does not exist in catalog ${catalog.dataVersion}.`,
      });
      continue;
    }

    resolvedMembers.push({
      position,
      speciesName: pokemon.speciesName,
      dex: pokemon.dex,
    });
  }

  for (const member of resolvedMembers) {
    const firstMember = resolvedMembers.find(
      (candidate) => candidate.dex === member.dex,
    );

    if (firstMember && firstMember.position !== member.position) {
      issues.push({
        code: "species-clause",
        path: `members.${member.position}InventoryId`,
        message: `${member.speciesName} conflicts with the ${firstMember.position} under species clause.`,
      });
    }
  }

  return issues;
}

export function assertSavedTeamLegality(
  team: SavedTeam,
  inventory: readonly InventoryPokemon[],
  catalog: PokemonCatalog,
): void {
  const issues = validateSavedTeamLegality(team, inventory, catalog);

  if (issues.length > 0) {
    throw new SavedTeamLegalityError(issues);
  }
}
