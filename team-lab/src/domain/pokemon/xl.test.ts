import { describe, expect, it } from "vitest";

import { requiresCandyXl } from "@/domain/pokemon/xl";

describe("Candy XL level labeling", () => {
  it("labels power-up levels above 40 as XL", () => {
    expect(requiresCandyXl(40)).toBe(false);
    expect(requiresCandyXl(40.5)).toBe(true);
    expect(requiresCandyXl(50)).toBe(true);
  });
});
