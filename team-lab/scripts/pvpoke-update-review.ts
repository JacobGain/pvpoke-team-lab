import type { GameMasterData, Ranking } from "../src/pvpoke/types/schemas.ts";
import type { PvpokeUpdateReview } from "../src/pvpoke/types/updateReview.ts";

export interface ReviewSnapshot {
  gameMaster: GameMasterData;
  rankings: Record<string, Ranking[]>;
}

/** Compare published snapshots; never infer history from a user's saved build. */
export function buildUpdateReview(
  before: ReviewSnapshot,
  after: ReviewSnapshot,
  fromCommit: string,
  toCommit: string | null,
): PvpokeUpdateReview {
  const species: PvpokeUpdateReview["species"] = {};
  const previous = new Map(before.gameMaster.pokemon.map(p => [p.speciesId, p]));
  const current = new Map(after.gameMaster.pokemon.map(p => [p.speciesId, p]));
  const oldMoves = new Map(before.gameMaster.moves.map(m => [m.moveId, m]));
  const newMoves = new Map(after.gameMaster.moves.map(m => [m.moveId, m]));
  const combatFields = ["power", "energy", "energyGain", "cooldown", "turns", "type", "buffs", "buffApplyChance", "buffTarget"] as const;
  const changedMoves = new Set([...newMoves].filter(([id, move]) => {
    const old = oldMoves.get(id);
    return old && combatFields.some(field => JSON.stringify(old[field]) !== JSON.stringify(move[field]));
  }).map(([id]) => id));
  const moveName = (id: string) => newMoves.get(id)?.name ?? oldMoves.get(id)?.name ?? id;

  for (const id of [...new Set([...previous.keys(), ...current.keys()])].sort()) {
    const old = previous.get(id);
    const next = current.get(id);
    const details: string[] = [];
    if (!old) details.push("New Pokémon or form in the catalog.");
    else if (!next) details.push("Removed from the current catalog; review this build before using it.");
    else {
      if (old.released !== next.released) details.push(next.released ? "Now marked as released." : "No longer marked as released.");
      if (JSON.stringify(old.baseStats) !== JSON.stringify(next.baseStats)) details.push("Base stats changed; check CP, IVs, and matchups.");
      if (JSON.stringify(old.types) !== JSON.stringify(next.types)) details.push("Typing changed.");
      if (JSON.stringify(old.defaultIVs) !== JSON.stringify(next.defaultIVs)) details.push("Published default IVs changed; your saved IVs have not been altered.");
      if (old.levelFloor !== next.levelFloor || old.levelCap !== next.levelCap) details.push("Available level range changed.");
      for (const [label, oldIds, newIds] of [
        ["Fast move", old.fastMoves, next.fastMoves],
        ["Charged move", old.chargedMoves, next.chargedMoves],
        ["Elite TM move", old.eliteMoves ?? [], next.eliteMoves ?? []],
      ] as const) {
        for (const move of newIds.filter(m => !oldIds.includes(m))) details.push(`${label} added: ${moveName(move)}.`);
        for (const move of oldIds.filter(m => !newIds.includes(m))) details.push(`${label} removed: ${moveName(move)}.`);
      }
      const availableMoves = new Set([...old.fastMoves, ...old.chargedMoves, ...next.fastMoves, ...next.chargedMoves]);
      for (const move of [...availableMoves].filter(m => changedMoves.has(m)).sort()) details.push(`Move stats changed: ${moveName(move)}.`);
    }
    species[id] = { name: next?.speciesName ?? old?.speciesName ?? id, details, rankings: {} };
  }

  for (const league of Object.keys(after.rankings).sort()) {
    const old = new Map((before.rankings[league] ?? []).map((r, i) => [r.speciesId, { rank: i + 1, moves: r.moveset.filter(m => m !== "none") }]));
    const next = new Map(after.rankings[league].map((r, i) => [r.speciesId, { rank: i + 1, moves: r.moveset.filter(m => m !== "none") }]));
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      const a = old.get(id), b = next.get(id);
      if (species[id] && (a?.rank !== b?.rank || JSON.stringify(a?.moves) !== JSON.stringify(b?.moves))) {
        species[id].rankings[league] = {
          before: a?.rank ?? null, after: b?.rank ?? null,
          recommendedBefore: a?.moves ?? [], recommendedAfter: b?.moves ?? [],
        };
      }
    }
  }
  for (const [id, change] of Object.entries(species)) {
    if (!change.details.length && !Object.keys(change.rankings).length) delete species[id];
  }
  return {
    formatVersion: 1,
    fromVersion: before.gameMaster.timestamp, toVersion: after.gameMaster.timestamp,
    fromCommit, toCommit, species,
  };
}
