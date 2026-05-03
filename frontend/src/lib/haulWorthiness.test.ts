import { describe, expect, it } from "vitest";
import { HAUL_WORTHINESS_THRESHOLDS, classifyHaulWorthiness } from "@/lib/haulWorthiness";

describe("classifyHaulWorthiness", () => {
  it("classifies short efficient at boundary", () => {
    const out = classifyHaulWorthiness({ jumps: HAUL_WORTHINESS_THRESHOLDS.shortRouteMaxJumps, profitIsk: HAUL_WORTHINESS_THRESHOLDS.shortEfficientMinProfitIsk, iskPerJump: HAUL_WORTHINESS_THRESHOLDS.shortEfficientMinIskPerJump, cargoUsedPercent: HAUL_WORTHINESS_THRESHOLDS.shortEfficientMinCargoUsedPercent });
    expect(out.label).toBe("short_efficient");
    expect(out.reason).toContain("Basis: jumps=");
  });

  it("classifies long_worth_it boundary", () => {
    const out = classifyHaulWorthiness({ jumps: HAUL_WORTHINESS_THRESHOLDS.longRouteMinJumps, profitIsk: HAUL_WORTHINESS_THRESHOLDS.longWorthMinProfitIsk, iskPerJump: HAUL_WORTHINESS_THRESHOLDS.longWorthMinIskPerJump, cargoUsedPercent: HAUL_WORTHINESS_THRESHOLDS.longWorthMinCargoUsedPercent });
    expect(out.label).toBe("long_worth_it");
  });

  it("classifies long_marginal boundary", () => {
    const out = classifyHaulWorthiness({ jumps: HAUL_WORTHINESS_THRESHOLDS.longRouteMinJumps, profitIsk: HAUL_WORTHINESS_THRESHOLDS.longMarginalMinProfitIsk, iskPerJump: HAUL_WORTHINESS_THRESHOLDS.longMarginalMinIskPerJump, cargoUsedPercent: HAUL_WORTHINESS_THRESHOLDS.longMarginalMinCargoUsedPercent });
    expect(out.label).toBe("long_marginal");
  });

  it("classifies long_not_worth boundary miss", () => {
    const out = classifyHaulWorthiness({ jumps: HAUL_WORTHINESS_THRESHOLDS.longRouteMinJumps, profitIsk: HAUL_WORTHINESS_THRESHOLDS.longMarginalMinProfitIsk - 1, iskPerJump: HAUL_WORTHINESS_THRESHOLDS.longMarginalMinIskPerJump - 1, cargoUsedPercent: HAUL_WORTHINESS_THRESHOLDS.longMarginalMinCargoUsedPercent - 1 });
    expect(out.label).toBe("long_not_worth");
  });

  it("classifies long profitable full-cargo route as long_worth_it", () => {
    const out = classifyHaulWorthiness({ jumps: 58, profitIsk: 800_000_000, iskPerJump: 14_000_000, cargoUsedPercent: 96 });
    expect(out.label).toBe("long_worth_it");
  });

  it("classifies long weak route as long_not_worth", () => {
    const out = classifyHaulWorthiness({ jumps: 63, profitIsk: 110_000_000, iskPerJump: 2_400_000, cargoUsedPercent: 18 });
    expect(out.label).toBe("long_not_worth");
  });
});
