import { useMemo } from "react";
import type { FlipResult, RouteState } from "@/lib/types";
import type { EndpointPreferenceEvaluation } from "@/lib/endpointPreferences";
import type { RouteBatchMetadata } from "@/lib/batchMetrics";
import { routeGroupKey } from "@/lib/batchMetrics";
import { routeSafetyRankFromState } from "@/lib/routeSafetySort";
import { calcRouteConfidence as calcRouteConfidenceFromInputs } from "@/lib/routeConfidence";
import {
  deriveActionQueue,
  routeRecommendationScoreFromMetrics,
  selectTopRoutePicks,
  type ActionQueueItem,
  type TopRoutePickCandidate,
  type TopRoutePicks,
} from "@/lib/radiusMetrics";
import { scoreFlipResult, type OpportunityScanContext, type OpportunityWeightProfile } from "@/lib/opportunityScore";
import { isFlipResultDeprioritized, type SessionStationFilters } from "@/lib/banlistFilters";
import type { RouteVerificationResult } from "@/lib/routeManifestVerification";

export type RouteAggregateMetrics = {
  routeSafetyRank: number;
  dailyIskPerJump: number;
  dailyProfit: number;
  iskPerM3PerJump: number;
  fastestIskPerJump: number;
  weakestExecutionQuality: number;
  riskSpikeCount: number;
  riskNoHistoryCount: number;
  riskUnstableHistoryCount: number;
  riskThinFillCount: number;
  riskTotalCount: number;
  turnoverDays: number | null;
  exitOverhangDays: number | null;
  breakevenBuffer: number | null;
  dailyProfitOverCapital: number | null;
  routeTotalProfit: number;
  routeTotalCapital: number;
  weightedSlippagePct: number;
};

export type RouteScoreSummary = {
  routeRecommendationScore: number;
  bestRowScore: number;
  avgRowScore: number;
  trackedShare: number;
};

export type RouteBadgeFilter =
  | "clean"
  | "moderate"
  | "busy"
  | "spike"
  | "no_history"
  | "unstable"
  | "thin"
  | "high"
  | "medium"
  | "low";

export type RouteBadgeMetadata = {
  filters: Set<RouteBadgeFilter>;
  complexity: "Clean" | "Moderate" | "Busy";
  riskSpikeCount: number;
  riskNoHistoryCount: number;
  riskUnstableHistoryCount: number;
  riskThinFillCount: number;
  confidence: RouteConfidence;
};

export type RouteConfidence = {
  score: number;
  label: string;
  color: string;
  hint: string;
};

export type RouteSummary = {
  routeKey: string;
  routeLabel: string;
  rowCount: number;
  aggregate: RouteAggregateMetrics;
  score: RouteScoreSummary;
  badge: RouteBadgeMetadata;
  endpointScoreDelta: number;
  endpointRuleHits: number;
  trackedCount: number;
  hasDeprioritizedRows: boolean;
  hasLoopOutbound: boolean;
  hasLoopReturn: boolean;
  verificationStatus: RouteVerificationResult["status"] | "Unknown";
};

export type LoopOpportunitySummary = {
  totalRoutes: number;
  outboundReadyRoutes: number;
  returnReadyRoutes: number;
  twoWayRoutes: number;
  lowConfidenceRoutes: number;
};

export type RouteExplanationMeta = {
  routeKey: string;
  routeLabel: string;
  recommendationScore: number;
  dailyIskPerJump: number;
  totalProfit: number;
  confidenceScore: number;
  executionQuality: number;
  weightedSlippagePct: number;
  turnoverDays: number | null;
  cargoUsePercent: number | null;
  riskCount: number;
  staleVerificationPenalty: number;
  missingVerification: boolean;
  thinDepthCount: number;
  exitOverhangDays: number | null;
  jumpBurden: number | null;
};

export type RadiusRouteInsightInputRow = {
  row: FlipResult;
  endpointPreferences?: EndpointPreferenceEvaluation;
};

export type RadiusRouteInsightsParams = {
  rows: RadiusRouteInsightInputRow[];
  resultsCount: number;
  batchMetricsByRoute: Record<string, RouteBatchMetadata>;
  routeSafetyMap: Record<string, RouteState | null | undefined>;
  trackedTypeIds: Set<number>;
  sessionStationFilters?: SessionStationFilters;
  routeVerificationByKey?: Record<string, RouteVerificationResult>;
  opportunityProfile?: OpportunityWeightProfile;
  scoreContext?: OpportunityScanContext;
  hiddenRowCount?: number;
  endpointPreferenceMode?: string;
  filterSnapshots?: Record<string, unknown>;
};

export type RadiusRouteInsights = {
  routeAggregateMetricsByRoute: Record<string, RouteAggregateMetrics>;
  routeScoreSummaryByRoute: Record<string, RouteScoreSummary>;
  routeBadgeMetadataByRoute: Record<string, RouteBadgeMetadata>;
  routeSummaries: RouteSummary[];
  topRoutePickCandidates: TopRoutePickCandidate[];
  topRoutePicks: TopRoutePicks;
  actionQueue: ActionQueueItem[];
  suppressionTelemetry: {
    hardBanFiltered: number;
    softSessionFiltered: number;
    endpointExcluded: number;
    deprioritizedRows: number;
    hiddenRows: number;
    endpointMode: string;
    filterCount: number;
  };
  loopOpportunitySummary: LoopOpportunitySummary;
  explanationMetaByRouteKey: Record<string, RouteExplanationMeta>;
};

function trackedRecommendationBonus(params: {
  trackedShare: number;
  baselineRecommendationScore: number;
  bestTrackedRowScore: number;
}): number {
  const trackedShare = Math.max(0, Math.min(1, params.trackedShare));
  if (trackedShare <= 0) return 0;
  const baselineGate = Math.max(
    0,
    Math.min(1, (params.baselineRecommendationScore - 35) / 45),
  );
  if (baselineGate <= 0) return 0;
  const trackedRowQualityGate = Math.max(
    0,
    Math.min(1, (params.bestTrackedRowScore - 50) / 35),
  );
  return 8 * trackedShare * baselineGate * trackedRowQualityGate;
}

export function calcRouteConfidence(
  metrics: RouteAggregateMetrics | undefined,
): RouteConfidence {
  if (!metrics) {
    return {
      score: 0,
      label: "Low",
      color: "text-red-300 border-red-500/60 bg-red-900/20",
      hint: "Score 0/100 — route metrics unavailable",
    };
  }
  return calcRouteConfidenceFromInputs({
    routeSafetyRank: metrics.routeSafetyRank,
    weakestExecutionQuality: metrics.weakestExecutionQuality,
    weightedSlippagePct: metrics.weightedSlippagePct,
    riskSpikeCount: metrics.riskSpikeCount,
    riskNoHistoryCount: metrics.riskNoHistoryCount,
    riskUnstableHistoryCount: metrics.riskUnstableHistoryCount,
    exitOverhangDays: metrics.exitOverhangDays,
  });
}

function deriveRouteBadgeMetadata(
  routeSummary: RouteBatchMetadata | undefined,
  routeAggregate: RouteAggregateMetrics | undefined,
): RouteBadgeMetadata {
  const complexity = routeSummary?.routeComplexity ?? "Busy";
  const confidence = calcRouteConfidence(routeAggregate);
  const riskSpikeCount = routeAggregate?.riskSpikeCount ?? 0;
  const riskNoHistoryCount = routeAggregate?.riskNoHistoryCount ?? 0;
  const riskUnstableHistoryCount = routeAggregate?.riskUnstableHistoryCount ?? 0;
  const riskThinFillCount = routeAggregate?.riskThinFillCount ?? 0;
  const filters = new Set<RouteBadgeFilter>();
  filters.add(complexity.toLowerCase() as RouteBadgeFilter);
  if (riskSpikeCount > 0) filters.add("spike");
  if (riskNoHistoryCount > 0) filters.add("no_history");
  if (riskUnstableHistoryCount > 0) filters.add("unstable");
  if (riskThinFillCount > 0) filters.add("thin");
  filters.add(confidence.label.toLowerCase() as RouteBadgeFilter);
  return {
    filters,
    complexity,
    riskSpikeCount,
    riskNoHistoryCount,
    riskUnstableHistoryCount,
    riskThinFillCount,
    confidence,
  };
}

export function deriveRadiusRouteInsights(
  params: RadiusRouteInsightsParams,
): RadiusRouteInsights {
  const routeKeyToSystemPair: Record<string, string> = {};
  const routeLabelByKey = new Map<string, string>();
  const routeRowsByKey = new Map<string, RadiusRouteInsightInputRow[]>();

  for (const item of params.rows) {
    const key = routeGroupKey(item.row);
    routeRowsByKey.set(key, [...(routeRowsByKey.get(key) ?? []), item]);
    if (!(key in routeKeyToSystemPair)) {
      routeKeyToSystemPair[key] = `${item.row.BuySystemID}:${item.row.SellSystemID}`;
    }
    if (!routeLabelByKey.has(key)) {
      routeLabelByKey.set(
        key,
        `${item.row.BuyStation || item.row.BuySystemName} → ${item.row.SellStation || item.row.SellSystemName}`,
      );
    }
  }

  const routeAggregateMetricsByRoute: Record<string, RouteAggregateMetrics> = {};
  for (const [routeKey, meta] of Object.entries(params.batchMetricsByRoute)) {
    const routeSafetyRank = routeSafetyRankFromState(
      params.routeSafetyMap[routeKeyToSystemPair[routeKey] ?? ""],
    );
    const riskTotalCount =
      meta.routeRiskSpikeCount +
      meta.routeRiskNoHistoryCount +
      meta.routeRiskUnstableHistoryCount +
      meta.routeRiskThinFillCount;
    routeAggregateMetricsByRoute[routeKey] = {
      routeSafetyRank,
      dailyIskPerJump: meta.routeDailyIskPerJump,
      dailyProfit: meta.routeDailyProfit,
      iskPerM3PerJump: meta.routeRealIskPerM3PerJump,
      fastestIskPerJump: meta.routeRealIskPerJump,
      weakestExecutionQuality: meta.routeWeakestExecutionQuality,
      riskSpikeCount: meta.routeRiskSpikeCount,
      riskNoHistoryCount: meta.routeRiskNoHistoryCount,
      riskUnstableHistoryCount: meta.routeRiskUnstableHistoryCount,
      riskThinFillCount: meta.routeRiskThinFillCount,
      riskTotalCount,
      turnoverDays: meta.routeTurnoverDays,
      exitOverhangDays: meta.routeExitOverhangDays,
      breakevenBuffer: meta.routeBreakevenBuffer,
      dailyProfitOverCapital: meta.routeDailyProfitOverCapital,
      routeTotalProfit: meta.routeTotalProfit,
      routeTotalCapital: meta.routeTotalCapital,
      weightedSlippagePct: meta.routeWeightedSlippagePct,
    };
  }

  const routeBadgeMetadataByRoute: Record<string, RouteBadgeMetadata> = {};
  const routeScoreSummaryByRoute: Record<string, RouteScoreSummary> = {};
  const topRoutePickCandidates: TopRoutePickCandidate[] = [];

  for (const [routeKey, routeLabel] of routeLabelByKey.entries()) {
    const routeSummary = params.batchMetricsByRoute[routeKey];
    const routeAggregate = routeAggregateMetricsByRoute[routeKey];
    routeBadgeMetadataByRoute[routeKey] = deriveRouteBadgeMetadata(
      routeSummary,
      routeAggregate,
    );

    const rows = routeRowsByKey.get(routeKey) ?? [];
    const rowScores = rows.map((item) => ({
      score: scoreFlipResult(item.row, params.opportunityProfile, params.scoreContext).finalScore,
      tracked: params.trackedTypeIds.has(item.row.TypeID),
    }));

    const routeRecommendationScore =
      routeRecommendationScoreFromMetrics({
        routeDailyIskPerJump: routeSummary?.routeDailyIskPerJump ?? 0,
        routeWeakestExecutionQuality: routeSummary?.routeWeakestExecutionQuality ?? 0,
        routeWeightedSlippagePct: routeSummary?.routeWeightedSlippagePct ?? 0,
        routeTotalRiskCount:
          (routeSummary?.routeRiskSpikeCount ?? 0) +
          (routeSummary?.routeRiskNoHistoryCount ?? 0) +
          (routeSummary?.routeRiskUnstableHistoryCount ?? 0) +
          (routeSummary?.routeRiskThinFillCount ?? 0),
        routeTurnoverDays: routeSummary?.routeTurnoverDays ?? null,
        routeCapacityUsedPercent: routeSummary?.routeCapacityUsedPercent ?? null,
      }) ?? 0;

    const bestRowScore =
      rowScores.length > 0 ? Math.max(...rowScores.map((item) => item.score)) : 0;
    const avgRowScore =
      rowScores.length > 0
        ? rowScores.reduce((sum, value) => sum + value.score, 0) / rowScores.length
        : 0;
    const trackedCount = rowScores.filter((item) => item.tracked).length;
    const trackedShare = rowScores.length > 0 ? trackedCount / rowScores.length : 0;
    const bestTrackedRowScore = rowScores
      .filter((item) => item.tracked)
      .reduce((best, item) => Math.max(best, item.score), 0);

    const endpointScoreDelta = rows.reduce(
      (acc, item) => acc + (item.endpointPreferences?.scoreDelta ?? 0),
      0,
    );
    const trackedBonus = trackedRecommendationBonus({
      trackedShare,
      baselineRecommendationScore: routeRecommendationScore,
      bestTrackedRowScore,
    });

    routeScoreSummaryByRoute[routeKey] = {
      routeRecommendationScore: Math.max(0, routeRecommendationScore + endpointScoreDelta + trackedBonus),
      bestRowScore,
      avgRowScore,
      trackedShare,
    };

    const endpointRuleHits = rows.reduce(
      (acc, item) => acc + (item.endpointPreferences?.appliedRules.length ?? 0),
      0,
    );
    const hasDeprioritizedRows = rows.some((item) =>
      isFlipResultDeprioritized(item.row, params.sessionStationFilters),
    );
    const firstRow = rows[0]?.row;
    const hasLoopOutbound = firstRow
      ? params.routeSafetyMap[`${firstRow.BuySystemID}:${firstRow.SellSystemID}`] !== undefined
      : false;
    const hasLoopReturn = firstRow
      ? params.routeSafetyMap[`${firstRow.SellSystemID}:${firstRow.BuySystemID}`] !== undefined
      : false;

    topRoutePickCandidates.push({
      routeKey,
      routeLabel,
      totalProfit: routeSummary?.routeTotalProfit ?? 0,
      dailyIskPerJump: routeSummary?.routeDailyIskPerJump ?? 0,
      confidenceScore: calcRouteConfidence(routeAggregate).score,
      cargoUsePercent: routeSummary?.routeCapacityUsedPercent ?? 0,
      recommendationScore: routeScoreSummaryByRoute[routeKey].routeRecommendationScore,
      trackedShare,
      stopCount: routeSummary?.routeStopCount ?? 0,
      riskCount:
        (routeSummary?.routeRiskSpikeCount ?? 0) +
        (routeSummary?.routeRiskNoHistoryCount ?? 0) +
        (routeSummary?.routeRiskUnstableHistoryCount ?? 0) +
        (routeSummary?.routeRiskThinFillCount ?? 0),
      endpointScoreDelta,
      endpointRuleHits,
      hasWatchlistSignal: trackedCount > 0,
      hasLoopCandidate: hasLoopOutbound,
      hasBackhaulCandidate: hasLoopReturn,
      hasDeprioritizedRows,
    });
  }

  topRoutePickCandidates.sort((a, b) =>
    a.routeLabel.localeCompare(b.routeLabel) || a.routeKey.localeCompare(b.routeKey),
  );

  const topRoutePicks = selectTopRoutePicks(topRoutePickCandidates);

  const deprioritizedRows = params.rows.filter((item) =>
    isFlipResultDeprioritized(item.row, params.sessionStationFilters),
  ).length;

  const suppressionTelemetry = {
    hardBanFiltered: Math.max(0, params.resultsCount - params.rows.length),
    softSessionFiltered: 0,
    endpointExcluded: 0,
    deprioritizedRows,
    hiddenRows: Math.max(0, params.hiddenRowCount ?? 0),
    endpointMode: params.endpointPreferenceMode ?? "unknown",
    filterCount: Object.values(params.filterSnapshots ?? {}).filter(Boolean).length,
  };

  const actionQueue = deriveActionQueue({
    candidates: topRoutePickCandidates,
    suppression: suppressionTelemetry,
  }).slice(0, 6);

  const routeSummaries = topRoutePickCandidates.map((candidate) => ({
    routeKey: candidate.routeKey,
    routeLabel: candidate.routeLabel,
    rowCount: routeRowsByKey.get(candidate.routeKey)?.length ?? 0,
    aggregate: routeAggregateMetricsByRoute[candidate.routeKey],
    score: routeScoreSummaryByRoute[candidate.routeKey],
    badge: routeBadgeMetadataByRoute[candidate.routeKey],
    endpointRuleHits: candidate.endpointRuleHits ?? 0,
    endpointScoreDelta: candidate.endpointScoreDelta ?? 0,
    trackedCount: candidate.hasWatchlistSignal ? 1 : 0,
    hasDeprioritizedRows: candidate.hasDeprioritizedRows ?? false,
    hasLoopOutbound: candidate.hasLoopCandidate ?? false,
    hasLoopReturn: candidate.hasBackhaulCandidate ?? false,
    verificationStatus:
      (params.routeVerificationByKey?.[candidate.routeKey]?.status as RouteSummary["verificationStatus"] | undefined) ??
      "Unknown",
  }));

  const explanationMetaByRouteKey: Record<string, RouteExplanationMeta> = {};
  for (const route of routeSummaries) {
    const summary = params.batchMetricsByRoute[route.routeKey];
    explanationMetaByRouteKey[route.routeKey] = {
      routeKey: route.routeKey,
      routeLabel: route.routeLabel,
      recommendationScore: route.score.routeRecommendationScore,
      dailyIskPerJump: summary?.routeDailyIskPerJump ?? 0,
      totalProfit: summary?.routeTotalProfit ?? 0,
      confidenceScore: route.badge.confidence.score,
      executionQuality: summary?.routeWeakestExecutionQuality ?? 0,
      weightedSlippagePct: summary?.routeWeightedSlippagePct ?? 0,
      turnoverDays: summary?.routeTurnoverDays ?? null,
      cargoUsePercent: summary?.routeCapacityUsedPercent ?? null,
      riskCount:
        (summary?.routeRiskSpikeCount ?? 0) +
        (summary?.routeRiskNoHistoryCount ?? 0) +
        (summary?.routeRiskUnstableHistoryCount ?? 0) +
        (summary?.routeRiskThinFillCount ?? 0),
      staleVerificationPenalty:
        params.routeVerificationByKey?.[route.routeKey]?.status === "Abort" ? 12 : 0,
      missingVerification: !params.routeVerificationByKey?.[route.routeKey],
      thinDepthCount: summary?.routeRiskThinFillCount ?? 0,
      exitOverhangDays: summary?.routeExitOverhangDays ?? null,
      jumpBurden: summary?.routeStopCount ?? null,
    };
  }

  const loopOpportunitySummary: LoopOpportunitySummary = {
    totalRoutes: routeSummaries.length,
    outboundReadyRoutes: routeSummaries.filter((item) => item.hasLoopOutbound).length,
    returnReadyRoutes: routeSummaries.filter((item) => item.hasLoopReturn).length,
    twoWayRoutes: routeSummaries.filter((item) => item.hasLoopOutbound && item.hasLoopReturn).length,
    lowConfidenceRoutes: routeSummaries.filter((item) => item.badge.confidence.score < 40).length,
  };

  return {
    routeAggregateMetricsByRoute,
    routeScoreSummaryByRoute,
    routeBadgeMetadataByRoute,
    routeSummaries,
    topRoutePickCandidates,
    topRoutePicks,
    actionQueue,
    suppressionTelemetry,
    loopOpportunitySummary,
    explanationMetaByRouteKey,
  };
}

export function useRadiusRouteInsights(params: RadiusRouteInsightsParams): RadiusRouteInsights {
  return useMemo(() => deriveRadiusRouteInsights(params), [params]);
}
