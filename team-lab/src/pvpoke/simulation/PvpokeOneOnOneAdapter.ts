import type {
  BattleReplayFrame,
  BattleReplayState,
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

export function configurePvpokePokemon(
  runtime: PvpokeBattleRuntime,
  battle: PvpokeBattle,
  build: ExactSimulationBuild,
  index: CombatantIndex,
  shields: number,
): PvpokePokemon {
  const pokemon = runtime.createPokemon(build.speciesId, index, battle);
  if (battle.getCup?.()?.name === "all" && pokemon.tags?.includes("mega")) {
    throw new RangeError(`Select a Mega league to simulate ${build.speciesId}.`);
  }

  const selected = [build.fastMoveId, ...build.chargedMoveIds, ...(build.extraChargedMoveId ? [build.extraChargedMoveId] : [])];
  if (!Number.isFinite(build.level) || build.level < 1 || build.level > 52 || build.level * 2 % 1 !== 0) {
    throw new RangeError(`Invalid battle level for ${build.speciesId}.`);
  }
  if (build.chargedMoveIds.length < 1 || build.chargedMoveIds.length > 2 || new Set(selected).size !== selected.length) {
    throw new RangeError(`Invalid attack slots for ${build.speciesId}.`);
  }
  if (build.megaLevel !== undefined && ![1, 2, 3, 4].includes(build.megaLevel)) {
    throw new RangeError(`Invalid Mega level for ${build.speciesId}.`);
  }
  if (pokemon.tags && !pokemon.tags.includes("mega") && (build.megaLevel !== undefined || build.extraChargedMoveId)) {
    throw new RangeError(`Mega settings require a Mega or Primal form: ${build.speciesId}.`);
  }
  const checkMove = (pool: readonly { readonly moveId: string }[] | undefined, id: string, slot: string) => {
    if (pool && !pool.some(move => move.moveId === id)) throw new RangeError(`${id} is not a legal ${slot} for ${build.speciesId}.`);
  };
  checkMove(pokemon.fastMovePool, build.fastMoveId, "fast attack");
  for (const id of build.chargedMoveIds) checkMove(pokemon.chargedMovePool, id, "ordinary charged attack");
  if (build.extraChargedMoveId) checkMove(pokemon.extraChargedMovePool, build.extraChargedMoveId, "extra charged attack");
  // setMegaLevel may itself change level. Always apply the exact effective
  // battle level afterwards so the bonus is neither lost nor applied twice.
  if (build.megaLevel !== undefined) pokemon.setMegaLevel(build.megaLevel);
  const megaLevel = build.megaLevel ?? pokemon.megaLevel;
  if (build.level > (megaLevel === 4 && pokemon.tags?.includes("mega") ? 52 : 51)) {
    throw new RangeError(`Battle level exceeds this build's level limit: ${build.speciesId}.`);
  }

  pokemon.setIV("atk", build.ivs.attack);
  pokemon.setIV("def", build.ivs.defense);
  pokemon.setIV("hp", build.ivs.hp);
  pokemon.setLevel(build.level, true);
  pokemon.setShadowType(build.isShadow ? "shadow" : "normal");
  pokemon.selectMove("fast", build.fastMoveId);
  pokemon.selectMove("charged", build.chargedMoveIds[0], 0);
  // Set index 2 before clearing index 1 so upstream keeps a null slot rather
  // than creating an undefined array hole (its filters only exclude null).
  if (build.extraChargedMoveId) pokemon.selectMove("extra-charged", build.extraChargedMoveId, 2);

  if (build.chargedMoveIds[1]) {
    pokemon.selectMove("charged", build.chargedMoveIds[1], 1);
  } else {
    pokemon.selectMove("charged", "none", 1);
  }
  if (!build.extraChargedMoveId) pokemon.selectMove("extra-charged", "none", 2);

  if (pokemon.level !== undefined && pokemon.level !== build.level) throw new Error(`Engine changed the requested level for ${build.speciesId}.`);
  if (pokemon.cp !== undefined && pokemon.cp !== build.cp) throw new Error(`Engine CP ${pokemon.cp} differs from requested CP ${build.cp} for ${build.speciesId}.`);
  if (pokemon.chargedMoves && (
    pokemon.fastMove?.moveId !== build.fastMoveId ||
    pokemon.chargedMoves[0]?.moveId !== build.chargedMoveIds[0] ||
    pokemon.chargedMoves[1]?.moveId !== build.chargedMoveIds[1] ||
    pokemon.chargedMoves[2]?.moveId !== build.extraChargedMoveId
  )) throw new Error(`Engine changed the requested attack slots for ${build.speciesId}.`);

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
    if (request.combatants.some(({ build }) => !Number.isFinite(build.cp) || build.cp > request.format.cpCap || build.cp < 10)) {
      throw new RangeError("A simulation build exceeds the league CP limit or has invalid CP.");
    }
    await this.runtime.ready();
    const battle = this.runtime.createBattle();
    battle.setLevelCap(request.format.levelCap);
    battle.setCP(request.format.cpCap);
    battle.setCup(request.format.cup);

    const first = configurePvpokePokemon(
      this.runtime,
      battle,
      request.combatants[0].build,
      0,
      request.combatants[0].shields,
    );
    const second = configurePvpokePokemon(
      this.runtime,
      battle,
      request.combatants[1].build,
      1,
      request.combatants[1].shields,
    );

    // Observe the engine after each step rather than reconstructing HP from
    // damage events: special forms and simultaneous attacks can alter state.
    const replay: BattleReplayFrame[] = [];
    const snapshot = (pokemon: PvpokePokemon): BattleReplayState => ({
      hp: Math.max(0, pokemon.hp), maximumHp: pokemon.stats.hp,
      energy: pokemon.energy, shields: pokemon.shields,
      form: pokemon.activeFormId || pokemon.speciesId,
      buffs: [...(pokemon.statBuffs ?? [0, 0])],
    });
    // Preserve the original method for restoration; invoke with its battle receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalStep = battle.step;
    if (request.captureReplay) {
      if (!originalStep || !battle.getTimeline || !battle.getTurns) {
        throw new Error("This battle engine does not support turn playback.");
      }
      let eventOffset = 0;
      battle.step = () => {
        const turn = battle.getTurns!();
        if (replay.length === 0) {
          replay.push({ turn: 0, events: [], combatants: [snapshot(first), snapshot(second)] });
        }
        const value = originalStep.call(battle);
        const timeline = battle.getTimeline!();
        replay.push({
          turn,
          events: timeline.slice(eventOffset).map((event) => ({
            type: event.type, name: event.name, actor: event.actor,
            values: [...event.values],
          })),
          combatants: [snapshot(first), snapshot(second)],
        });
        eventOffset = timeline.length;
        return value;
      };
    }
    try {
      battle.simulate();
    } finally {
      if (originalStep) battle.step = originalStep;
    }
    const ratings = battle.getBattleRatings();
    const winner = battle.getWinner();
    const winnerIndex =
      winner.pokemon === false
        ? "tie"
        : winner.pokemon === first
          ? 0
          : 1;

    return {
      ...(request.captureReplay ? { replay } : {}),
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
