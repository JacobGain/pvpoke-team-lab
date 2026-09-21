import type { PokemonCatalogEntry } from '@/domain/pokemon/catalog';
import { calculateCombatPower } from '@/domain/pokemon/combatPower';
import type { ExactSimulationBuild } from '@/domain/simulation/contracts';

export function fitDuelLevel(pokemon: PokemonCatalogEntry, ivs: ExactSimulationBuild['ivs'], cpCap: number) {
  let level = Math.min(50, pokemon.levelCap);
  while (level > pokemon.levelFloor && calculateCombatPower(pokemon.baseStats, ivs, level) > cpCap) level -= 0.5;
  return level;
}

export function defaultDuelBuild(pokemon: PokemonCatalogEntry, cpCap: number): ExactSimulationBuild {
  const spread = pokemon.defaultIvsByCp?.[cpCap] ?? pokemon.defaultLeagueIvs;
  const ivs = spread ? { attack: spread.attack, defense: spread.defense, hp: spread.hp } : { attack: 15, defense: 15, hp: 15 };
  const recommended = pokemon.ranking?.recommendedMoveIds ?? [];
  const fastMoveId = pokemon.fastMoves.find(move => recommended.includes(move.id))?.id ?? pokemon.fastMoves[0]?.id ?? '';
  const charged = [...pokemon.chargedMoves].sort((a, b) => Number(recommended.includes(b.id)) - Number(recommended.includes(a.id)));
  const level = fitDuelLevel(pokemon, ivs, cpCap);
  return { speciesId: pokemon.speciesId, speciesName: pokemon.speciesName, ivs, level,
    cp: calculateCombatPower(pokemon.baseStats, ivs, level), fastMoveId,
    chargedMoveIds: charged[1] ? [charged[0]!.id, charged[1].id] : [charged[0]?.id ?? ''],
    isShadow: pokemon.isShadow, source: 'meta-default' };
}

export function duelBuildError(build: ExactSimulationBuild, pokemon: PokemonCatalogEntry, cpCap: number): string | undefined {
  if (!Number.isFinite(build.level) || build.level < pokemon.levelFloor || build.level > Math.min(50, pokemon.levelCap) || !Number.isInteger(build.level * 2)) return `Choose a half-level from ${pokemon.levelFloor} to ${Math.min(50, pokemon.levelCap)}.`;
  if (Object.values(build.ivs).some(iv => !Number.isInteger(iv) || iv < 0 || iv > 15)) return 'IVs must be whole numbers from 0 to 15.';
  if (calculateCombatPower(pokemon.baseStats, build.ivs, build.level) > cpCap) return `This build exceeds ${cpCap} CP. Use Fit to league or lower its level.`;
  if (!pokemon.fastMoves.some(move => move.id === build.fastMoveId) || build.chargedMoveIds.some(id => !pokemon.chargedMoves.some(move => move.id === id))) return 'Choose a legal fast move and at least one charged move.';
  if (new Set(build.chargedMoveIds).size !== build.chargedMoveIds.length) return 'Choose different charged moves.';
  return undefined;
}
