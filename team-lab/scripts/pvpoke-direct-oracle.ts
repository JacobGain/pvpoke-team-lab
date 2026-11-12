import { createPinnedEngineHarness } from "./pvpoke-engine-harness.ts";
import type { OneOnOneSimulationRequest } from "../src/domain/simulation/contracts.ts";

/** Oracle deliberately bypasses configurePvpokePokemon and every adapter. */
export function directBattle(request: OneOnOneSimulationRequest) {
  const engine = createPinnedEngineHarness();
  const battle = engine.runtime.createBattle();
  battle.setCP(request.format.cpCap);
  battle.setCup(request.format.cup);
  const combatants = request.combatants.map(({ build, shields }, index) => {
    const pokemon = engine.createPokemon(build.speciesId, index as 0 | 1, battle);
    pokemon.initialize(request.format.cpCap);
    if (build.megaLevel !== undefined) pokemon.setMegaLevel(build.megaLevel);
    pokemon.setIV("atk", build.ivs.attack);
    pokemon.setIV("def", build.ivs.defense);
    pokemon.setIV("hp", build.ivs.hp);
    pokemon.setLevel(build.level);
    pokemon.selectMove("fast", build.fastMoveId);
    pokemon.selectMove("charged", build.chargedMoveIds[0], 0);
    if (build.extraChargedMoveId) pokemon.selectMove("extra-charged", build.extraChargedMoveId, 2);
    pokemon.selectMove("charged", build.chargedMoveIds[1] ?? "none", 1);
    if (!build.extraChargedMoveId) pokemon.selectMove("extra-charged", "none", 2);
    pokemon.setShields(shields);
    battle.setNewPokemon(pokemon, index, false);
    return pokemon;
  });
  battle.simulate();
  const ratings = battle.getBattleRatings();
  return {
    winner: battle.getWinner().pokemon === false ? "tie" : battle.getWinner().pokemon === combatants[0] ? 0 : 1,
    turnsToWin: [...battle.getTurnsToWin()],
    combatants: combatants.map((pokemon, index) => ({
      index, speciesId: pokemon.speciesId, battleRating: ratings[index],
      remainingHp: pokemon.hp, maximumHp: pokemon.stats.hp,
      remainingEnergy: pokemon.energy, remainingShields: pokemon.shields,
    })),
  };
}

