import { describe, expect, it } from "vitest";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import { buildRecommendationCandidatePool } from "@/domain/recommendations/candidatePool";
import { recommendationRequestSchema } from "@/domain/recommendations/contracts";
import {
  RecommendationFinalistDataVersionError,
  RecommendationFinalistSimulationService,
  RECOMMENDATION_FINAL_SCORE_VERSION,
} from "@/domain/recommendations/finalistSimulation";
import { explainRecommendation } from "@/domain/recommendations/explanations";
import { generateStaticRecommendationTeams } from "@/domain/recommendations/staticTeamGeneration";
import type {
  TeamRankerAdapter,
  TeamRankerRequest,
  TeamRankerResult,
} from "@/domain/simulation/contracts";

const ids = {
  azumarill: "78ce2157-a008-49a1-bbcc-563998b76800",
  altaria: "fd17fe2f-1d87-4879-8850-d95476cd9070",
  whiscash: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
  noctowl: "e6d7265f-a0ba-4ee6-b94a-bf83390e1220",
};

const rankedCatalog: PokemonCatalog = {
  ...inventoryTestCatalog,
  entries: inventoryTestCatalog.entries.map((pokemon) =>
    pokemon.speciesId === "whiscash"
      ? {
          ...pokemon,
          ranking: {
            rank: 50,
            score: 78,
            rating: 510,
            recommendedMoveIds: ["MUD_SHOT", "SCALD", "BLIZZARD"],
            matchups: [{ speciesId: "azumarill", rating: 620 }],
            counters: [{ speciesId: "altaria", rating: 300 }],
            roleScores: {
              lead: 60,
              closer: 80,
              switch: 90,
              charger: 75,
              attacker: 72,
              consistency: 76,
            },
          },
        }
      : pokemon,
  ),
};

const settings = {
  azumarill: {
    cp: 1499,
    fastMoveId: "BUBBLE",
    chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
  },
  altaria: {
    cp: 1497,
    fastMoveId: "DRAGON_BREATH",
    chargedMoveIds: ["SKY_ATTACK", "MOONBLAST"],
  },
  whiscash: {
    cp: 1495,
    fastMoveId: "MUD_SHOT",
    chargedMoveIds: ["SCALD", "BLIZZARD"],
  },
} as const;

function record(
  speciesId: keyof typeof settings,
  inventoryId: string,
  catalog: PokemonCatalog = rankedCatalog,
): InventoryPokemon {
  const build = settings[speciesId];

  return createInventoryPokemon(
    {
      buildStatus: "current",
      speciesId,
      currentBuild: {
        cp: build.cp,
        ivProfile: { source: "assumed-rank-1" },
        moveset: {
          fastMoveId: build.fastMoveId,
          chargedMoveIds: [...build.chargedMoveIds],
        },
      },
    },
    {
      catalog,
      createId: () => inventoryId,
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    },
  );
}

function staticGeneration(
  inventory: readonly InventoryPokemon[],
  catalog: PokemonCatalog = rankedCatalog,
  resultCount = 3,
) {
  const request = recommendationRequestSchema.parse({
    formatId: "great-league",
    anchors: [{ inventoryId: ids.azumarill, position: "flex" }],
    resultCount,
    buildStatusScope: "all",
  });
  const pool = buildRecommendationCandidatePool(
    request,
    inventory,
    catalog,
  );
  return generateStaticRecommendationTeams(pool);
}

class DeterministicAdapter implements TeamRankerAdapter {
  readonly requests: TeamRankerRequest[] = [];

  rank(request: TeamRankerRequest): Promise<TeamRankerResult> {
    this.requests.push(request);
    const hasNoctowl = request.team.some(
      (member) => member.speciesId === "noctowl",
    );
    const ratings = hasNoctowl ? [300, 350, 400] : [600, 650, 700];

    return Promise.resolve({
      rankings: request.targets.map((target) => ({
        speciesId: target.speciesId,
        speciesName: target.speciesName,
        averageRating:
          ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
        score: 500,
        matchups: request.team.map((member, index) => ({
          opponentSpeciesId: member.speciesId,
          rating: ratings[index]!,
          score: ratings[index]!,
          durationMs: 30_000,
          fastMoveDamage: 3,
          incomingFastMoveDamage: 4,
          attackDifferential: 0,
        })),
      })),
      teamRatings: request.team.map(() =>
        request.targets.map(() => 500),
      ),
      battleCount: request.team.length * request.targets.length,
      dataVersion: request.dataVersion,
      engine: "pvpoke-team-ranker",
      assumptions: ["Synthetic exact matrix"],
    });
  }
}

describe("recommendation finalist simulation", () => {
  it("simulates exact ordered finalists and derives Phase 6 evidence", async () => {
    const inventory = [
      record("azumarill", ids.azumarill),
      record("altaria", ids.altaria),
      record("whiscash", ids.whiscash),
    ];
    const generation = staticGeneration(inventory);
    const adapter = new DeterministicAdapter();
    const times = [0, 100];
    const service = new RecommendationFinalistSimulationService(
      adapter,
      () => times.shift()!,
      () => new Date("2026-07-25T18:00:00.000Z"),
    );
    const progress: string[] = [];
    const result = await service.simulate(
      generation,
      inventory,
      rankedCatalog,
      { targetLimit: 5, teamShields: 1, targetShields: 1 },
      {
        onProgress: (event) => {
          progress.push(
            `${event.status}:${event.completedFinalists}/${event.totalFinalists}`,
          );
        },
      },
    );

    expect(adapter.requests).toHaveLength(1);
    expect(adapter.requests[0]!.team.map((build) => build.speciesId)).toEqual(
      generation.finalists[0]
        ? [
            generation.finalists[0].orderedMembers.lead.speciesId,
            generation.finalists[0].orderedMembers.switch.speciesId,
            generation.finalists[0].orderedMembers.closer.speciesId,
          ]
        : [],
    );
    expect(result.completed[0]).toMatchObject({
      run: {
        scope: {
          context: {
            kind: "recommendation",
            id: generation.finalists[0]!.teamKey,
          },
          teamShields: 1,
          targetShields: 1,
        },
        durationMs: 100,
      },
      analysis: {
        dataVersion: "test-data-v1",
        shieldScenario: "1-1",
      },
      finalScore: {
        version: RECOMMENDATION_FINAL_SCORE_VERSION,
      },
      alternatives: {
        counterEvidenceSource: "pvpoke-overall-ranking-counters",
      },
    });
    expect(result.selected).toHaveLength(1);
    expect(result.requestedResultCount).toBe(3);
    expect(result.selectionShortfall).toBe(2);
    expect(progress).toEqual(["starting:0/1", "completed:1/1"]);
    const explanation = explainRecommendation(result.selected[0]!);
    expect(explanation.headline).toContain("scores");
    expect(
      explanation.reasons.some((reason) =>
        reason.includes("selected meta targets"),
      ),
    ).toBe(true);
    expect(explanation.scope).toContain("1-1 shields");
  });

  it("simulates ranked-default partners while preserving owned provenance", async () => {
    const inventory = [record("azumarill", ids.azumarill)];
    const candidatePool = buildRecommendationCandidatePool(
      recommendationRequestSchema.parse({
        formatId: "great-league",
        anchors: [{ inventoryId: ids.azumarill, position: "flex" }],
        resultCount: 1,
        buildStatusScope: "all",
        partnerScope: "owned-and-ranked",
      }),
      inventory,
      rankedCatalog,
    );
    const generation = generateStaticRecommendationTeams(candidatePool);
    const adapter = new DeterministicAdapter();
    const times = [0, 100];
    const service = new RecommendationFinalistSimulationService(
      adapter,
      () => times.shift()!,
    );
    const result = await service.simulate(
      generation,
      inventory,
      rankedCatalog,
      { targetLimit: 5, teamShields: 1, targetShields: 1 },
    );

    expect(
      adapter.requests[0]?.team.filter(
        (build) => build.source === "meta-default",
      ),
    ).toHaveLength(2);
    expect(result.selected).toHaveLength(1);
    expect(
      explainRecommendation(result.selected[0]!).tradeoffs.some((tradeoff) =>
        tradeoff.includes("must be added to inventory"),
      ),
    ).toBe(true);
  });

  it("rejects stale static data before invoking TeamRanker", async () => {
    const inventory = [
      record("azumarill", ids.azumarill),
      record("altaria", ids.altaria),
      record("whiscash", ids.whiscash),
    ];
    const generation = staticGeneration(inventory);
    const adapter = new DeterministicAdapter();
    const service = new RecommendationFinalistSimulationService(adapter);

    await expect(
      service.simulate(
        generation,
        inventory,
        { ...rankedCatalog, dataVersion: "new-data" },
        { targetLimit: 5, teamShields: 1, targetShields: 1 },
      ),
    ).rejects.toBeInstanceOf(RecommendationFinalistDataVersionError);
    expect(adapter.requests).toHaveLength(0);
  });

  it("isolates failed finalists and reports the result shortfall", async () => {
    const inventory = [
      record("azumarill", ids.azumarill),
      record("altaria", ids.altaria),
      record("whiscash", ids.whiscash),
    ];
    const generation = staticGeneration(inventory);
    const adapter: TeamRankerAdapter = {
      rank: () => Promise.reject(new Error("Engine unavailable")),
    };
    const service = new RecommendationFinalistSimulationService(adapter);
    const result = await service.simulate(
      generation,
      inventory,
      rankedCatalog,
      { targetLimit: 5, teamShields: 1, targetShields: 1 },
    );

    expect(result.completed).toHaveLength(0);
    expect(result.failures).toEqual([
      expect.objectContaining({ message: "Engine unavailable" }),
    ]);
    expect(result.selected).toHaveLength(0);
    expect(result.selectionShortfall).toBe(3);
  });

  it("cancels before starting the next synchronous finalist", async () => {
    const altaria = rankedCatalog.entries.find(
      (pokemon) => pokemon.speciesId === "altaria",
    )!;
    const catalog: PokemonCatalog = {
      ...rankedCatalog,
      entries: [
        ...rankedCatalog.entries,
        {
          ...altaria,
          speciesId: "noctowl",
          speciesName: "Noctowl",
          dex: 164,
          isMeta: false,
        },
      ],
    };
    const noctowl = {
      ...record("altaria", ids.noctowl, catalog),
      speciesId: "noctowl",
    };
    const inventory = [
      record("azumarill", ids.azumarill, catalog),
      record("altaria", ids.altaria, catalog),
      record("whiscash", ids.whiscash, catalog),
      noctowl,
    ];
    const generation = staticGeneration(inventory, catalog, 2);
    const adapter = new DeterministicAdapter();
    const service = new RecommendationFinalistSimulationService(adapter);
    const controller = new AbortController();
    const result = await service.simulate(
      generation,
      inventory,
      catalog,
      { targetLimit: 5, teamShields: 1, targetShields: 1 },
      {
        signal: controller.signal,
        onProgress: (progress) => {
          if (
            progress.status === "completed" &&
            progress.completedFinalists === 1
          ) {
            controller.abort();
          }
        },
      },
    );

    expect(generation.finalists.length).toBeGreaterThan(1);
    expect(adapter.requests).toHaveLength(1);
    expect(result.cancelled).toBe(true);
    expect(result.attemptedFinalistCount).toBe(1);
    expect(result.completed).toHaveLength(1);
    expect(result.selectionShortfall).toBe(1);
  });

  it("ranks exact results and minimally relaxes core diversity to fill the request", async () => {
    const altaria = rankedCatalog.entries.find(
      (pokemon) => pokemon.speciesId === "altaria",
    )!;
    const catalog: PokemonCatalog = {
      ...rankedCatalog,
      entries: [
        ...rankedCatalog.entries,
        {
          ...altaria,
          speciesId: "noctowl",
          speciesName: "Noctowl",
          dex: 164,
          isMeta: false,
        },
      ],
    };
    const noctowl = {
      ...record("altaria", ids.noctowl, catalog),
      speciesId: "noctowl",
    };
    const inventory = [
      record("azumarill", ids.azumarill, catalog),
      record("altaria", ids.altaria, catalog),
      record("whiscash", ids.whiscash, catalog),
      noctowl,
    ];
    const generation = staticGeneration(inventory, catalog, 2);
    const adapter = new DeterministicAdapter();
    const service = new RecommendationFinalistSimulationService(adapter);
    const result = await service.simulate(
      generation,
      inventory,
      catalog,
      { targetLimit: 5, teamShields: 1, targetShields: 1 },
    );

    expect(generation.finalists).toHaveLength(3);
    expect(result.selected).toHaveLength(2);
    expect(
      result.selected.every((finalist) =>
        [
          finalist.staticTeam.orderedMembers.lead.speciesId,
          finalist.staticTeam.orderedMembers.switch.speciesId,
          finalist.staticTeam.orderedMembers.closer.speciesId,
        ].includes("noctowl"),
      ),
    ).toBe(true);
    expect(result.selectionDiversityRelaxed).toBe(true);
    expect(result.selectionShortfall).toBe(0);
  });
});
