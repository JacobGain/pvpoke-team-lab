import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import { serializeAnalyzedBuildForSimulation } from "@/domain/simulation/buildSerialization";
import type { ShieldCount } from "@/domain/simulation/contracts";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import { resolveSavedTeam } from "@/domain/teams/resolution";
import type { SavedTeam } from "@/domain/teams/schemas";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import {
  prepareTeamRankerRequest,
  TeamRankerPreparationError,
  type MetaTargetLimit,
  type OrderedExactTeamBuilds,
  type TeamRankerPreparedRequest,
} from "@/domain/simulation/teamRanker";

export {
  META_TARGET_LIMITS,
  TeamRankerPreparationError as SavedTeamSimulationPreparationError,
  TeamRankingService as SavedTeamRankingService,
} from "@/domain/simulation/teamRanker";
export type {
  MetaTargetLimit,
  TeamMemberScoreEvidence as SavedTeamMemberScoreEvidence,
  TeamRankerPreparedRequest as SavedTeamRankerPreparedRequest,
  TeamRankerRun as SavedTeamRankerRun,
  TeamRankerScope as SavedTeamRankerScope,
  TeamScoreEvidence as SavedTeamScoreEvidence,
  TeamTargetScoreEvidence as SavedTeamTargetScoreEvidence,
} from "@/domain/simulation/teamRanker";

export function prepareSavedTeamRankerRequest(
  team: SavedTeam,
  inventory: readonly InventoryPokemon[],
  catalog: PokemonCatalog,
  options: {
    readonly targetLimit: MetaTargetLimit;
    readonly teamShields: ShieldCount;
    readonly targetShields: ShieldCount;
  },
): TeamRankerPreparedRequest {
  const resolved = resolveSavedTeam(team, inventory, catalog.entries);

  if (!resolved.isComplete) {
    throw new TeamRankerPreparationError(
      "Every saved-team member must resolve before simulation.",
    );
  }

  const teamBuilds = resolved.members.map((member) => {
    if (member.status !== "resolved") {
      throw new TeamRankerPreparationError(
        `${member.position} could not be resolved.`,
      );
    }

    const analysis = analyzeInventoryBuild(member.inventory, catalog);
    const build =
      member.inventory.buildStatus === "planned"
        ? analysis.planned
        : analysis.current;

    if (!build) {
      throw new TeamRankerPreparationError(
        `${member.pokemon.speciesName} has no analyzable selected build.`,
      );
    }

    return serializeAnalyzedBuildForSimulation(build, member.pokemon);
  });
  const orderedTeamBuilds: OrderedExactTeamBuilds = [
    teamBuilds[0]!,
    teamBuilds[1]!,
    teamBuilds[2]!,
  ];

  return prepareTeamRankerRequest(orderedTeamBuilds, catalog, {
    context: {
      kind: "saved-team",
      id: team.teamId,
      name: team.name,
    },
    targetLimit: options.targetLimit,
    teamShields: options.teamShields,
    targetShields: options.targetShields,
  });
}
