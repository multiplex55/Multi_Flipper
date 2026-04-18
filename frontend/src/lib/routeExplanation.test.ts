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
};

describe("routeExplanation", () => {
  it("builds deterministic factor decomposition with warnings", () => {
    const explanation = buildRouteDecisionExplanation(baseInput, "recommended");
    expect(explanation.totalScore).toBeCloseTo(61.0, 1);
    expect(explanation.positives.length).toBeGreaterThan(0);
    expect(explanation.negatives.map((entry) => entry.key)).toContain("stale_verification_penalty");
    expect(explanation.warnings).toEqual(
      expect.arrayContaining(["High weighted slippage", "Elevated route risk flags", "Verification snapshot is stale"]),
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
