import type { RadiusBuyRecommendation, RadiusBuyRecommendationAction } from "@/lib/radiusBuyRecommendation";
import type { RadiusCargoBuild, RadiusRejectedCargoBuild } from "@/lib/radiusCargoBuilds";
import type { RadiusBuyStationShoppingList } from "@/lib/radiusBuyStationShoppingList";
import {
  recommendationsFromBuyStationShoppingList,
  recommendationFromCargoBuild,
  recommendationFromRejectedCargoBuild,
  recommendationFromRouteBatch,
  recommendationFromSingleRow,
} from "@/lib/radiusBuyRecommendationAdapters";
import { safeNumber, type RouteBatchMetadataByRoute } from "@/lib/batchMetrics";
import { classifyHaulWorthiness, type HaulWorthinessLabel } from "@/lib/haulWorthiness";
import type { FlipResult } from "@/lib/types";

export type RadiusDecisionQueueKind =
  | "same_leg_batch"
  | "cargo_build"
  | "buy_station_package"
  | "single_item"
  | "new_or_improving"
  | "watchlist_package"
  | "low_capital"
  | "high_confidence"
  | "filler_package";

export type RadiusDecisionRejectedDiagnostic = {
  kind: string;
  message: string;
  actual?: number;
  required?: number;
  severity?: number;
};

export type BuyPlannerMode = "balanced" | "batch_profit" | "batch_isk_per_jump" | "cargo_fill" | "long_haul_worth" | "low_capital";

export type RadiusDecisionScoreBreakdown = {
  positive: {
    profit: number;
    iskPerJump: number;
    cargoEfficiency: number;
    roi: number;
    executionQuality: number;
    fillConfidence: number;
    dailyProfitTurnover: number;
    movement: number;
    watchlistBonus: number;
    longHaulWorth: number;
    verificationReadiness: number;
  };
  negative: {
    riskPenalty: number;
    slippagePenalty: number;
    concentrationPenalty: number;
    capitalLockupPenalty: number;
  };
  totalPenalty: number;
};

export type RadiusDecisionQueueItem = Omit<RadiusBuyRecommendation, "kind" | "scoreBreakdown"> & {
  kind: RadiusDecisionQueueKind;
  score: number;
  haulWorthiness: { label: HaulWorthinessLabel; reason: string };
  scoreBreakdown: RadiusDecisionScoreBreakdown;
  diagnostics: RadiusDecisionRejectedDiagnostic[];
};

export type BuildRadiusDecisionQueueInput = {
  cargoBuilds?: RadiusCargoBuild[];
  rejectedCargoBuilds?: RadiusRejectedCargoBuild[];
  buyStationShoppingLists?: RadiusBuyStationShoppingList[];
  singleRowCandidates?: FlipResult[];
  watchlistFocusedCandidates?: FlipResult[];
  movementOrImprovingCandidates?: FlipResult[];
  routeRowsByKey?: Record<string, FlipResult[]>;
  routeBatchMetadataByRoute?: RouteBatchMetadataByRoute;
  cargoCapacityM3?: number;
  mode?: string;
  maxRecommendations?: number;
  factorWeights?: Partial<{
    profit: number;
    iskPerJump: number;
    cargoEfficiency: number;
    roi: number;
    executionQuality: number;
    fillConfidence: number;
    dailyProfitTurnover: number;
    movement: number;
    watchlistBonus: number;
    riskPenalty: number;
    slippagePenalty: number;
    concentrationPenalty: number;
    capitalLockupPenalty: number;
  }>;
};

export type BuildRadiusDecisionQueueResult = {
  queue: RadiusDecisionQueueItem[];
  rejected: Array<{ id: string; action: RadiusBuyRecommendationAction; diagnostics: RadiusDecisionRejectedDiagnostic[] }>;
};

const DEFAULT_WEIGHTS = {
  profit: 0.24,
  iskPerJump: 0.11,
  cargoEfficiency: 0.1,
  roi: 0.1,
  executionQuality: 0.12,
  fillConfidence: 0.1,
  dailyProfitTurnover: 0.1,
  movement: 0.08,
  watchlistBonus: 0.05,
  riskPenalty: 0.25,
  slippagePenalty: 0.2,
  concentrationPenalty: 0.15,
  capitalLockupPenalty: 0.12,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

function getVerificationAdjustment(item: RadiusBuyRecommendation): { bonus: number; reason?: string } {
  const state = item.verificationState;
  if (!state || state.status === "not_verified") return { bonus: 0 };

  const positiveProfit = safeNumber(item.batchProfitIsk) > 0;
  if (state.status === "verified") return { bonus: positiveProfit ? 0.06 : 0.02 };
  if (state.status === "stale") return { bonus: -0.015, reason: "verification_stale" };
  if (state.status === "failed") return { bonus: -0.08, reason: `verification_failed:${safeNumber(state.failedLineCount) > 0 ? ` ${safeNumber(state.failedLineCount)} lines` : " review needed"}` };
  return { bonus: 0 };
}


const MODE_WEIGHT_OVERRIDES: Record<BuyPlannerMode, Partial<typeof DEFAULT_WEIGHTS>> = {
  balanced: {},
  batch_profit: { profit: 0.38, roi: 0.12, capitalLockupPenalty: 0.1 },
  batch_isk_per_jump: { iskPerJump: 0.3, profit: 0.2, dailyProfitTurnover: 0.12, capitalLockupPenalty: 0.06 },
  cargo_fill: { cargoEfficiency: 0.28, fillConfidence: 0.16, roi: 0.08 },
  long_haul_worth: { iskPerJump: 0.24, profit: 0.22, cargoEfficiency: 0.18, movement: 0.05, capitalLockupPenalty: 0.08 },
  low_capital: { roi: 0.22, dailyProfitTurnover: 0.22, capitalLockupPenalty: 0.2, profit: 0.14 },
};

function scoreRecommendation(item: RadiusBuyRecommendation, kind: RadiusDecisionQueueKind, weights: typeof DEFAULT_WEIGHTS): RadiusDecisionQueueItem {
  const lines = item.lines;
  const profit = safeNumber(item.batchProfitIsk);
  const buy = safeNumber(item.batchCapitalIsk);
  const volume = safeNumber(item.totalVolumeM3);
  const jumps = Math.max(1, safeNumber(item.totalJumps));

  const profitNorm = clamp01(profit / 300_000_000);
  const iskPerJumpNorm = clamp01(safeNumber(item.batchIskPerJump) / 20_000_000);
  const cargoEfficiencyNorm = clamp01((safeNumber(item.cargoUsedPercent) / 100) * (profit / Math.max(1, volume) / 200_000));
  const roiNorm = clamp01(safeNumber(item.batchRoiPercent) / 100);
  const baseBreakdown = item.scoreBreakdown ?? {};
  const executionQualityNorm = clamp01(safeNumber(baseBreakdown.executionQuality));
  const fillConfidenceNorm = clamp01(safeNumber(baseBreakdown.fillConfidence));
  const dailyTurnoverNorm = clamp01(safeNumber(baseBreakdown.dailyProfitTurnover));
  const movementNorm = clamp01(safeNumber(baseBreakdown.movement));
  const watchlistBonusNorm = clamp01(safeNumber(baseBreakdown.watchlistBonus));
  const verificationAdjustment = getVerificationAdjustment(item);

  const haulWorthiness = classifyHaulWorthiness({ jumps, profitIsk: profit, iskPerJump: safeNumber(item.batchIskPerJump), cargoUsedPercent: safeNumber(item.cargoUsedPercent) });
  const longHaulWorthNorm = haulWorthiness.label === "long_worth_it" ? 1 : haulWorthiness.label === "short_efficient" ? 0.85 : haulWorthiness.label === "long_marginal" ? 0.45 : 0;
  const verificationReadinessNorm = clamp01(item.action === "verify" ? 1 : fillConfidenceNorm * executionQualityNorm);

  const riskPenalty = clamp01(safeNumber(baseBreakdown.riskPenalty));
  const slippagePenalty = clamp01(safeNumber(baseBreakdown.slippagePenalty));
  const concentrationPenalty = clamp01(lines.length <= 1 ? 0.8 : 0.2);
  const capitalLockPenalty = clamp01(buy / 1_500_000_000);

  const positive =
    profitNorm * weights.profit +
    iskPerJumpNorm * weights.iskPerJump +
    cargoEfficiencyNorm * weights.cargoEfficiency +
    roiNorm * weights.roi +
    executionQualityNorm * weights.executionQuality +
    fillConfidenceNorm * weights.fillConfidence +
    dailyTurnoverNorm * weights.dailyProfitTurnover +
    movementNorm * weights.movement +
    watchlistBonusNorm * weights.watchlistBonus +
    longHaulWorthNorm * 0.1 +
    verificationReadinessNorm * 0.05 +
    verificationAdjustment.bonus;
  const totalPenalty =
    riskPenalty * weights.riskPenalty +
    slippagePenalty * weights.slippagePenalty +
    concentrationPenalty * weights.concentrationPenalty +
    capitalLockPenalty * weights.capitalLockupPenalty;

  const score = Math.max(0, Math.min(100, (positive - totalPenalty) * 100));

  return {
    ...item,
    kind,
    score,
    haulWorthiness,
    diagnostics: [...(item.diagnostics ?? []), ...(verificationAdjustment.reason ? [{ kind: "verification", message: verificationAdjustment.reason }] : [])],
    scoreBreakdown: {
      positive: {
        profit: profitNorm,
        iskPerJump: iskPerJumpNorm,
        cargoEfficiency: cargoEfficiencyNorm,
        roi: roiNorm,
        executionQuality: executionQualityNorm,
        fillConfidence: fillConfidenceNorm,
        dailyProfitTurnover: dailyTurnoverNorm,
        movement: movementNorm,
        watchlistBonus: watchlistBonusNorm,
        longHaulWorth: longHaulWorthNorm,
        verificationReadiness: verificationReadinessNorm,
      },
      negative: {
        riskPenalty,
        slippagePenalty,
        concentrationPenalty,
        capitalLockupPenalty: capitalLockPenalty,
      },
      totalPenalty,
    },
  };
}

export function buildRadiusDecisionQueue(input: BuildRadiusDecisionQueueInput): BuildRadiusDecisionQueueResult {
  const mode = (input.mode ?? "balanced") as BuyPlannerMode;
  const weights = { ...DEFAULT_WEIGHTS, ...(MODE_WEIGHT_OVERRIDES[mode] ?? MODE_WEIGHT_OVERRIDES.balanced), ...(input.factorWeights ?? {}) };
  const queue: RadiusDecisionQueueItem[] = [];
  const rejected: BuildRadiusDecisionQueueResult["rejected"] = [];

  for (const build of input.cargoBuilds ?? []) queue.push(scoreRecommendation(recommendationFromCargoBuild(build, { source: "decision_queue" }), "cargo_build", weights));
  for (const [routeKey, rows] of Object.entries(input.routeRowsByKey ?? {})) queue.push(scoreRecommendation(recommendationFromRouteBatch(routeKey, rows, input.routeBatchMetadataByRoute?.[routeKey], input.cargoCapacityM3 ?? 0, { source: `decision_queue:${input.mode ?? "default"}` }), "same_leg_batch", weights));
  for (const list of input.buyStationShoppingLists ?? []) {
    for (const recommendation of recommendationsFromBuyStationShoppingList(list, { source: "decision_queue" })) {
      queue.push(scoreRecommendation(recommendation, "buy_station_package", weights));
    }
  }
  for (const row of input.singleRowCandidates ?? []) queue.push(scoreRecommendation(recommendationFromSingleRow(row, { source: "decision_queue" }), "single_item", weights));
  for (const row of input.watchlistFocusedCandidates ?? []) queue.push(scoreRecommendation(recommendationFromSingleRow(row, { source: "decision_queue:watchlist" }), "watchlist_package", weights));
  for (const row of input.movementOrImprovingCandidates ?? []) queue.push(scoreRecommendation(recommendationFromSingleRow(row, { source: "decision_queue:movement" }), "new_or_improving", weights));

  for (const nearMiss of input.rejectedCargoBuilds ?? []) {
    const mapped = recommendationFromRejectedCargoBuild(nearMiss, { source: "decision_queue" });
    if (mapped.action === "buy") mapped.action = "verify";
    mapped.reasons.push("near_miss_requires_manual_review");
    rejected.push({ id: mapped.id, action: mapped.action, diagnostics: mapped.diagnostics ?? [] });
    queue.push(scoreRecommendation(mapped, "filler_package", weights));
  }

  for (const item of queue) {
    if (item.kind === "watchlist_package" && item.action === "buy") item.action = "watch";
    if (item.kind === "new_or_improving" && item.score > 75) item.kind = "high_confidence";
    else if (item.score < 25 && item.kind !== "filler_package") item.kind = "low_capital";
    if (item.id.startsWith("rejected:") && item.action === "buy") item.action = "verify";
  }

  queue.sort((a, b) => b.score - a.score || b.scoreBreakdown.positive.longHaulWorth - a.scoreBreakdown.positive.longHaulWorth || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const limited = (input.maxRecommendations ?? 0) > 0 ? queue.slice(0, input.maxRecommendations) : queue;
  return { queue: limited, rejected };
}
