import type { FlipResult } from "@/lib/types";
import { safeNumber } from "@/lib/batchMetrics";

export function safeJumps(totalJumps: unknown): number {
  return Math.max(1, safeNumber(totalJumps));
}

export function realIskPerJump(row: FlipResult): number {
  return safeNumber(row.RealProfit) / safeJumps(row.TotalJumps);
}

export function dailyIskPerJump(row: FlipResult): number {
  return safeNumber(row.DailyProfit) / safeJumps(row.TotalJumps);
}

export function realIskPerM3PerJump(row: FlipResult): number {
  const filledQty = safeNumber(row.FilledQty);
  const volume = safeNumber(row.Volume);
  if (filledQty <= 0 || volume <= 0) return 0;
  const denom = filledQty * volume * safeJumps(row.TotalJumps);
  if (denom <= 0) return 0;
  return safeNumber(row.RealProfit) / denom;
}

export function capitalRequired(row: FlipResult): number {
  const direct = safeNumber(row.DayCapitalRequired);
  if (direct > 0) return direct;
  const qty = safeNumber(row.FilledQty);
  if (qty <= 0) return 0;
  const buy = safeNumber(row.ExpectedBuyPrice);
  if (buy > 0) return qty * buy;
  return qty * Math.max(0, safeNumber(row.BuyPrice));
}

export function turnoverDays(row: FlipResult): number | null {
  const daily = safeNumber(row.DailyProfit);
  if (daily <= 0) return null;
  const cap = capitalRequired(row);
  if (cap <= 0) return null;
  return cap / daily;
}

export function shownFillQty(row: FlipResult): number {
  const filled = safeNumber(row.FilledQty);
  if (filled > 0) return filled;
  return 0;
}

export function slippageCostIsk(row: FlipResult): number {
  const qty = shownFillQty(row);
  if (qty <= 0) return 0;

  const buyBase = safeNumber(row.BuyPrice);
  const buyExec = safeNumber(row.ExpectedBuyPrice);
  const buySlipPerUnit =
    buyExec > 0 && buyBase > 0 ? Math.max(0, buyExec - buyBase) : 0;

  const sellBase = safeNumber(row.SellPrice);
  const sellExec = safeNumber(row.ExpectedSellPrice);
  const sellSlipPerUnit =
    sellExec > 0 && sellBase > 0 ? Math.max(0, sellBase - sellExec) : 0;

  return qty * (buySlipPerUnit + sellSlipPerUnit);
}

export function radiusRouteKey(row: FlipResult): string {
  return [
    safeNumber(row.BuyLocationID) || safeNumber(row.BuySystemID),
    safeNumber(row.SellLocationID) || safeNumber(row.SellSystemID),
    row.BuyStation || row.BuySystemName || "",
    row.SellStation || row.SellSystemName || "",
  ].join(":");
}

export function routeRecommendationScoreFromMetrics(input: {
  routeDailyIskPerJump: number;
  routeWeakestExecutionQuality: number;
  routeWeightedSlippagePct: number;
  routeTotalRiskCount: number;
  routeTurnoverDays: number | null;
  routeCapacityUsedPercent: number | null;
}): number {
  const dailyNorm = Math.max(
    0,
    Math.min(1, safeNumber(input.routeDailyIskPerJump) / 5_000_000),
  );
  const qualityNorm = Math.max(
    0,
    Math.min(1, safeNumber(input.routeWeakestExecutionQuality) / 100),
  );
  const slipPenalty = Math.max(
    0,
    Math.min(1, safeNumber(input.routeWeightedSlippagePct) / 30),
  );
  const riskPenalty = Math.max(
    0,
    Math.min(1, safeNumber(input.routeTotalRiskCount) / 8),
  );
  const turnoverNorm =
    input.routeTurnoverDays != null && input.routeTurnoverDays > 0
      ? Math.max(0, Math.min(1, 1 - input.routeTurnoverDays / 30))
      : 0.5;
  const utilTarget = 70;
  const util = safeNumber(input.routeCapacityUsedPercent);
  const utilNorm =
    util > 0
      ? Math.max(0, Math.min(1, 1 - Math.abs(util - utilTarget) / utilTarget))
      : 0.4;
  const score =
    0.28 * dailyNorm +
    0.28 * qualityNorm +
    0.14 * turnoverNorm +
    0.12 * utilNorm -
    0.1 * slipPenalty -
    0.08 * riskPenalty;
  return Math.max(0, Math.min(100, score * 100));
}

export type TopRoutePickCandidate = {
  routeKey: string;
  routeLabel: string;
  totalProfit: number;
  dailyIskPerJump: number;
  confidenceScore: number;
  cargoUsePercent: number;
  recommendationScore: number;
  stopCount: number;
  riskCount: number;
  trackedShare?: number;
};

export type TopRoutePicks = {
  bestRecommendedRoutePack: TopRoutePickCandidate | null;
  bestQuickSingleRoute: TopRoutePickCandidate | null;
  bestSafeFillerRoute: TopRoutePickCandidate | null;
};

function scoreQuickRoute(candidate: TopRoutePickCandidate): number {
  return (
    safeNumber(candidate.dailyIskPerJump) * 1.25 +
    safeNumber(candidate.confidenceScore) * 12 -
    safeNumber(candidate.stopCount) * 100_000
  );
}

function scoreSafeFillerRoute(candidate: TopRoutePickCandidate): number {
  return (
    safeNumber(candidate.confidenceScore) * 22 +
    Math.max(0, 100 - safeNumber(candidate.riskCount) * 15) * 8 +
    Math.max(0, 100 - Math.abs(safeNumber(candidate.cargoUsePercent) - 50)) * 4 +
    safeNumber(candidate.totalProfit) / 250_000
  );
}

function pickTopCandidate(
  candidates: TopRoutePickCandidate[],
  score: (candidate: TopRoutePickCandidate) => number,
): TopRoutePickCandidate | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((left, right) => {
    const diff = score(right) - score(left);
    if (diff !== 0) return diff;
    if (right.confidenceScore !== left.confidenceScore) {
      return right.confidenceScore - left.confidenceScore;
    }
    if (right.totalProfit !== left.totalProfit) {
      return right.totalProfit - left.totalProfit;
    }
    return left.routeLabel.localeCompare(right.routeLabel);
  })[0];
}

export function selectTopRoutePicks(
  candidates: TopRoutePickCandidate[],
): TopRoutePicks {
  const normalized = candidates.filter(
    (candidate) =>
      candidate.routeKey.trim().length > 0 &&
      candidate.routeLabel.trim().length > 0,
  );
  return {
    bestRecommendedRoutePack: pickTopCandidate(
      normalized,
      (candidate) =>
        safeNumber(candidate.recommendationScore) * 20 +
        safeNumber(candidate.confidenceScore) * 8 +
        safeNumber(candidate.dailyIskPerJump) +
        safeNumber(candidate.totalProfit) / 200_000 +
        Math.min(90, Math.max(0, safeNumber(candidate.trackedShare) * 90)),
    ),
    bestQuickSingleRoute: pickTopCandidate(normalized, scoreQuickRoute),
    bestSafeFillerRoute: pickTopCandidate(normalized, scoreSafeFillerRoute),
  };
}
