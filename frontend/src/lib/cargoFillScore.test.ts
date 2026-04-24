import { describe, expect, it } from "vitest";
import { computeCargoFillScore } from "@/lib/cargoFillScore";

describe("computeCargoFillScore", () => {
  it("increases when cargo fill and isk/jump improve", () => {
    const baseline = computeCargoFillScore({
      cargoFillRatio: 0.4,
      iskPerJump: 15_000_000,
      expectedProfitIsk: 100_000_000,
      capitalEfficiency: 0.2,
      confidencePercent: 60,
      executionQuality: 60,
      riskPenalty: 0.1,
      slippagePenalty: 0.1,
    });
    const improved = computeCargoFillScore({
      cargoFillRatio: 0.85,
      iskPerJump: 90_000_000,
      expectedProfitIsk: 300_000_000,
      capitalEfficiency: 0.35,
      confidencePercent: 60,
      executionQuality: 60,
      riskPenalty: 0.1,
      slippagePenalty: 0.1,
    });
    expect(improved).toBeGreaterThan(baseline);
  });

  it("penalizes higher risk and slippage", () => {
    const safer = computeCargoFillScore({
      cargoFillRatio: 0.8,
      iskPerJump: 70_000_000,
      expectedProfitIsk: 220_000_000,
      capitalEfficiency: 0.35,
      confidencePercent: 85,
      executionQuality: 80,
      riskPenalty: 0.05,
      slippagePenalty: 0.04,
    });
    const riskier = computeCargoFillScore({
      cargoFillRatio: 0.8,
      iskPerJump: 70_000_000,
      expectedProfitIsk: 220_000_000,
      capitalEfficiency: 0.35,
      confidencePercent: 85,
      executionQuality: 80,
      riskPenalty: 0.6,
      slippagePenalty: 0.5,
    });
    expect(riskier).toBeLessThan(safer);
  });
});
