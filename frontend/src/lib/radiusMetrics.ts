import type { FlipResult } from "@/lib/types";
import { safeNumber } from "@/lib/batchMetrics";

export type UrgencyBand = "stable" | "aging" | "fragile";

export type UrgencyClassification = {
  urgency_score: number;
  urgency_band: UrgencyBand;
};

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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function classifyFlipUrgency(row: FlipResult): UrgencyClassification {
  const requestedUnits = Math.max(
    safeNumber(row.PreExecutionUnits),
    safeNumber(row.UnitsToBuy),
    safeNumber(row.BuyOrderRemain),
    safeNumber(row.SellOrderRemain),
    1,
  );
  const fillableUnits = Math.max(
    safeNumber(row.FilledQty),
    Math.min(safeNumber(row.BuyOrderRemain), safeNumber(row.SellOrderRemain)),
    0,
  );
  const fillRatio = clamp01(fillableUnits / requestedUnits);
  const depthRisk = 1 - fillRatio;

  const explicitSlipPct = Math.max(
    0,
    safeNumber(row.SlippageBuyPct) + safeNumber(row.SlippageSellPct),
  );
  const buyBase = safeNumber(row.BuyPrice);
  const sellBase = safeNumber(row.SellPrice);
  const buyExec = safeNumber(row.ExpectedBuyPrice);
  const sellExec = safeNumber(row.ExpectedSellPrice);
  const buySlipPctFromExec =
    buyExec > 0 && buyBase > 0 ? ((buyExec - buyBase) / buyBase) * 100 : 0;
  const sellSlipPctFromExec =
    sellExec > 0 && sellBase > 0 ? ((sellBase - sellExec) / sellBase) * 100 : 0;
  const derivedSlipPct = Math.max(0, buySlipPctFromExec + sellSlipPctFromExec);
  const slippageRisk = clamp01(
    Math.max(explicitSlipPct, derivedSlipPct) / 18,
  );

  const totalJumps = safeNumber(row.TotalJumps);
  const jumpRisk = clamp01((Math.max(1, totalJumps) - 1) / 20);

  const staleRisk = clamp01(
    (row.HistoryAvailable === false ? 1 : 0) +
      (hasDestinationPriceDrift(row) ? 0.7 : 0),
  );
  const structuralRisk = clamp01(
    (row.CanFill === false ? 1 : 0) +
      (safeNumber(row.BuyCompetitors) >= 8 ? 0.25 : 0) +
      (safeNumber(row.SellCompetitors) >= 8 ? 0.25 : 0),
  );

  const urgency_score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        (depthRisk * 0.34 +
          slippageRisk * 0.32 +
          jumpRisk * 0.12 +
          staleRisk * 0.12 +
          structuralRisk * 0.1) *
          100,
      ),
    ),
  );

  let urgency_band: UrgencyBand = "stable";
  if (urgency_score >= 70) urgency_band = "fragile";
  else if (urgency_score >= 40) urgency_band = "aging";

  return { urgency_score, urgency_band };
}

function hasDestinationPriceDrift(row: FlipResult): boolean {
  const period = safeNumber(row.DayTargetPeriodPrice);
  const now = safeNumber(row.DayTargetNowPrice);
  if (period <= 0 || now <= 0) return false;
  const driftPct = Math.abs(now - period) / period;
  return driftPct >= 0.08;
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
  endpointScoreDelta?: number;
  endpointRuleHits?: number;
  hasWatchlistSignal?: boolean;
  hasLoopCandidate?: boolean;
  hasBackhaulCandidate?: boolean;
  hasDeprioritizedRows?: boolean;
};

export type TopRoutePicks = {
  bestRecommendedRoutePack: TopRoutePickCandidate | null;
  bestQuickSingleRoute: TopRoutePickCandidate | null;
  bestSafeFillerRoute: TopRoutePickCandidate | null;
};

export type ActionQueueActionType =
  | "buy_now"
  | "filler"
  | "tracked"
  | "loop_outbound"
  | "loop_return"
  | "avoid_hub_race";

export type ActionQueueItem = {
  routeKey: string;
  routeLabel: string;
  action: ActionQueueActionType;
  score: number;
  reasons: string[];
  candidate: TopRoutePickCandidate;
};

export type QueueDerivationInputs = {
  candidates: TopRoutePickCandidate[];
  suppression?: {
    hardBanFiltered?: number;
    softSessionFiltered?: number;
    endpointExcluded?: number;
    deprioritizedRows?: number;
  };
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

function queueScoreBase(candidate: TopRoutePickCandidate): number {
  return (
    safeNumber(candidate.recommendationScore) * 8 +
    safeNumber(candidate.confidenceScore) * 4 +
    safeNumber(candidate.dailyIskPerJump) / 150_000 +
    safeNumber(candidate.totalProfit) / 250_000
  );
}

function deriveActionForCandidate(
  candidate: TopRoutePickCandidate,
): { action: ActionQueueActionType; reasons: string[]; scoreBoost: number } {
  const reasons: string[] = [];
  let action: ActionQueueActionType = "buy_now";
  let scoreBoost = 0;

  if (safeNumber(candidate.trackedShare) >= 0.34 || candidate.hasWatchlistSignal) {
    action = "tracked";
    reasons.push("watchlist_signal");
    scoreBoost += 11;
  }
  if (candidate.hasLoopCandidate && !candidate.hasBackhaulCandidate) {
    action = "loop_outbound";
    reasons.push("loop_candidate_outbound");
    scoreBoost += 9;
  } else if (candidate.hasBackhaulCandidate) {
    action = "loop_return";
    reasons.push("loop_candidate_return");
    scoreBoost += 8;
  }
  if (safeNumber(candidate.confidenceScore) >= 88 && safeNumber(candidate.riskCount) <= 1) {
    action = "buy_now";
    reasons.push("high_confidence");
    scoreBoost += 10;
  } else if (safeNumber(candidate.confidenceScore) <= 65 || safeNumber(candidate.riskCount) >= 4) {
    action = "filler";
    reasons.push("risk_or_confidence_guard");
    scoreBoost -= 10;
  }
  if (safeNumber(candidate.endpointScoreDelta) <= -8) {
    action = "avoid_hub_race";
    reasons.push("endpoint_hub_penalty");
    scoreBoost -= 12;
  }
  if (candidate.hasDeprioritizedRows) {
    reasons.push("session_deprioritized");
    scoreBoost -= 6;
  }
  if (safeNumber(candidate.endpointRuleHits) > 0) {
    reasons.push("endpoint_rules_applied");
  }
  if (reasons.length === 0) {
    reasons.push("baseline_rank");
  }
  return { action, reasons, scoreBoost };
}

export function deriveActionQueue(inputs: QueueDerivationInputs): ActionQueueItem[] {
  const normalized = inputs.candidates.filter(
    (candidate) =>
      candidate.routeKey.trim().length > 0 &&
      candidate.routeLabel.trim().length > 0,
  );
  const queue = normalized.map((candidate) => {
    const { action, reasons, scoreBoost } = deriveActionForCandidate(candidate);
    const suppressionPenalty =
      (inputs.suppression?.hardBanFiltered ?? 0) * 0.05 +
      (inputs.suppression?.softSessionFiltered ?? 0) * 0.04 +
      (inputs.suppression?.endpointExcluded ?? 0) * 0.03 +
      (inputs.suppression?.deprioritizedRows ?? 0) * 0.02;
    return {
      routeKey: candidate.routeKey,
      routeLabel: candidate.routeLabel,
      action,
      reasons,
      candidate,
      score: queueScoreBase(candidate) + scoreBoost - suppressionPenalty,
    };
  });
  return queue.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.candidate.confidenceScore !== left.candidate.confidenceScore) {
      return right.candidate.confidenceScore - left.candidate.confidenceScore;
    }
    return left.routeLabel.localeCompare(right.routeLabel);
  });
}
