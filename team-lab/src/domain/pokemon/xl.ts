export const CANDY_XL_LEVEL_THRESHOLD = 40;

export function requiresCandyXl(level: number): boolean {
  return level > CANDY_XL_LEVEL_THRESHOLD;
}
