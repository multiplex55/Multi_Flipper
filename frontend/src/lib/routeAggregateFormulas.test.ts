import { describe, expect, it } from "vitest";
import {
  routeBreakevenBufferPct,
  routeDailyIskPerJump,
  routeDailyProfitOverCapitalPct,
  routeExitOverhangDaysWeighted,
  routeIskPerM3PerJump,
} from "@/lib/routeAggregateFormulas";

describe("routeAggregateFormulas", () => {
  it("computes deterministic formula outputs", () => {
    expect(routeDailyIskPerJump(120, 3)).toBe(40);
    expect(routeDailyProfitOverCapitalPct(25, 500)).toBeCloseTo(5, 6);
    expect(routeIskPerM3PerJump(300, 10, 2)).toBe(15);
    expect(routeBreakevenBufferPct(60, 1200)).toBeCloseTo(5, 6);
  });

  it("returns null when required denominators are missing or zero", () => {
    expect(routeDailyIskPerJump(50, 0)).toBeNull();
    expect(routeDailyProfitOverCapitalPct(50, 0)).toBeNull();
    expect(routeIskPerM3PerJump(50, 0, 3)).toBeNull();
    expect(routeIskPerM3PerJump(50, 10, 0)).toBeNull();
    expect(routeBreakevenBufferPct(50, 0)).toBeNull();
  });

  it("weights finite overhang entries and ignores infinite/missing inputs", () => {
    const value = routeExitOverhangDaysWeighted([
      { targetSellSupply: 100, s2bPerDay: 10, weight: 2 }, // 10d
      { targetSellSupply: 60, s2bPerDay: 20, weight: 1 }, // 3d
      { targetSellSupply: 25, s2bPerDay: 0, weight: 5 }, // infinite -> ignored
    ]);
    expect(value).toBeCloseTo((10 * 2 + 3 * 1) / 3, 6);
  });
});
