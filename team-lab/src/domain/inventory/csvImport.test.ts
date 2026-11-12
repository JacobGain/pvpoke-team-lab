import { describe, expect, it } from "vitest";
import gm from "../../../public/vendor/pvpoke/data/gamemaster.min.json";
import { buildPokemonCatalog } from "@/pvpoke/adapters/buildPokemonCatalog";
import { gameMasterSchema } from "@/pvpoke/types/schemas";
import { calculateCombatPower } from "@/domain/pokemon/combatPower";
import { parseInventoryCsv, autoMapInventoryCsvColumns, previewInventoryCsv, inventoryCsvTemplate } from "./csvImport";
import type { InventoryPokemon } from "./schemas";

const catalog = buildPokemonCatalog(gameMasterSchema.parse(gm), [], [], 10000, "mega-master-league");
const pokemon = catalog.entries.find(entry => entry.speciesId === "sableye_mega")!;
const cp = calculateCombatPower(pokemon.baseStats, { attack: 15, defense: 15, hp: 15 }, 50);
const header = "species_id,cp,attack_iv,defense_iv,hp_iv,fast_move_id,charged_move_1_id,charged_move_2_id,mega_level,extra_charged_move_id";
const row = `sableye_mega,${cp},15,15,15,SHADOW_CLAW,FOUL_PLAY,,4,NIGHT_SHADE_PLUS`;

function preview(source: string, existingRecords: readonly InventoryPokemon[] = []) {
  const document = parseInventoryCsv(source);
  return previewInventoryCsv({ document, mapping: autoMapInventoryCsvColumns(document.headers), catalog, existingRecords });
}

describe("Mega-aware inventory CSV", () => {
  it("maps optional Mega columns, retains the separate slot, and reports preview attacks", () => {
    const result = preview(`${header}\n${row}`);
    expect(result.configurationIssues).toEqual([]);
    expect(result.readyCount).toBe(1);
    expect(result.rows[0]?.record?.currentBuild).toMatchObject({ megaLevel: 4,
      moveset: { chargedMoveIds: ["FOUL_PLAY"], extraChargedMoveId: "NIGHT_SHADE_PLUS" },
    });
    expect(result.rows[0]?.moves).toContain("NIGHT_SHADE_PLUS");
    expect(inventoryCsvTemplate()).toContain("mega_level,extra_charged_move_id");
  });

  it("continues to read older CSV files without inventing an extra attack", () => {
    const result = preview(`${header.split(",").slice(0, 8).join(",")}\n${row.split(",").slice(0, 8).join(",")}`);
    expect(result.readyCount).toBe(1);
    expect(result.rows[0]?.record?.currentBuild.megaLevel).toBe(4);
    expect(result.rows[0]?.record?.currentBuild.moveset.extraChargedMoveId).toBeUndefined();
  });

  it("distinguishes Mega levels and extra attacks in duplicate identity", () => {
    const existing = preview(`${header}\n${row}`).rows[0]!.record!;
    expect(preview(`${header}\n${row}`, [existing]).duplicateCount).toBe(1);
    expect(preview(`${header}\n${row.replace(",4,NIGHT", ",2,NIGHT")}`, [existing]).readyCount).toBe(1);
    expect(preview(`${header}\n${row.replace("NIGHT_SHADE_PLUS", "")}`, [existing]).readyCount).toBe(1);
  });

  it("rejects an illegal slot, move pool, or Mega level with a row-specific error", () => {
    for (const changed of [row.replace(",4,NIGHT", ",7,NIGHT"), row.replace("NIGHT_SHADE_PLUS", "OMINOUS_WIND_PLUS"), row.replace("FOUL_PLAY", "NIGHT_SHADE_PLUS")]) {
      const result = preview(`${header}\n${changed}`);
      expect(result.invalidCount).toBe(1);
      expect(result.rows[0]).toMatchObject({ rowNumber: 2, status: "invalid" });
      expect(result.rows[0]?.record).toBeUndefined();
      expect(result.rows[0]?.issue).toBeTruthy();
    }
  });
});
