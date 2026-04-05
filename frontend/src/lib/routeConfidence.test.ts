import { describe, expect, it } from "vitest";
import { calcRouteConfidence, ROUTE_CONFIDENCE_WEIGHTS } from "@/lib/routeConfidence";

describe("routeConfidence", () => {
  it("exposes explicit centralized weights", () => {
    const sum = Object.values(ROUTE_CONFIDENCE_WEIGHTS).reduce((acc, v) => acc + v, 0);
    expect(sum).toBeCloseTo(1, 8);
  });

  it("changes badge level across synthetic high/medium/low risk profiles", () => {
    const high = calcRouteConfidence({
      routeSafetyRank: 0,
      weakestExecutionQuality: 95,
      weightedSlippagePct: 0.5,
      riskSpikeCount: 0,
      riskNoHistoryCount: 0,
      riskUnstableHistoryCount: 0,
      exitOverhangDays: 2,
    });
    const medium = calcRouteConfidence({
      routeSafetyRank: 1,
      weakestExecutionQuality: 70,
      weightedSlippagePct: 6,
      riskSpikeCount: 1,
      riskNoHistoryCount: 0,
      riskUnstableHistoryCount: 1,
      exitOverhangDays: 15,
    });
    const low = calcRouteConfidence({
      routeSafetyRank: 2,
      weakestExecutionQuality: 35,
      weightedSlippagePct: 18,
      riskSpikeCount: 3,
      riskNoHistoryCount: 2,
      riskUnstableHistoryCount: 2,
      exitOverhangDays: 70,
    });

    expect(high.label).toBe("High");
    expect(medium.label).toBe("Medium");
    expect(low.label).toBe("Low");
    expect(high.score).toBeGreaterThan(medium.score);
    expect(medium.score).toBeGreaterThan(low.score);
  });
});
