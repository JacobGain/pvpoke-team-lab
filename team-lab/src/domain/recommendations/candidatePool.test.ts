import { describe, expect, it } from "vitest";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import {
  buildRecommendationCandidatePool,
  RecommendationAnchorError,
} from "@/domain/recommendations/candidatePool";
import { recommendationRequestSchema } from "@/domain/recommendations/contracts";

const ids = {
  azumarill: "78ce2157-a008-49a1-bbcc-563998b76800",
  duplicateAzumarill: "64db44ca-aa7f-46ad-8880-9292a0140e92",
  altaria: "fd17fe2f-1d87-4879-8850-d95476cd9070",
  whiscash: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
  missing: "12345678-1234-4234-8234-123456789012",
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

function currentRecord(
  speciesId: keyof typeof settings,
  inventoryId: string,
  favorite = false,
): InventoryPokemon {
  const build = settings[speciesId];

  return createInventoryPokemon(
    {
      buildStatus: "current",
      speciesId,
      favorite,
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
      catalog: inventoryTestCatalog,
      createId: () => inventoryId,
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    },
  );
}

function plannedWhiscash(): InventoryPokemon {
  const build = settings.whiscash;

  return createInventoryPokemon(
    {
      buildStatus: "planned",
      speciesId: "whiscash",
      currentBuild: {
        cp: build.cp,
        ivProfile: { source: "assumed-rank-1" },
        moveset: {
          fastMoveId: build.fastMoveId,
          chargedMoveIds: [...build.chargedMoveIds],
        },
      },
      plannedBuild: {
        targetSpeciesId: "whiscash",
        targetCp: build.cp,
        desiredMoveset: {
          fastMoveId: build.fastMoveId,
          chargedMoveIds: [...build.chargedMoveIds],
        },
      },
    },
    {
      catalog: inventoryTestCatalog,
      createId: () => ids.whiscash,
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    },
  );
}

function request(
  overrides: Partial<{
    anchors: { inventoryId: string; position: "lead" | "switch" | "closer" | "flex" }[];
    resultCount: number;
    buildStatusScope: "all" | "ready-now-only" | "planned-only";
  }> = {},
) {
  return recommendationRequestSchema.parse({
    formatId: "great-league",
    anchors: [{ inventoryId: ids.azumarill, position: "flex" }],
    resultCount: 3,
    buildStatusScope: "all",
    ...overrides,
  });
}

describe("recommendation request contract", () => {
  it("accepts one or two anchors and a one-to-five result count", () => {
    expect(request()).toMatchObject({
      anchors: [{ inventoryId: ids.azumarill, position: "flex" }],
      resultCount: 3,
    });
    expect(
      request({
        anchors: [
          { inventoryId: ids.azumarill, position: "lead" },
          { inventoryId: ids.altaria, position: "switch" },
        ],
        resultCount: 5,
      }).anchors,
    ).toHaveLength(2);
  });

  it("rejects duplicate anchors, duplicate fixed positions, and invalid counts", () => {
    expect(
      recommendationRequestSchema.safeParse({
        formatId: "great-league",
        anchors: [
          { inventoryId: ids.azumarill, position: "lead" },
          { inventoryId: ids.azumarill, position: "switch" },
        ],
        resultCount: 3,
        buildStatusScope: "all",
      }).success,
    ).toBe(false);
    expect(
      recommendationRequestSchema.safeParse({
        formatId: "great-league",
        anchors: [
          { inventoryId: ids.azumarill, position: "lead" },
          { inventoryId: ids.altaria, position: "lead" },
        ],
        resultCount: 3,
        buildStatusScope: "all",
      }).success,
    ).toBe(false);
    expect(
      recommendationRequestSchema.safeParse({
        formatId: "great-league",
        anchors: [{ inventoryId: ids.azumarill, position: "flex" }],
        resultCount: 6,
        buildStatusScope: "all",
      }).success,
    ).toBe(false);
  });
});

describe("recommendation candidate pool", () => {
  it("produces exact pre-score evidence and prioritizes ready-now partners", () => {
    const inventory = [
      currentRecord("azumarill", ids.azumarill),
      plannedWhiscash(),
      currentRecord("altaria", ids.altaria, true),
      currentRecord("azumarill", ids.duplicateAzumarill),
    ];
    const pool = buildRecommendationCandidatePool(
      request(),
      inventory,
      inventoryTestCatalog,
    );

    expect(pool.dataVersion).toBe("test-data-v1");
    expect(pool.anchors).toHaveLength(1);
    expect(pool.requiredPartnerCount).toBe(2);
    expect(pool.anchors[0]).toMatchObject({
      position: "flex",
      candidate: {
        inventoryId: ids.azumarill,
        readiness: "ready-now",
        exactBuild: {
          speciesId: "azumarill",
          level: 45.5,
          cp: 1499,
          source: "inventory-current",
        },
        staticEvidence: {
          overallRank: 5,
        },
      },
    });
    expect(pool.partners.map((candidate) => candidate.inventoryId)).toEqual([
      ids.altaria,
      ids.whiscash,
    ]);
    expect(pool.partners[0]).toMatchObject({
      readiness: "ready-now",
      favorite: true,
      staticEvidence: {
        overallRank: 30,
      },
    });
    expect(pool.partners[1]).toMatchObject({
      readiness: "planned",
      exactBuild: {
        speciesId: "whiscash",
        source: "inventory-planned",
      },
    });
    expect(pool.exclusions).toContainEqual(
      expect.objectContaining({
        inventoryId: ids.duplicateAzumarill,
        code: "species-clause-with-anchor",
      }),
    );
  });

  it("applies the ready-now-only scope before shortlisting", () => {
    const pool = buildRecommendationCandidatePool(
      request({ buildStatusScope: "ready-now-only" }),
      [
        currentRecord("azumarill", ids.azumarill),
        plannedWhiscash(),
        currentRecord("altaria", ids.altaria),
      ],
      inventoryTestCatalog,
    );

    expect(pool.partners.map((candidate) => candidate.inventoryId)).toEqual([
      ids.altaria,
    ]);
    expect(pool.exclusions).toContainEqual(
      expect.objectContaining({
        inventoryId: ids.whiscash,
        code: "build-status-scope",
      }),
    );
  });

  it("resolves two legal anchors and requests only one partner", () => {
    const pool = buildRecommendationCandidatePool(
      request({
        anchors: [
          { inventoryId: ids.azumarill, position: "lead" },
          { inventoryId: ids.altaria, position: "flex" },
        ],
      }),
      [
        currentRecord("azumarill", ids.azumarill),
        currentRecord("altaria", ids.altaria),
        currentRecord("whiscash", ids.whiscash),
      ],
      inventoryTestCatalog,
    );

    expect(pool.anchors.map((anchor) => anchor.position)).toEqual([
      "lead",
      "flex",
    ]);
    expect(pool.requiredPartnerCount).toBe(1);
    expect(pool.partners.map((candidate) => candidate.inventoryId)).toEqual([
      ids.whiscash,
    ]);
  });

  it("rejects missing anchors and species-clause conflicts between anchors", () => {
    expect(() =>
      buildRecommendationCandidatePool(
        request({
          anchors: [{ inventoryId: ids.missing, position: "flex" }],
        }),
        [currentRecord("azumarill", ids.azumarill)],
        inventoryTestCatalog,
      ),
    ).toThrowError(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            code: "anchor-not-found",
          }),
        ],
      }),
    );

    expect(() =>
      buildRecommendationCandidatePool(
        request({
          anchors: [
            { inventoryId: ids.azumarill, position: "lead" },
            { inventoryId: ids.duplicateAzumarill, position: "switch" },
          ],
        }),
        [
          currentRecord("azumarill", ids.azumarill),
          currentRecord("azumarill", ids.duplicateAzumarill),
        ],
        inventoryTestCatalog,
      ),
    ).toThrow(RecommendationAnchorError);
  });
});
