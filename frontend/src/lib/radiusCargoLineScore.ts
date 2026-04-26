import type { FlipResult } from "@/lib/types";
import type { RouteAggregateMetrics } from "@/lib/useRadiusRouteInsights";

type RadiusCargoLineScoreInput = {
  row: FlipResult;
  aggregate?: RouteAggregateMetrics;
  profitPerUnit: number;
  volumePerUnit: number;
  confidence: number;
  execution: number;
  buyPrice: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function scoreRadiusCargoLine(input: RadiusCargoLineScoreInput): number {
  const { row, aggregate, profitPerUnit, volumePerUnit, confidence, execution, buyPrice } = input;
  const realProfit = Math.max(0, row.RealProfit ?? row.TotalProfit ?? 0);
  const expectedProfit = Math.max(0, row.ExpectedProfit ?? row.TotalProfit ?? 0);
  const profitQuality = expectedProfit > 0 ? clamp01(realProfit / expectedProfit) : 0.5;
  const iskPerM3 = volumePerUnit > 0 ? profitPerUnit / volumePerUnit : 0;
  const jumpCount = Math.max(1, row.TotalJumps ?? 1);
  const jumpEfficiency = clamp01(1 - (jumpCount - 1) / 25);
  const executionQuality = clamp01(execution / 100);
  const fillability = clamp01(confidence / 100);
  const turnoverPenalty = clamp01((aggregate?.turnoverDays ?? 0) / 30);
  const slippagePenalty = clamp01((aggregate?.weightedSlippagePct ?? 0) / 15);
  const trapRiskPenalty = clamp01((aggregate?.riskTotalCount ?? 0) / 8);
  const capitalEfficiency = buyPrice > 0 ? clamp01(profitPerUnit / buyPrice) : 0;

  return (
    profitQuality * 0.18 +
    clamp01(iskPerM3 / 5_000) * 0.2 +
    jumpEfficiency * 0.09 +
    executionQuality * 0.12 +
    fillability * 0.1 +
    capitalEfficiency * 0.16 -
    turnoverPenalty * 0.06 -
    slippagePenalty * 0.05 -
    trapRiskPenalty * 0.08
  );
}
