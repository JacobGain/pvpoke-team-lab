import { describe, expect, it } from "vitest";
import gameMasterJson from "../public/vendor/pvpoke/data/gamemaster.min.json";
import greatJson from "../public/vendor/pvpoke/data/rankings/all/overall/rankings-1500.json";
import { gameMasterSchema, rankingCollectionSchema } from "../src/pvpoke/types/schemas";
import { buildUpdateReview } from "./pvpoke-update-review";

const commit = "a".repeat(40);
const gm = gameMasterSchema.parse(gameMasterJson);
const rankings = rankingCollectionSchema.parse(greatJson);
const snapshot = { gameMaster: gm, rankings: { "great-league": rankings } };

describe("published update comparison", () => {
  it("reports changed Mega capabilities, extra attack availability, and Mega move damage markers", () => {
    const before = structuredClone(snapshot);
    const after = structuredClone(snapshot);
    const previous = before.gameMaster.pokemon.find(p => p.speciesId === "sableye_mega")!;
    previous.tags = previous.tags?.filter(tag => tag !== "supermega");
    previous.extraChargedMoves = [];
    const sableye = buildUpdateReview(before, after, commit, commit).species.sableye_mega;
    expect(sableye.details).toContain("Mega capabilities changed; review Mega level, effective level, and extra attack availability.");
    expect(sableye.details).toContain("Extra charged attack added: Night Shade+.");
    const withoutMarker = structuredClone(snapshot);
    withoutMarker.gameMaster.moves.find(move => move.moveId === "NIGHT_SHADE_PLUS")!.isMegaMove = false;
    expect(buildUpdateReview(withoutMarker, after, commit, commit).species.sableye_mega?.details).toContain("Move stats changed: Night Shade+.");
    expect(buildUpdateReview(after, before, commit, commit).species.sableye_mega?.details).toContain("Extra charged attack removed: Night Shade+.");
  });
  it("does not invent changes when syncing the same snapshot", () => {
    expect(buildUpdateReview(snapshot, snapshot, commit, commit).species).toEqual({});
  });

  it("detects additions, removals, move stats, elite availability, and rank entries/exits", () => {
    const before = structuredClone(snapshot);
    const after = structuredClone(snapshot);
    const id = "zoroark";
    before.gameMaster.pokemon = before.gameMaster.pokemon.filter(p => p.speciesId !== "goodra_hisuian");
    after.gameMaster.pokemon = after.gameMaster.pokemon.filter(p => p.speciesId !== "golisopod");
    const zoroark = before.gameMaster.pokemon.find(p => p.speciesId === id)!;
    zoroark.fastMoves = zoroark.fastMoves.filter(m => m !== "SUCKER_PUNCH");
    zoroark.eliteMoves = [];
    after.gameMaster.moves.find(m => m.moveId === "SHADOW_CLAW")!.power += 1;
    before.rankings["great-league"] = rankings.filter(r => r.speciesId !== "brambleghast");
    after.rankings["great-league"] = rankings.filter(r => r.speciesId !== "melmetal");
    const report = buildUpdateReview(before, after, commit, commit);
    expect(report.species.goodra_hisuian?.details).toContain("New Pokémon or form in the catalog.");
    expect(report.species.golisopod?.details[0]).toContain("Removed");
    expect(report.species.zoroark?.details).toEqual(expect.arrayContaining([
      "Fast move added: Sucker Punch.", "Elite TM move added: Sucker Punch.", "Move stats changed: Shadow Claw.",
    ]));
    expect(report.species.brambleghast?.rankings["great-league"]?.before).toBeNull();
    expect(report.species.melmetal?.rankings["great-league"]?.after).toBeNull();
  });
});
