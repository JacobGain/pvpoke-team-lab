import type {
  CombatantIndex,
  ExactSimulationBuild,
  OneOnOneSimulationAdapter,
  OneOnOneSimulationRequest,
  OneOnOneSimulationResult,
  SimulationCombatantResult,
} from "@/domain/simulation/contracts";
import type {
  PvpokeBattle,
  PvpokeBattleRuntime,
  PvpokePokemon,
} from "@/pvpoke/simulation/runtime";

function configurePokemon(
  runtime: PvpokeBattleRuntime,
  battle: PvpokeBattle,
  build: ExactSimulationBuild,
  index: CombatantIndex,
  shields: number,
): PvpokePokemon {
  const pokemon = runtime.createPokemon(build.speciesId, index, battle);

  pokemon.setIV("atk", build.ivs.attack);
  pokemon.setIV("def", build.ivs.defense);
  pokemon.setIV("hp", build.ivs.hp);
  pokemon.setLevel(build.level, true);
  pokemon.setShadowType(build.isShadow ? "shadow" : "normal");
  pokemon.selectMove("fast", build.fastMoveId);
  pokemon.selectMove("charged", build.chargedMoveIds[0], 0);

  if (build.chargedMoveIds[1]) {
    pokemon.selectMove("charged", build.chargedMoveIds[1], 1);
  } else {
    pokemon.selectMove("charged", "none", 1);
  }

  pokemon.setShields(shields);
  battle.setNewPokemon(pokemon, index, false);
  return pokemon;
}

function translateCombatant(
  index: CombatantIndex,
  pokemon: PvpokePokemon,
  rating: number,
): SimulationCombatantResult {
  return {
    index,
    speciesId: pokemon.speciesId,
    battleRating: rating,
    remainingHp: pokemon.hp,
    maximumHp: pokemon.stats.hp,
    remainingEnergy: pokemon.energy,
    remainingShields: pokemon.shields,
  };
}

export class PvpokeOneOnOneAdapter implements OneOnOneSimulationAdapter {
  constructor(private readonly runtime: PvpokeBattleRuntime) {}

  async simulate(
    request: OneOnOneSimulationRequest,
  ): Promise<OneOnOneSimulationResult> {
    await this.runtime.ready();
    const battle = this.runtime.createBattle();
    battle.setLevelCap(request.format.levelCap);
    battle.setCP(request.format.cpCap);
    battle.setCup(request.format.cup);

    const first = configurePokemon(
      this.runtime,
      battle,
      request.combatants[0].build,
      0,
      request.combatants[0].shields,
    );
    const second = configurePokemon(
      this.runtime,
      battle,
      request.combatants[1].build,
      1,
      request.combatants[1].shields,
    );

    battle.simulate();
    const ratings = battle.getBattleRatings();
    const winner = battle.getWinner();
    const winnerIndex =
      winner.pokemon === false
        ? "tie"
        : winner.pokemon === first
          ? 0
          : 1;

    return {
      winner: winnerIndex,
      combatants: [
        translateCombatant(0, first, ratings[0]),
        translateCombatant(1, second, ratings[1]),
      ],
      turnsToWin: battle.getTurnsToWin(),
      dataVersion: request.dataVersion,
      engine: "pvpoke-upstream",
      assumptions: [
        "PvPoke default simulation decision logic",
        "No starting energy, HP, or stat-stage advantage",
        "No switching or three-on-three battle AI",
        "Buff chance behavior is controlled by the upstream engine default",
      ],
    };
  }
}
