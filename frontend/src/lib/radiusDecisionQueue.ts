import type { RadiusBuyRecommendation, RadiusBuyRecommendationAction } from "@/lib/radiusBuyRecommendation";
import type { RadiusCargoBuild, RadiusRejectedCargoBuild } from "@/lib/radiusCargoBuilds";
import type { RadiusBuyStationShoppingList } from "@/lib/radiusBuyStationShoppingList";
import {
  recommendationFromBuyStationShoppingList,
  recommendationFromCargoBuild,
  recommendationFromRejectedCargoBuild,
  recommendationFromRouteBatch,
  recommendationFromSingleRow,
} from "@/lib/radiusBuyRecommendationAdapters";
import { safeNumber, type RouteBatchMetadataByRoute } from "@/lib/batchMetrics";
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

export type RadiusDecisionQueueItem = Omit<RadiusBuyRecommendation, "kind"> & {
  kind: RadiusDecisionQueueKind;
  score: number;
  scoreBreakdown: {
    profit: number;
    iskPerJump: number;
    cargoEfficiency: number;
    roi: number;
    executionQuality: number;
    fillConfidence: number;
    dailyProfitTurnover: number;
    movement: number;
    watchlistBonus: number;
    penalties: number;
  };
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


function scoreRecommendation(item: RadiusBuyRecommendation, kind: RadiusDecisionQueueKind, weights: typeof DEFAULT_WEIGHTS): RadiusDecisionQueueItem {
  const lines = item.lines;
  const profit = safeNumber(item.batchProfitIsk);
  const buy = safeNumber(item.batchCapitalIsk);
  const volume = safeNumber(item.totalVolumeM3);
  const jumps = Math.max(1, safeNumber(item.totalJumps));
  const daily = lines.reduce((s, l) => s + safeNumber(l.row?.DailyProfit), 0);

  const profitNorm = clamp01(profit / 300_000_000);
  const iskPerJumpNorm = clamp01(profit / jumps / 20_000_000);
  const cargoEfficiencyNorm = clamp01((safeNumber(item.cargoUsedPercent) / 100) * (profit / Math.max(1, volume) / 200_000));
  const roiNorm = clamp01(safeNumber(item.batchRoiPercent) / 100);
  const executionQualityNorm = clamp01(lines.reduce((s, l) => s + safeNumber((l.row as Record<string, unknown> | undefined)?.ExecutionQuality), 0) / Math.max(1, lines.length) / 100);
  const fillConfidenceNorm = clamp01(lines.reduce((s, l) => s + safeNumber((l.row as Record<string, unknown> | undefined)?.FillConfidencePct), 0) / Math.max(1, lines.length) / 100);
  const dailyTurnoverNorm = clamp01((daily / Math.max(1, buy)) * 12);
  const movementNorm = clamp01(lines.reduce((s, l) => s + safeNumber((l.row as Record<string, unknown> | undefined)?.MovementScore), 0) / Math.max(1, lines.length) / 100);
  const watchlistBonusNorm = clamp01(lines.some((l) => Boolean((l.row as Record<string, unknown> | undefined)?.WatchlistSignal || (l.row as Record<string, unknown> | undefined)?.IsWatchlist)) ? 1 : 0);

  const riskPenalty = clamp01(lines.reduce((s, l) => s + safeNumber((l.row as Record<string, unknown> | undefined)?.RiskCount), 0) / Math.max(1, lines.length) / 8);
  const slippagePenalty = clamp01(lines.reduce((s, l) => s + safeNumber(l.row?.SlippageBuyPct) + safeNumber(l.row?.SlippageSellPct), 0) / Math.max(1, lines.length) / 30);
  const concentrationPenalty = clamp01(lines.reduce((s, l) => s + safeNumber(l.qty), 0) > 0 && lines.length <= 1 ? 0.8 : 0.2);
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
    watchlistBonusNorm * weights.watchlistBonus;
  const penalties =
    riskPenalty * weights.riskPenalty +
    slippagePenalty * weights.slippagePenalty +
    concentrationPenalty * weights.concentrationPenalty +
    capitalLockPenalty * weights.capitalLockupPenalty;

  const score = Math.max(0, Math.min(100, (positive - penalties) * 100));

  const reasons = [...item.reasons];
  if (profit > 0) reasons.push(`profit:${Math.round(profit).toLocaleString()}`);
  if (iskPerJumpNorm > 0.5) reasons.push("isk_per_jump_strong");
  if (movementNorm > 0.45) reasons.push("movement_signal");
  if (watchlistBonusNorm > 0) reasons.push("watchlist_signal");

  const warnings = [...item.warnings];
  if (capitalLockPenalty > 0.7) warnings.push("capital_lockup_high");
  if (slippagePenalty > 0.5) warnings.push("slippage_risk_elevated");

  return {
    ...item,
    kind,
    score,
    reasons,
    warnings,
    diagnostics: item.diagnostics ?? [],
    scoreBreakdown: {
      profit: profitNorm,
      iskPerJump: iskPerJumpNorm,
      cargoEfficiency: cargoEfficiencyNorm,
      roi: roiNorm,
      executionQuality: executionQualityNorm,
      fillConfidence: fillConfidenceNorm,
      dailyProfitTurnover: dailyTurnoverNorm,
      movement: movementNorm,
      watchlistBonus: watchlistBonusNorm,
      penalties,
    },
  };
}

export function buildRadiusDecisionQueue(input: BuildRadiusDecisionQueueInput): BuildRadiusDecisionQueueResult {
  const weights = { ...DEFAULT_WEIGHTS, ...(input.factorWeights ?? {}) };
  const queue: RadiusDecisionQueueItem[] = [];
  const rejected: BuildRadiusDecisionQueueResult["rejected"] = [];

  for (const build of input.cargoBuilds ?? []) queue.push(scoreRecommendation(recommendationFromCargoBuild(build, { source: "decision_queue" }), "cargo_build", weights));
  for (const [routeKey, rows] of Object.entries(input.routeRowsByKey ?? {})) queue.push(scoreRecommendation(recommendationFromRouteBatch(routeKey, rows, input.routeBatchMetadataByRoute?.[routeKey], input.cargoCapacityM3 ?? 0, { source: `decision_queue:${input.mode ?? "default"}` }), "same_leg_batch", weights));
  for (const list of input.buyStationShoppingLists ?? []) queue.push(scoreRecommendation(recommendationFromBuyStationShoppingList(list, { source: "decision_queue" }), "buy_station_package", weights));
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

  queue.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const limited = (input.maxRecommendations ?? 0) > 0 ? queue.slice(0, input.maxRecommendations) : queue;
  return { queue: limited, rejected };
}
