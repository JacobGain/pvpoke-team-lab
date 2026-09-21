import { describe, expect, it } from 'vitest';
import { inventoryTestCatalog } from '@/domain/inventory/inventoryTestFixtures';
import { calculateCombatPower } from '@/domain/pokemon/combatPower';
import { defaultDuelBuild, duelBuildError, fitDuelLevel } from './duelBuild';

const pokemon = inventoryTestCatalog.entries[0]!;
describe('duel build configuration', () => {
  it.each([1500, 2500, 10000])('fits defaults and edited IVs to %i CP', cp => {
    const build = defaultDuelBuild(pokemon, cp);
    expect(duelBuildError(build, pokemon, cp)).toBeUndefined();
    const ivs = { attack: 15, defense: 15, hp: 15 };
    const level = fitDuelLevel(pokemon, ivs, cp);
    expect(calculateCombatPower(pokemon.baseStats, ivs, level)).toBeLessThanOrEqual(cp);
    if (level < 50) expect(calculateCombatPower(pokemon.baseStats, ivs, level + .5)).toBeGreaterThan(cp);
  });
  it('rejects impossible builds and duplicate moves', () => {
    const build = defaultDuelBuild(pokemon, 1500);
    for (const level of [NaN, 0, 25.2, 51]) expect(duelBuildError({ ...build, level }, pokemon, 1500)).toBeTruthy();
    expect(duelBuildError({ ...build, ivs: { ...build.ivs, attack: 16 } }, pokemon, 1500)).toBeTruthy();
    expect(duelBuildError({ ...build, level: 50, ivs: { attack: 15, defense: 15, hp: 15 } }, pokemon, 1500)).toContain('exceeds');
    expect(duelBuildError({ ...build, chargedMoveIds: ['ICE_BEAM', 'ICE_BEAM'] }, pokemon, 1500)).toContain('different');
    expect(duelBuildError({ ...build, fastMoveId: 'INVALID' }, pokemon, 1500)).toContain('legal');
  });
});
