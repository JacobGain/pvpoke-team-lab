import { ownedLevelForBattleLevel } from "./mega";

export const CANDY_XL_LEVEL_THRESHOLD = 40;

export function requiresCandyXl(level: number): boolean {
  return level > CANDY_XL_LEVEL_THRESHOLD;
}

/** Mega bonus levels are not purchased power-ups. */
export function requiresCandyXlForBattleLevel(level: number, megaLevel?: number): boolean {
  return requiresCandyXl(ownedLevelForBattleLevel(level, megaLevel));
}
