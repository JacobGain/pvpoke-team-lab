import { describe, expect, it } from "vitest";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { calculateCombatPower } from "@/domain/pokemon/combatPower";
import type { SavedTeam } from "@/domain/teams/schemas";
import type { PvpokeUpdateReview } from "@/pvpoke/types/updateReview";
import { reviewRoster } from "./rosterReview";

const catalog = { ...inventoryTestCatalog, formatId: "great-league" as const, cpCap: 1500 };
function build(speciesId: string): InventoryPokemon {
  const pokemon = catalog.entries.find(p => p.speciesId === speciesId)!;
  const defaults = pokemon.defaultLeagueIvs!;
  return createInventoryPokemon({
    buildStatus: "current", speciesId,
    currentBuild: {
      cp: calculateCombatPower(pokemon.baseStats, defaults, defaults.level),
      ivProfile: { source: "assumed-rank-1" },
      moveset: { fastMoveId: pokemon.fastMoves[0]!.id, chargedMoveIds: [pokemon.chargedMoves[0]!.id] },
    },
  }, { catalog, createId: () => crypto.randomUUID(), now: () => new Date("2026-07-24T12:00:00Z") });
}
function comparison(): PvpokeUpdateReview {
  return {
    formatVersion: 1, fromVersion: "old", toVersion: catalog.dataVersion,
    fromCommit: "a".repeat(40), toCommit: "b".repeat(40),
    species: {
      azumarill: { name: "Azumarill", details: [], rankings: {
        "great-league": { before: 20, after: 5, recommendedBefore: ["BUBBLE"], recommendedAfter: ["BUBBLE"] },
        "ultra-league": { before: 10, after: 100, recommendedBefore: [], recommendedAfter: [] },
      } },
    },
  };
}
function teamFor(records: InventoryPokemon[], version?: string): SavedTeam {
  return {
    schemaVersion: 1, teamId: crypto.randomUUID(), formatId: "great-league", name: "Test team", notes: "",
    members: { leadInventoryId: records[0]!.inventoryId, switchInventoryId: records[1]!.inventoryId, closerInventoryId: records[2]!.inventoryId },
    createdAt: "2026-07-24T12:00:00Z", updatedAt: "2026-07-25T12:00:00Z", lastAnalyzedDataVersion: version,
    lastAnalyzedUpstreamCommit: "b".repeat(40),
  };
}

describe("roster update impact", () => {
  it("uses the selected league and preserves distinct owned specimens", () => {
    const records = [build("azumarill"), build("azumarill")];
    const review = reviewRoster(records, [], catalog, comparison());
    expect(review.records).toHaveLength(2);
    expect(review.records.every(r => r.significant && r.rank?.after === 5)).toBe(true);
    expect(records[0]?.sourceDataVersion).toBe(catalog.dataVersion);
  });

  it("includes removed species and invalid moves even without comparison history", () => {
    const removed = { ...build("azumarill"), speciesId: "retired_species" };
    const badMove = build("altaria");
    badMove.currentBuild.moveset.fastMoveId = "REMOVED_MOVE";
    const review = reviewRoster([removed, badMove], [], catalog, comparison());
    expect(review.records.every(r => r.significant && r.issues.length > 0)).toBe(true);
    expect(review.records[0]?.issues[0]).toContain("retired_species");
  });

  it("distinguishes never analyzed, stale, fresh, and edited member teams", () => {
    const records = [build("azumarill"), build("altaria"), build("whiscash")];
    const fresh = teamFor(records, catalog.dataVersion);
    const review = reviewRoster(records, [teamFor(records), teamFor(records, "old"), fresh], catalog, comparison());
    expect(review.teams.map(t => t.status)).toEqual(["not-analyzed", "outdated", "current"]);
    const edited = records.map((r, i) => i === 0 ? { ...r, updatedAt: "2026-07-26T12:00:00Z" } : r);
    expect(reviewRoster(edited, [fresh], catalog, comparison()).teams[0]?.status).toBe("outdated");
    const missing = reviewRoster(records.slice(1), [fresh], catalog, comparison());
    expect(missing.teams[0]?.status).toBe("repair");
  });

  it("separates minor ranking movements and rejects mismatched snapshot dates", () => {
    const report = comparison();
    report.species.azumarill!.rankings["great-league"]!.before = 6;
    const result = reviewRoster([build("azumarill")], [], catalog, report).records[0]!;
    expect(result.changed).toBe(true);
    expect(result.significant).toBe(false);
    expect(() => reviewRoster([], [], catalog, { ...report, toVersion: "wrong" })).toThrow("different data version");
  });

  it("includes planned evolution changes", () => {
    const base = build("azumarill");
    const planned: InventoryPokemon = { ...base, buildStatus: "planned", plannedBuild: {
      targetSpeciesId: "altaria", desiredMoveset: { fastMoveId: "DRAGON_BREATH", chargedMoveIds: ["SKY_ATTACK"] },
    } };
    const report = comparison();
    report.species.altaria = { name: "Altaria", details: ["Move stats changed: Sky Attack."], rankings: {} };
    const review = reviewRoster([planned], [], catalog, report).records[0]!;
    expect(review.details.some(d => d.speciesId === "altaria")).toBe(true);
    expect(review.speciesId).toBe("altaria");
  });

  it("reviews the selected Mega form using Mega rankings while preserving the owned identity", () => {
    const record = { ...build("azumarill"), megaSpeciesId: "azumarill_mega" };
    const megaCatalog = { ...catalog, formatId: "mega-ultra-league" as const, cpCap: 2500,
      entries: [...catalog.entries, { ...catalog.entries[0]!, speciesId: "azumarill_mega", speciesName: "Test Mega form" }],
    };
    const report = comparison();
    report.species.azumarill_mega = { name: "Test Mega form", details: [], rankings: {
      "mega-ultra-league": { before: 90, after: 20, recommendedBefore: [], recommendedAfter: [] },
    } };
    const review = reviewRoster([record], [], megaCatalog, report).records[0]!;
    expect(review.speciesId).toBe("azumarill_mega");
    expect(review.rank?.after).toBe(20);
    expect(review.record.speciesId).toBe("azumarill");
  });

  it("does not treat a matching Game Master date as fresh when upstream rankings changed", () => {
    const records = [build("azumarill"), build("altaria"), build("whiscash")];
    const oldRevision = { ...teamFor(records, catalog.dataVersion), lastAnalyzedUpstreamCommit: "c".repeat(40) };
    expect(reviewRoster(records, [oldRevision], catalog, comparison()).teams[0]?.status).toBe("outdated");
  });
});
