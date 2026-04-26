import { describe, expect, it } from "vitest";
import { buildRouteDecisionExplanation, explainLensDelta } from "@/lib/routeExplanation";

const baseInput = {
  routeKey: "1:2",
  routeLabel: "Jita → Amarr",
  recommendationScore: 72,
  dailyIskPerJump: 2_100_000,
  totalProfit: 120_000_000,
  confidenceScore: 64,
  executionQuality: 71,
  weightedSlippagePct: 9.4,
  turnoverDays: 12,
  cargoUsePercent: 78,
  riskCount: 3,
  staleVerificationPenalty: 8,
  missingVerification: true,
  thinDepthCount: 2,
  exitOverhangDays: 11,
  jumpBurden: 16,
};

describe("routeExplanation", () => {
  it("builds deterministic factor decomposition with warnings", () => {
    const explanation = buildRouteDecisionExplanation(baseInput, "recommended");
    expect(explanation.totalScore).toBeCloseTo(61.0, 1);
    expect(explanation.positiveFactors.length).toBeGreaterThan(0);
    expect(explanation.negativeFactors.map((entry) => entry.key)).toContain("stale_verification_penalty");
    expect(explanation.positives.length).toBeGreaterThan(0);
    expect(explanation.warnings).toEqual(
      expect.arrayContaining([
        "High weighted slippage",
        "Elevated route risk flags",
        "Verification snapshot is stale",
        "Verification snapshot missing",
        "Thin top-of-book depth on route lines",
      ]),
    );
    expect(explanation.recommendedActions).toEqual(
      expect.arrayContaining([
        "Capture a verification snapshot before queueing this route.",
        "Trim order size or split fills to reduce slippage pressure.",
      ]),
    );
  });

  it("changes contribution mix by lens", () => {
    const safe = buildRouteDecisionExplanation(baseInput, "safest");
    const fast = buildRouteDecisionExplanation(baseInput, "fastest_isk");
    const safeConfidence = safe.factors.find((factor) => factor.key === "confidence")?.weighted ?? 0;
    const fastConfidence = fast.factors.find((factor) => factor.key === "confidence")?.weighted ?? 0;
    expect(safeConfidence).toBeGreaterThan(fastConfidence);
    expect(explainLensDelta(baseInput, "safest", "fastest_isk")).toContain("Lens change moves score");
  });
});
