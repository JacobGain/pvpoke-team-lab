import { describe, expect, it } from "vitest";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import { buildRecommendationCandidatePool } from "@/domain/recommendations/candidatePool";
import { recommendationRequestSchema } from "@/domain/recommendations/contracts";
import {
  DEFAULT_RECOMMENDATION_STATIC_POLICY,
  generateStaticRecommendationTeams,
  RECOMMENDATION_STATIC_POLICY_VERSION,
  RECOMMENDATION_STATIC_SCORE_VERSION,
} from "@/domain/recommendations/staticTeamGeneration";

const ids = {
  azumarill: "78ce2157-a008-49a1-bbcc-563998b76800",
  altaria: "fd17fe2f-1d87-4879-8850-d95476cd9070",
  altariaTwo: "a217fe2f-1d87-4879-8850-d95476cd9071",
  altariaThree: "b317fe2f-1d87-4879-8850-d95476cd9072",
  whiscash: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
  whiscashTwo: "c4d7265f-a0ba-4ee6-b94a-bf83390e1218",
  whiscashThree: "d5d7265f-a0ba-4ee6-b94a-bf83390e1219",
  noctowl: "e6d7265f-a0ba-4ee6-b94a-bf83390e1220",
  skarmory: "f7d7265f-a0ba-4ee6-b94a-bf83390e1221",
  mandibuzz: "18d7265f-a0ba-4ee6-b94a-bf83390e1222",
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

function request(
  anchors: {
    inventoryId: string;
    position: "lead" | "switch" | "closer" | "flex";
  }[] = [{ inventoryId: ids.azumarill, position: "flex" }],
) {
  return recommendationRequestSchema.parse({
    formatId: "great-league",
    anchors,
    resultCount: 3,
    buildStatusScope: "all",
  });
}

function pool(
  inventory: readonly InventoryPokemon[],
  catalog: PokemonCatalog = rankedCatalog,
  anchors?: {
    inventoryId: string;
    position: "lead" | "switch" | "closer" | "flex";
  }[],
) {
  return buildRecommendationCandidatePool(
    request(anchors),
    inventory,
    catalog,
  );
}

describe("static recommendation generation", () => {
  it("builds a fully simulatable team from one owned anchor and ranked defaults", () => {
    const candidatePool = buildRecommendationCandidatePool(
      recommendationRequestSchema.parse({
        formatId: "great-league",
        anchors: [{ inventoryId: ids.azumarill, position: "flex" }],
        resultCount: 3,
        buildStatusScope: "all",
        partnerScope: "owned-and-ranked",
      }),
      [record("azumarill", ids.azumarill)],
      rankedCatalog,
    );
    const generation = generateStaticRecommendationTeams(candidatePool);
    const team = generation.finalists[0];

    expect(team).toBeDefined();
    expect(
      team
        ? [
            team.orderedMembers.lead,
            team.orderedMembers.switch,
            team.orderedMembers.closer,
          ].filter((candidate) => candidate.source === "ranked-default-build")
            .length
        : 0,
    ).toBe(2);
    expect(
      team
        ? [
            team.orderedMembers.lead.exactBuild.source,
            team.orderedMembers.switch.exactBuild.source,
            team.orderedMembers.closer.exactBuild.source,
          ]
        : [],
    ).toContain("meta-default");
  });

  it("generates a species-safe team and assigns flexible roles by published fit", () => {
    const generation = generateStaticRecommendationTeams(
      pool([
        record("azumarill", ids.azumarill),
        record("altaria", ids.altaria),
        record("whiscash", ids.whiscash),
      ]),
    );

    expect(generation.policy.version).toBe(
      RECOMMENDATION_STATIC_POLICY_VERSION,
    );
    expect(generation.generatedTeamCount).toBe(1);
    expect(generation.finalists).toHaveLength(1);
    expect(generation.teams[0]).toMatchObject({
      orderedMembers: {
        lead: { speciesId: "altaria" },
        switch: { speciesId: "whiscash" },
        closer: { speciesId: "azumarill" },
      },
      preScore: {
        version: RECOMMENDATION_STATIC_SCORE_VERSION,
        complementarity: {
          knownThreats: 3,
          answeredThreats: 3,
          sharedThreats: 2,
          threatCoveragePercentage: 100,
        },
        roleSuitability: {
          evidenceCount: 3,
          evidenceTotal: 3,
        },
        metaStrength: {
          evidenceCount: 3,
          evidenceTotal: 3,
        },
        readiness: {
          score: 100,
        },
      },
    });
    expect(generation.teams[0]!.preScore.score).toBeCloseTo(83.54, 2);
  });

  it("honors two fixed anchor positions and fills only the remaining role", () => {
    const generation = generateStaticRecommendationTeams(
      pool(
        [
          record("azumarill", ids.azumarill),
          record("altaria", ids.altaria),
          record("whiscash", ids.whiscash),
        ],
        rankedCatalog,
        [
          { inventoryId: ids.azumarill, position: "lead" },
          { inventoryId: ids.altaria, position: "switch" },
        ],
      ),
    );

    expect(generation.teams[0]).toMatchObject({
      orderedMembers: {
        lead: { inventoryId: ids.azumarill },
        switch: { inventoryId: ids.altaria },
        closer: { inventoryId: ids.whiscash },
      },
      anchorInventoryIds: [ids.azumarill, ids.altaria],
    });
  });

  it("records missing ranking and configurable threshold exclusions", () => {
    const unrankedGeneration = generateStaticRecommendationTeams(
      pool(
        [
          record("azumarill", ids.azumarill, inventoryTestCatalog),
          record("altaria", ids.altaria, inventoryTestCatalog),
          record("whiscash", ids.whiscash, inventoryTestCatalog),
        ],
        inventoryTestCatalog,
      ),
    );

    expect(unrankedGeneration.generatedTeamCount).toBe(0);
    expect(unrankedGeneration.eligibilityExclusions).toContainEqual(
      expect.objectContaining({
        inventoryId: ids.whiscash,
        code: "ranking-unavailable",
      }),
    );

    const rankedPool = pool([
      record("azumarill", ids.azumarill),
      record("altaria", ids.altaria),
      record("whiscash", ids.whiscash),
    ]);
    const rankLimited = generateStaticRecommendationTeams(rankedPool, {
      ...DEFAULT_RECOMMENDATION_STATIC_POLICY,
      maxOverallRank: 40,
    });
    const roleLimited = generateStaticRecommendationTeams(rankedPool, {
      ...DEFAULT_RECOMMENDATION_STATIC_POLICY,
      minRelevantRoleScore: 95,
    });

    expect(rankLimited.eligibilityExclusions).toContainEqual(
      expect.objectContaining({
        inventoryId: ids.whiscash,
        code: "overall-rank-threshold",
      }),
    );
    expect(roleLimited.eligibilityExclusions.map((issue) => issue.code)).toEqual(
      ["role-score-threshold", "role-score-threshold"],
    );
    expect(() =>
      generateStaticRecommendationTeams(rankedPool, {
        ...DEFAULT_RECOMMENDATION_STATIC_POLICY,
        scoreWeights: {
          ...DEFAULT_RECOMMENDATION_STATIC_POLICY.scoreWeights,
          readiness: 0,
        },
      }),
    ).toThrow(RangeError);
  });

  it("prevents same-species pairs and deduplicates inventory variants by species team", () => {
    const inventory = [
      record("azumarill", ids.azumarill),
      record("altaria", ids.altaria),
      record("altaria", ids.altariaTwo),
      record("altaria", ids.altariaThree),
      record("whiscash", ids.whiscash),
      record("whiscash", ids.whiscashTwo),
      record("whiscash", ids.whiscashThree),
    ];
    const generation = generateStaticRecommendationTeams(pool(inventory));

    expect(generation.generatedTeamCount).toBe(9);
    expect(
      generation.teams.every((team) => {
        const members = [
          team.orderedMembers.lead,
          team.orderedMembers.switch,
          team.orderedMembers.closer,
        ];
        return new Set(members.map((member) => member.dex)).size === 3;
      }),
    ).toBe(true);
    expect(generation.finalistTarget).toBe(9);
    expect(generation.uniqueTeamCount).toBe(1);
    expect(generation.finalists).toHaveLength(1);
  });

  it("limits optional two-member core repetition across finalists", () => {
    const altaria = rankedCatalog.entries.find(
      (pokemon) => pokemon.speciesId === "altaria",
    )!;
    const clones = [
      {
        speciesId: "noctowl",
        speciesName: "Noctowl",
        dex: 164,
        id: ids.noctowl,
      },
      {
        speciesId: "skarmory",
        speciesName: "Skarmory",
        dex: 227,
        id: ids.skarmory,
      },
      {
        speciesId: "mandibuzz",
        speciesName: "Mandibuzz",
        dex: 630,
        id: ids.mandibuzz,
      },
    ] as const;
    const diverseCatalog: PokemonCatalog = {
      ...rankedCatalog,
      entries: [
        ...rankedCatalog.entries,
        ...clones.map((clone) => ({
          ...altaria,
          speciesId: clone.speciesId,
          speciesName: clone.speciesName,
          dex: clone.dex,
        })),
      ],
    };
    const cloneRecords = clones.map((clone) => ({
      ...record("altaria", clone.id, diverseCatalog),
      speciesId: clone.speciesId,
    }));
    const generation = generateStaticRecommendationTeams(
      pool(
        [
          record("azumarill", ids.azumarill, diverseCatalog),
          record("altaria", ids.altaria, diverseCatalog),
          record("whiscash", ids.whiscash, diverseCatalog),
          ...cloneRecords,
        ],
        diverseCatalog,
      ),
    );
    const pairCounts = new Map<string, number>();

    for (const team of generation.finalists) {
      const dex = [
        team.orderedMembers.lead.dex,
        team.orderedMembers.switch.dex,
        team.orderedMembers.closer.dex,
      ];

      for (const [left, right] of [
        [dex[0]!, dex[1]!],
        [dex[0]!, dex[2]!],
        [dex[1]!, dex[2]!],
      ] as const) {
        const key = left < right ? `${left}:${right}` : `${right}:${left}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }

    expect(generation.uniqueTeamCount).toBe(10);
    expect(generation.finalists.length).toBeGreaterThan(1);
    expect(generation.finalists.length).toBeLessThan(
      generation.finalistTarget,
    );
    expect(Math.max(...pairCounts.values())).toBeLessThanOrEqual(
      DEFAULT_RECOMMENDATION_STATIC_POLICY.maxOptionalCoreRepeats,
    );
  });
});
