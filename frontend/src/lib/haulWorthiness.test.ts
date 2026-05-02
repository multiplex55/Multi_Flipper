import { describe, expect, it } from "vitest";
import { classifyHaulWorthiness } from "@/lib/haulWorthiness";

describe("classifyHaulWorthiness", () => {
  it("returns short_efficient for short strong routes", () => {
    const out = classifyHaulWorthiness({ jumps: 12, profitIsk: 150_000_000, iskPerJump: 10_000_000, cargoUsedPercent: 75 });
    expect(out.label).toBe("short_efficient");
  });

  it("returns long_worth_it for strong long-haul thresholds", () => {
    const out = classifyHaulWorthiness({ jumps: 50, profitIsk: 510_000_000, iskPerJump: 10_500_000, cargoUsedPercent: 60 });
    expect(out.label).toBe("long_worth_it");
  });

  it("returns long_marginal on long-haul edge threshold", () => {
    const out = classifyHaulWorthiness({ jumps: 45, profitIsk: 300_000_000, iskPerJump: 6_500_000, cargoUsedPercent: 40 });
    expect(out.label).toBe("long_marginal");
  });

  it("returns long_not_worth when long-haul misses thresholds", () => {
    const out = classifyHaulWorthiness({ jumps: 56, profitIsk: 120_000_000, iskPerJump: 2_000_000, cargoUsedPercent: 22 });
    expect(out.label).toBe("long_not_worth");
  });
});
