import { describe, expect, it } from "vitest";

import { requiresCandyXl, requiresCandyXlForBattleLevel } from "@/domain/pokemon/xl";

describe("Candy XL level labeling", () => {
  it("labels power-up levels above 40 as XL", () => {
    expect(requiresCandyXl(40)).toBe(false);
    expect(requiresCandyXl(40.5)).toBe(true);
    expect(requiresCandyXl(50)).toBe(true);
  });
  it("does not charge Candy XL for the Super Mega's two effective bonus levels", () => {
    expect(requiresCandyXlForBattleLevel(42, 4)).toBe(false);
    expect(requiresCandyXlForBattleLevel(42.5, 4)).toBe(true);
    expect(requiresCandyXlForBattleLevel(41, 3)).toBe(true);
    expect(requiresCandyXlForBattleLevel(52, 4)).toBe(true);
  });
});
