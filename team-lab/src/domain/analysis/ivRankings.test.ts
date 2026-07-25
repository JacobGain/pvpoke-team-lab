import { describe, expect, it } from "vitest";

import {
  analyzeIvRanking,
  calculateEffectiveStats,
  generateIvRankingTable,
} from "@/domain/analysis/ivRankings";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";

const azumarill = inventoryTestCatalog.entries[0]!;

describe("Open Great League IV rankings", () => {
  it("generates and caches all general IV combinations", () => {
    const first = generateIvRankingTable(azumarill);
    const second = generateIvRankingTable(azumarill);

    expect(first).toHaveLength(4096);
    expect(second).toBe(first);
    expect(first[0]).toMatchObject({
      rank: 1,
      level: 45.5,
      cp: 1499,
      ivs: { attack: 0, defense: 15, hp: 15 },
    });
  });

  it("calculates PvPoke-compatible effective stats and stat product", () => {
    const stats = calculateEffectiveStats(
      azumarill,
      { attack: 0, defense: 15, hp: 15 },
      45.5,
    );

    expect(stats.attack).toBeCloseTo(91.58, 1);
    expect(stats.defense).toBeCloseTo(136.57, 1);
    expect(stats.hp).toBe(196);
    expect(stats.statProduct).toBeCloseTo(
      stats.attack * stats.defense * stats.hp,
      8,
    );
  });

  it("reports rank, percentile, and rank-one comparison", () => {
    const rankOne = analyzeIvRanking(azumarill, {
      attack: 0,
      defense: 15,
      hp: 15,
    });
    const hundo = analyzeIvRanking(azumarill, {
      attack: 15,
      defense: 15,
      hp: 15,
    });

    expect(rankOne).toMatchObject({
      rank: 1,
      count: 4096,
      percentile: 100,
      statProductPercentage: 100,
    });
    expect(rankOne.attackPercentile).toBeLessThan(100);
    expect(rankOne.highestAttack.stats.attack).toBeGreaterThan(
      rankOne.combination.stats.attack,
    );
    expect(hundo.rank).toBeGreaterThan(1);
    expect(hundo.percentile).toBeLessThan(100);
    expect(hundo.statProductPercentage).toBeLessThan(100);
  });
});
