import type { RouteBatchMetadata } from "@/lib/batchMetrics";
import type { FillerCandidate } from "@/lib/fillerCandidates";
import type { RadiusCargoBuild } from "@/lib/radiusCargoBuilds";
import type { ActionQueueItem, TopRoutePicks } from "@/lib/radiusMetrics";
import type { RouteDecisionExplanation } from "@/lib/routeExplanation";
import type { RouteQueueEntry } from "@/lib/routeQueue";
import type { FlipResult } from "@/lib/types";
import type { RouteAggregateMetrics } from "@/lib/useRadiusRouteInsights";
import type { RadiusVerificationState } from "@/lib/radiusVerificationStatus";
import { routeGroupKey, safeNumber } from "@/lib/batchMetrics";

export type RadiusDealFocusKind =
  | "best_buy_now"
  | "best_full_cargo"
  | "best_single_item"
  | "best_safe_depth"
  | "best_fast_turnover"
  | "best_low_capital"
  | "best_watchlist"
  | "best_filler";

export type RadiusDealFocusAction = "buy" | "verify" | "trim" | "skip";

export type RadiusDealFocusCandidate = {
  kind: RadiusDealFocusKind;
  title: string;
  routeKey: string;
  routeLabel: string;
  buyStation: string;
  sellStation: string;
  itemSummary: string;
  itemName: string;
  expectedProfitIsk: number;
  capitalIsk: number;
  cargoM3: number;
  iskPerJump: number;
  confidenceScore: number;
  executionQuality: number;
  trapRisk: number;
  verificationState: RadiusVerificationState;
  recommendedAction: RadiusDealFocusAction;
  explanation?: RouteDecisionExplanation;
};

export type DeriveRadiusDealFocusCandidatesInput = {
  rows: FlipResult[];
  cargoBuilds: RadiusCargoBuild[];
  topRoutePicks: TopRoutePicks;
  actionQueue: ActionQueueItem[];
  batchMetricsByRoute: Record<string, RouteBatchMetadata>;
  routeAggregateMetricsByRoute: Record<string, RouteAggregateMetrics>;
  routeExplanationByKey?: Record<string, RouteDecisionExplanation>;
  routeFillerCandidatesByKey?: Record<
    string,
    { remainingCapacityM3: number; candidates: FillerCandidate[] }
  >;
  verificationStateByRouteKey?: Record<string, RadiusVerificationState>;
  routeQueueEntries?: RouteQueueEntry[];
  cargoCapacityM3?: number;
};

type RouteFacts = {
  routeKey: string;
  routeLabel: string;
  buyStation: string;
  sellStation: string;
  topItemName: string;
  rowCount: number;
  expectedProfitIsk: number;
  capitalIsk: number;
  cargoM3: number;
  iskPerJump: number;
  confidenceScore: number;
  executionQuality: number;
  trapRisk: number;
  verificationState: RadiusVerificationState;
  hasWatchlistSignal: boolean;
  fillerCount: number;
  explanation?: RouteDecisionExplanation;
};

const VERIFICATION_FRESHNESS: Record<RadiusVerificationState, number> = {
  fresh: 4,
  reduced_edge: 3,
  stale: 2,
  unverified: 1,
  abort: 0,
};

function stateFromQueue(entry: RouteQueueEntry | undefined): RadiusVerificationState {
  if (!entry) return "unverified";
  if (entry.status === "needs_verify") return "stale";
  return "unverified";
}

function toTrapRisk(batch?: RouteBatchMetadata, aggregate?: RouteAggregateMetrics): number {
  const riskCount =
    batch?.routeRiskSpikeCount ?? 0 +
    (batch?.routeRiskNoHistoryCount ?? 0) +
    (batch?.routeRiskUnstableHistoryCount ?? 0) +
    (batch?.routeRiskThinFillCount ?? 0);
  const aggregateRisk = aggregate?.riskTotalCount ?? riskCount;
  const slippage = batch?.routeWeightedSlippagePct ?? aggregate?.weightedSlippagePct ?? 0;
  const weakestExec = batch?.routeWeakestExecutionQuality ?? aggregate?.weakestExecutionQuality ?? 0;
  return Math.max(0, Math.min(100, aggregateRisk * 14 + slippage * 1.8 + Math.max(0, (60 - weakestExec) * 0.7)));
}

function deriveAction(facts: RouteFacts): RadiusDealFocusAction {
  const extremeRiskLowConfidence = facts.trapRisk >= 75 && facts.confidenceScore < 45;
  if (facts.verificationState === "abort" || extremeRiskLowConfidence) return "skip";
  if (
    facts.verificationState === "unverified" ||
    facts.verificationState === "stale" ||
    facts.verificationState === "reduced_edge"
  ) {
    return "verify";
  }
  if (facts.confidenceScore < 58 || facts.executionQuality < 58 || facts.trapRisk >= 50) {
    return "trim";
  }
  return "buy";
}

function compareFacts(left: RouteFacts, right: RouteFacts, scoreLeft: number, scoreRight: number): number {
  if (scoreRight !== scoreLeft) return scoreRight - scoreLeft;
  const freshDelta = VERIFICATION_FRESHNESS[right.verificationState] - VERIFICATION_FRESHNESS[left.verificationState];
  if (freshDelta !== 0) return freshDelta;
  if (left.trapRisk !== right.trapRisk) return left.trapRisk - right.trapRisk;
  if (right.executionQuality !== left.executionQuality) return right.executionQuality - left.executionQuality;
  if (right.expectedProfitIsk !== left.expectedProfitIsk) return right.expectedProfitIsk - left.expectedProfitIsk;
  if (left.routeKey !== right.routeKey) return left.routeKey.localeCompare(right.routeKey);
  return left.topItemName.localeCompare(right.topItemName);
}

function buildRouteFacts(input: DeriveRadiusDealFocusCandidatesInput): RouteFacts[] {
  const grouped = new Map<string, FlipResult[]>();
  for (const row of input.rows) {
    const key = routeGroupKey(row);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(row);
    else grouped.set(key, [row]);
  }

  const watchlistRouteKeys = new Set<string>();
  for (const pick of [
    input.topRoutePicks.bestRecommendedRoutePack,
    input.topRoutePicks.bestQuickSingleRoute,
    input.topRoutePicks.bestSafeFillerRoute,
  ]) {
    if (pick?.routeKey && pick.hasWatchlistSignal) watchlistRouteKeys.add(pick.routeKey);
  }
  for (const queue of input.actionQueue) {
    if (queue.action === "tracked") watchlistRouteKeys.add(queue.routeKey);
    if (queue.candidate.hasWatchlistSignal) watchlistRouteKeys.add(queue.routeKey);
  }

  const queueByRoute = new Map(input.routeQueueEntries?.map((entry) => [entry.routeKey, entry]) ?? []);

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([routeKey, rows]) => {
      const sortedRows = [...rows].sort((left, right) => {
        const profitDelta = safeNumber(right.RealProfit ?? right.TotalProfit) - safeNumber(left.RealProfit ?? left.TotalProfit);
        if (profitDelta !== 0) return profitDelta;
        return left.TypeName.localeCompare(right.TypeName);
      });
      const bestRow = sortedRows[0] ?? rows[0];
      const batch = input.batchMetricsByRoute[routeKey];
      const aggregate = input.routeAggregateMetricsByRoute[routeKey];
      const routeLabel =
        input.topRoutePicks.bestRecommendedRoutePack?.routeKey === routeKey
          ? input.topRoutePicks.bestRecommendedRoutePack.routeLabel
          : input.topRoutePicks.bestQuickSingleRoute?.routeKey === routeKey
            ? input.topRoutePicks.bestQuickSingleRoute.routeLabel
            : input.topRoutePicks.bestSafeFillerRoute?.routeKey === routeKey
              ? input.topRoutePicks.bestSafeFillerRoute.routeLabel
              : `${bestRow?.BuySystemName ?? "?"} → ${bestRow?.SellSystemName ?? "?"}`;
      const verificationState =
        input.verificationStateByRouteKey?.[routeKey] ?? stateFromQueue(queueByRoute.get(routeKey));

      return {
        routeKey,
        routeLabel,
        buyStation: bestRow?.BuyStation ?? bestRow?.BuySystemName ?? "Unknown buy",
        sellStation: bestRow?.SellStation ?? bestRow?.SellSystemName ?? "Unknown sell",
        topItemName: bestRow?.TypeName ?? "Unknown item",
        rowCount: rows.length,
        expectedProfitIsk: batch?.routeTotalProfit ?? aggregate?.routeTotalProfit ?? 0,
        capitalIsk: batch?.routeTotalCapital ?? aggregate?.routeTotalCapital ?? 0,
        cargoM3: batch?.routeTotalVolume ?? 0,
        iskPerJump: batch?.routeDailyIskPerJump ?? aggregate?.dailyIskPerJump ?? 0,
        confidenceScore:
          batch?.routeAverageFillConfidencePct ?? Math.max(0, 100 - (aggregate?.riskTotalCount ?? 0) * 10),
        executionQuality: batch?.routeWeakestExecutionQuality ?? aggregate?.weakestExecutionQuality ?? 0,
        trapRisk: toTrapRisk(batch, aggregate),
        verificationState,
        hasWatchlistSignal: watchlistRouteKeys.has(routeKey),
        fillerCount: input.routeFillerCandidatesByKey?.[routeKey]?.candidates.length ?? 0,
        explanation: input.routeExplanationByKey?.[routeKey],
      } satisfies RouteFacts;
    });
}

function pickKind(
  kind: RadiusDealFocusKind,
  title: string,
  facts: RouteFacts[],
  scoreFor: (fact: RouteFacts) => number,
  include: (fact: RouteFacts) => boolean = () => true,
): RadiusDealFocusCandidate | null {
  const ranked = facts
    .filter(include)
    .map((fact) => ({ fact, score: scoreFor(fact) }))
    .sort((left, right) => compareFacts(left.fact, right.fact, left.score, right.score));
  const top = ranked[0]?.fact;
  if (!top) return null;
  const itemSummary = top.rowCount === 1 ? `1 item · ${top.topItemName}` : `${top.rowCount} items · lead ${top.topItemName}`;
  return {
    kind,
    title,
    routeKey: top.routeKey,
    routeLabel: top.routeLabel,
    buyStation: top.buyStation,
    sellStation: top.sellStation,
    itemSummary,
    itemName: top.topItemName,
    expectedProfitIsk: top.expectedProfitIsk,
    capitalIsk: top.capitalIsk,
    cargoM3: top.cargoM3,
    iskPerJump: top.iskPerJump,
    confidenceScore: top.confidenceScore,
    executionQuality: top.executionQuality,
    trapRisk: top.trapRisk,
    verificationState: top.verificationState,
    recommendedAction: deriveAction(top),
    explanation: top.explanation,
  };
}

export function deriveRadiusDealFocusCandidates(
  input: DeriveRadiusDealFocusCandidatesInput,
): RadiusDealFocusCandidate[] {
  const facts = buildRouteFacts(input);
  if (facts.length === 0) return [];

  const candidates = [
    pickKind(
      "best_buy_now",
      "Best Buy Now",
      facts,
      (fact) => fact.expectedProfitIsk * 0.45 + fact.iskPerJump * 0.35 + fact.executionQuality * 500_000,
      (fact) => !(fact.trapRisk >= 75 && fact.confidenceScore < 45),
    ),
    pickKind("best_full_cargo", "Best Full Cargo", facts, (fact) => {
      const capacity = Math.max(1, input.cargoCapacityM3 ?? 1);
      return (fact.cargoM3 / capacity) * 100;
    }),
    pickKind("best_single_item", "Best Single Item", facts, (fact) => {
      const perItemProfit = fact.rowCount > 0 ? fact.expectedProfitIsk / fact.rowCount : 0;
      return perItemProfit;
    }),
    pickKind("best_safe_depth", "Best Safe Depth", facts, (fact) => fact.confidenceScore * 3 + (100 - fact.trapRisk) * 2 + fact.executionQuality),
    pickKind("best_fast_turnover", "Best Fast Turnover", facts, (fact) => fact.iskPerJump * 0.8 + fact.executionQuality * 100_000 - fact.capitalIsk * 0.0001),
    pickKind(
      "best_low_capital",
      "Best Low Capital",
      facts,
      (fact) => (fact.capitalIsk > 0 ? 1_000_000_000_000 / fact.capitalIsk : Number.NEGATIVE_INFINITY),
      (fact) => fact.capitalIsk > 0,
    ),
    pickKind("best_watchlist", "Best Watchlist", facts, (fact) => fact.expectedProfitIsk, (fact) => fact.hasWatchlistSignal),
    pickKind("best_filler", "Best Filler", facts, (fact) => fact.fillerCount * 100_000_000 + fact.expectedProfitIsk, (fact) => fact.fillerCount > 0),
  ].filter((value): value is RadiusDealFocusCandidate => Boolean(value));

  return candidates;
}
