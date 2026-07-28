import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { expect, it } from "vitest";

import {
  createTeamLabBackup,
  inspectTeamLabBackup,
  serializeTeamLabBackup,
} from "@/domain/backup/teamLabBackup";
import { clearIvRankingCache } from "@/domain/analysis/ivRankings";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type {
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import { buildRecommendationCandidatePool } from "@/domain/recommendations/candidatePool";
import { recommendationRequestSchema } from "@/domain/recommendations/contracts";
import { generateStaticRecommendationTeams } from "@/domain/recommendations/staticTeamGeneration";
import { createSavedTeam } from "@/domain/teams/factory";
import type { SavedTeam } from "@/domain/teams/schemas";
import { DexieTeamLabBackupRepository } from "@/infrastructure/backup/DexieTeamLabBackupRepository";
import { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieInventoryRepository } from "@/infrastructure/inventory/DexieInventoryRepository";
import { DexieSavedTeamRepository } from "@/infrastructure/teams/DexieSavedTeamRepository";
import { filterAndSortInventory } from "@/features/inventory/inventoryView";

const INVENTORY_COUNT = 120;
const SAVED_TEAM_COUNT = 30;
const RECOMMENDATION_SAMPLE_COUNT = 3;

const budgetsMilliseconds = {
  fixture: 2_000,
  inventoryView: 100,
  backupRoundTrip: 250,
  restore: 500,
  repositoryRead: 250,
  recommendationDiscovery: 1_500,
  total: 2_500,
} as const;

function elapsedSince(start: number): number {
  return performance.now() - start;
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)]!;
}

function inventoryId(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function teamId(index: number): string {
  return `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function speciesId(index: number): string {
  return `scale_species_${index + 1}`;
}

function createScaleCatalog(): PokemonCatalog {
  const entries: PokemonCatalogEntry[] = Array.from(
    { length: INVENTORY_COUNT },
    (_, index) => {
      const base =
        inventoryTestCatalog.entries[
          index % inventoryTestCatalog.entries.length
        ]!;
      const fastMoveId = base.fastMoves[0]!.id;
      const chargedMoveIds = base.chargedMoves
        .slice(0, 2)
        .map((move) => move.id);

      return {
        ...base,
        speciesId: speciesId(index),
        speciesName: `Scale Species ${index + 1}`,
        dex: 10_000 + index,
        evolutionIds: [],
        isMeta: index < 48,
        ranking: {
          rank: index + 1,
          score: 100 - index / 2,
          rating: 650 - index,
          recommendedMoveIds: [fastMoveId, ...chargedMoveIds],
          matchups: [
            {
              speciesId: speciesId((index + 1) % INVENTORY_COUNT),
              rating: 600,
            },
          ],
          counters: [
            {
              speciesId: speciesId((index + 2) % INVENTORY_COUNT),
              rating: 400,
            },
          ],
          roleScores: {
            lead: 60 + (index % 30),
            closer: 65 + (index % 25),
            switch: 70 + (index % 20),
            charger: 55 + (index % 35),
            attacker: 58 + (index % 32),
            consistency: 62 + (index % 28),
          },
        },
      };
    },
  );

  return {
    dataVersion: "mvp-scale-120-v1",
    entries,
    diagnostics: {
      duplicatePokemonIds: [],
      duplicateMoveIds: [],
      duplicateRankingIds: [],
      danglingPokemonMoveIds: [],
      rankingSpeciesNotInGameMaster: [],
      rankingMoveIdsNotInGameMaster: [],
      metaSpeciesNotInGameMaster: [],
      metaMoveIdsNotInGameMaster: [],
    },
  };
}

function createScaleInventory(
  catalog: PokemonCatalog,
): readonly InventoryPokemon[] {
  const cpByBase = [1499, 1495, 1497] as const;

  return catalog.entries.map((pokemon, index) =>
    createInventoryPokemon(
      {
        buildStatus: "current",
        speciesId: pokemon.speciesId,
        favorite: index % 10 === 0,
        currentBuild: {
          cp: cpByBase[index % cpByBase.length]!,
          ivProfile: { source: "assumed-rank-1" },
          moveset: {
            fastMoveId: pokemon.fastMoves[0]!.id,
            chargedMoveIds: pokemon.chargedMoves
              .slice(0, 2)
              .map((move) => move.id),
          },
        },
      },
      {
        catalog,
        createId: () => inventoryId(index),
        now: () => new Date("2026-07-25T12:00:00.000Z"),
      },
    ),
  );
}

function createScaleTeams(
  inventory: readonly InventoryPokemon[],
  catalog: PokemonCatalog,
): readonly SavedTeam[] {
  return Array.from({ length: SAVED_TEAM_COUNT }, (_, index) => {
    const firstMemberIndex = index * 3;

    return createSavedTeam(
      {
        name: `Scale Team ${index + 1}`,
        members: {
          leadInventoryId: inventory[firstMemberIndex]!.inventoryId,
          switchInventoryId:
            inventory[firstMemberIndex + 1]!.inventoryId,
          closerInventoryId:
            inventory[firstMemberIndex + 2]!.inventoryId,
        },
      },
      {
        inventory,
        catalog,
        createId: () => teamId(index),
        now: () => new Date("2026-07-25T13:00:00.000Z"),
      },
    );
  });
}

it(
  "keeps the complete MVP workflow bounded with 120 inventory records",
  async () => {
    const fixtureStart = performance.now();
    const catalog = createScaleCatalog();
    const inventory = createScaleInventory(catalog);
    const savedTeams = createScaleTeams(inventory, catalog);
    const fixture = elapsedSince(fixtureStart);

    const inventoryViewStart = performance.now();
    const favoriteView = filterAndSortInventory(inventory, catalog, {
      search: "scale species",
      status: "all",
      favoriteOnly: true,
      sort: "species",
    });
    const inventoryView = elapsedSince(inventoryViewStart);

    const backupStart = performance.now();
    const serialized = serializeTeamLabBackup(
      createTeamLabBackup(inventory, savedTeams, catalog),
    );
    const inspection = inspectTeamLabBackup(serialized, catalog);
    const backupRoundTrip = elapsedSince(backupStart);

    expect(inspection.success).toBe(true);
    if (!inspection.success) {
      throw new Error("The deterministic scale backup must be valid.");
    }

    const database = new TeamLabDatabase(
      `team-lab-scale-${crypto.randomUUID()}`,
      { indexedDB, IDBKeyRange },
    );

    try {
      const backupRepository = new DexieTeamLabBackupRepository(database);
      const restoreStart = performance.now();
      const restoreResult = await backupRepository.restore(
        inspection.backup,
        "replace",
        catalog,
      );
      const restore = elapsedSince(restoreStart);

      const repositoryReadStart = performance.now();
      const [restoredInventory, restoredTeams] = await Promise.all([
        new DexieInventoryRepository(database).list(),
        new DexieSavedTeamRepository(database).list(),
      ]);
      const repositoryRead = elapsedSince(repositoryReadStart);

      const recommendationSamples = Array.from(
        { length: RECOMMENDATION_SAMPLE_COUNT },
        () => {
          clearIvRankingCache();
          const recommendationStart = performance.now();
          const request = recommendationRequestSchema.parse({
            formatId: "great-league",
            anchors: [
              {
                inventoryId: inventory[0]!.inventoryId,
                position: "flex",
              },
            ],
            resultCount: 3,
            buildStatusScope: "all",
          });
          const pool = buildRecommendationCandidatePool(
            request,
            inventory,
            catalog,
          );
          const generation = generateStaticRecommendationTeams(pool);

          return {
            elapsedMs: elapsedSince(recommendationStart),
            pool,
            generation,
          };
        },
      );
      const { pool, generation } = recommendationSamples[0]!;
      const recommendationDiscoverySamples = recommendationSamples.map(
        (sample) => sample.elapsedMs,
      );
      const recommendationDiscovery = median(
        recommendationDiscoverySamples,
      );
      const total =
        fixture +
        inventoryView +
        backupRoundTrip +
        restore +
        repositoryRead +
        recommendationDiscovery;
      const measurements = {
        fixture,
        inventoryView,
        backupRoundTrip,
        restore,
        repositoryRead,
        recommendationDiscovery,
        recommendationDiscoverySamples,
        total,
        serializedBytes: new TextEncoder().encode(serialized).byteLength,
      };

      console.info(
        `[mvp-scale-characterization] ${JSON.stringify(measurements)}`,
      );

      expect(inventory).toHaveLength(INVENTORY_COUNT);
      expect(savedTeams).toHaveLength(SAVED_TEAM_COUNT);
      expect(favoriteView).toHaveLength(12);
      expect(restoreResult.inventory.finalCount).toBe(INVENTORY_COUNT);
      expect(restoreResult.savedTeams.finalCount).toBe(SAVED_TEAM_COUNT);
      expect(restoredInventory).toHaveLength(INVENTORY_COUNT);
      expect(restoredTeams).toHaveLength(SAVED_TEAM_COUNT);
      expect(pool.partners).toHaveLength(INVENTORY_COUNT - 1);
      expect(generation).toMatchObject({
        eligiblePartnerCount: INVENTORY_COUNT - 1,
        consideredPartnerCount: 40,
        omittedEligiblePartnerCount: INVENTORY_COUNT - 41,
        generatedTeamCount: 780,
        uniqueTeamCount: 780,
        retainedTeamCount: 250,
        finalistTarget: 9,
      });
      expect(generation.finalists).toHaveLength(9);
      expect(measurements.serializedBytes).toBeLessThan(2_000_000);
      expect(fixture).toBeLessThan(budgetsMilliseconds.fixture);
      expect(inventoryView).toBeLessThan(
        budgetsMilliseconds.inventoryView,
      );
      expect(backupRoundTrip).toBeLessThan(
        budgetsMilliseconds.backupRoundTrip,
      );
      expect(restore).toBeLessThan(budgetsMilliseconds.restore);
      expect(repositoryRead).toBeLessThan(
        budgetsMilliseconds.repositoryRead,
      );
      expect(recommendationDiscovery).toBeLessThan(
        budgetsMilliseconds.recommendationDiscovery,
      );
      expect(total).toBeLessThan(budgetsMilliseconds.total);
    } finally {
      await database.delete();
      clearIvRankingCache();
    }
  },
  30_000,
);
