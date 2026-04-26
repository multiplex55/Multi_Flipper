import { describe, expect, it } from "vitest";
import type { RouteBatchMetadata } from "@/lib/batchMetrics";
import { deriveRadiusBestDealCards } from "@/lib/radiusBestDealCards";
import type { ActionQueueItem, TopRoutePicks } from "@/lib/radiusMetrics";
import type { RouteDecisionExplanation } from "@/lib/routeExplanation";
import type { RouteAggregateMetrics } from "@/lib/useRadiusRouteInsights";

const picks: TopRoutePicks = {
  bestRecommendedRoutePack: {
    routeKey: "route-a",
    routeLabel: "Jita → Amarr",
    totalProfit: 2_000_000,
    dailyIskPerJump: 1_200_000,
    confidenceScore: 82,
    cargoUsePercent: 74,
    recommendationScore: 88,
    stopCount: 2,
    riskCount: 1,
  },
  bestQuickSingleRoute: {
    routeKey: "route-b",
    routeLabel: "Amarr → Dodixie",
    totalProfit: 1_800_000,
    dailyIskPerJump: 1_400_000,
    confidenceScore: 78,
    cargoUsePercent: 52,
    recommendationScore: 79,
    stopCount: 1,
    riskCount: 2,
  },
  bestSafeFillerRoute: {
    routeKey: "route-c",
    routeLabel: "Jita → Hek",
    totalProfit: 900_000,
    dailyIskPerJump: 700_000,
    confidenceScore: 90,
    cargoUsePercent: 61,
    recommendationScore: 76,
    stopCount: 2,
    riskCount: 0,
    hasBackhaulCandidate: true,
  },
};

const queue: ActionQueueItem[] = [
  {
    routeKey: "route-c",
    routeLabel: "Jita → Hek",
    action: "loop_return",
    score: 91,
    reasons: ["return-leg ready"],
    candidate: picks.bestSafeFillerRoute!,
  },
];

const batchMetricsByRoute: Record<string, RouteBatchMetadata> = {
  "route-a": {
    batchNumber: 1,
    batchProfit: 1,
    batchTotalCapital: 1,
    batchIskPerJump: 1,
    routeItemCount: 1,
    routeTotalProfit: 2_000_000,
    routeTotalCapital: 500_000_000,
    routeTotalVolume: 1000,
    routeCapacityUsedPercent: 82,
    routeRealIskPerJump: 1,
    routeDailyIskPerJump: 1_600_000,
    routeRealIskPerM3PerJump: 100,
    routeDailyProfit: 1,
    routeDailyProfitOverCapital: 0.2,
    routeWeightedSlippagePct: 2,
    routeWeakestExecutionQuality: 90,
    routeTurnoverDays: 4,
    routeExitOverhangDays: 0,
    routeBreakevenBuffer: 0,
    routeRiskSpikeCount: 0,
    routeRiskNoHistoryCount: 0,
    routeRiskUnstableHistoryCount: 0,
    routeRiskThinFillCount: 1,
    routeUniverseCandidateItemCount: 1,
    routeUniverseExcludedItemCount: 0,
    routeUniverseWarningCount: 0,
    routeStopCount: 2,
    routeBuyStopCount: 1,
    routeSellStopCount: 1,
    routeWorstFillConfidencePct: 70,
    routeAverageFillConfidencePct: 80,
    routeProfitConcentrationPct: 55,
    routeRemainingCargoM3: 120,
    routeComplexity: "Moderate",
  },
  "route-b": {
    ...({} as RouteBatchMetadata),
    batchNumber: 1,
    batchProfit: 1,
    batchTotalCapital: 1,
    batchIskPerJump: 1,
    routeItemCount: 1,
    routeTotalProfit: 1_800_000,
    routeTotalCapital: 300_000_000,
    routeTotalVolume: 900,
    routeCapacityUsedPercent: 40,
    routeRealIskPerJump: 1,
    routeDailyIskPerJump: 2_200_000,
    routeRealIskPerM3PerJump: 120,
    routeDailyProfit: 1,
    routeDailyProfitOverCapital: 0.2,
    routeWeightedSlippagePct: 4,
    routeWeakestExecutionQuality: 72,
    routeTurnoverDays: 5,
    routeExitOverhangDays: 0,
    routeBreakevenBuffer: 0,
    routeRiskSpikeCount: 1,
    routeRiskNoHistoryCount: 1,
    routeRiskUnstableHistoryCount: 0,
    routeRiskThinFillCount: 1,
    routeUniverseCandidateItemCount: 1,
    routeUniverseExcludedItemCount: 0,
    routeUniverseWarningCount: 0,
    routeStopCount: 1,
    routeBuyStopCount: 1,
    routeSellStopCount: 0,
    routeWorstFillConfidencePct: 70,
    routeAverageFillConfidencePct: 80,
    routeProfitConcentrationPct: 62,
    routeRemainingCargoM3: 500,
    routeComplexity: "Busy",
  },
  "route-c": {
    ...({} as RouteBatchMetadata),
    batchNumber: 1,
    batchProfit: 1,
    batchTotalCapital: 1,
    batchIskPerJump: 1,
    routeItemCount: 1,
    routeTotalProfit: 900_000,
    routeTotalCapital: 120_000_000,
    routeTotalVolume: 700,
    routeCapacityUsedPercent: 66,
    routeRealIskPerJump: 1,
    routeDailyIskPerJump: 1_000_000,
    routeRealIskPerM3PerJump: 90,
    routeDailyProfit: 1,
    routeDailyProfitOverCapital: 0.2,
    routeWeightedSlippagePct: 1,
    routeWeakestExecutionQuality: 95,
    routeTurnoverDays: 3,
    routeExitOverhangDays: 0,
    routeBreakevenBuffer: 0,
    routeRiskSpikeCount: 0,
    routeRiskNoHistoryCount: 0,
    routeRiskUnstableHistoryCount: 0,
    routeRiskThinFillCount: 0,
    routeUniverseCandidateItemCount: 1,
    routeUniverseExcludedItemCount: 0,
    routeUniverseWarningCount: 0,
    routeStopCount: 2,
    routeBuyStopCount: 1,
    routeSellStopCount: 1,
    routeWorstFillConfidencePct: 80,
    routeAverageFillConfidencePct: 90,
    routeProfitConcentrationPct: 48,
    routeRemainingCargoM3: 200,
    routeComplexity: "Clean",
  },
};

const routeAggregateMetricsByRoute: Record<string, RouteAggregateMetrics> = {
  "route-a": {
    routeSafetyRank: 0.8,
    dailyIskPerJump: 1,
    dailyProfit: 1,
    iskPerM3PerJump: 1,
    fastestIskPerJump: 1,
    weakestExecutionQuality: 90,
    riskSpikeCount: 0,
    riskNoHistoryCount: 0,
    riskUnstableHistoryCount: 0,
    riskThinFillCount: 1,
    riskTotalCount: 1,
    turnoverDays: 4,
    exitOverhangDays: 0,
    breakevenBuffer: 0,
    dailyProfitOverCapital: 0.2,
    routeTotalProfit: 1,
    routeTotalCapital: 1,
    weightedSlippagePct: 2,
  },
  "route-b": {
    ...({} as RouteAggregateMetrics),
    routeSafetyRank: 0.3,
    dailyIskPerJump: 1,
    dailyProfit: 1,
    iskPerM3PerJump: 1,
    fastestIskPerJump: 1,
    weakestExecutionQuality: 70,
    riskSpikeCount: 1,
    riskNoHistoryCount: 1,
    riskUnstableHistoryCount: 0,
    riskThinFillCount: 1,
    riskTotalCount: 3,
    turnoverDays: 4,
    exitOverhangDays: 0,
    breakevenBuffer: 0,
    dailyProfitOverCapital: 0.2,
    routeTotalProfit: 1,
    routeTotalCapital: 1,
    weightedSlippagePct: 2,
  },
  "route-c": {
    ...({} as RouteAggregateMetrics),
    routeSafetyRank: 0.95,
    dailyIskPerJump: 1,
    dailyProfit: 1,
    iskPerM3PerJump: 1,
    fastestIskPerJump: 1,
    weakestExecutionQuality: 95,
    riskSpikeCount: 0,
    riskNoHistoryCount: 0,
    riskUnstableHistoryCount: 0,
    riskThinFillCount: 0,
    riskTotalCount: 0,
    turnoverDays: 4,
    exitOverhangDays: 0,
    breakevenBuffer: 0,
    dailyProfitOverCapital: 0.2,
    routeTotalProfit: 1,
    routeTotalCapital: 1,
    weightedSlippagePct: 2,
  },
};

const routeExplanationByKey: Record<string, RouteDecisionExplanation> = {
  "route-a": {
    routeKey: "route-a",
    routeLabel: "Jita → Amarr",
    totalScore: 81,
    summary: "A summary",
    factors: [],
    positives: [],
    negatives: [],
    warnings: [],
    lens: "recommended",
  },
  "route-b": {
    routeKey: "route-b",
    routeLabel: "Amarr → Dodixie",
    totalScore: 72,
    summary: "B summary",
    factors: [],
    positives: [],
    negatives: [],
    warnings: [],
    lens: "recommended",
  },
  "route-c": {
    routeKey: "route-c",
    routeLabel: "Jita → Hek",
    totalScore: 90,
    summary: "C summary",
    factors: [],
    positives: [],
    negatives: [],
    warnings: [],
    lens: "recommended",
  },
};

describe("deriveRadiusBestDealCards", () => {
  it("derives all base cards from fixture dataset", () => {
    const cards = deriveRadiusBestDealCards({
      topRoutePicks: picks,
      actionQueue: queue,
      batchMetricsByRoute,
      routeAggregateMetricsByRoute,
      routeExplanationByKey,
      routeFillerCandidatesByKey: {
        "route-a": { remainingCapacityM3: 100, candidates: [] },
        "route-b": { remainingCapacityM3: 100, candidates: [{ lineKey: "x" } as never] },
      },
    });

    const byKind = Object.fromEntries(cards.map((card) => [card.kind, card]));
    expect(byKind.best_single_item.routeKey).toBe("route-b");
    expect(byKind.best_full_cargo.routeKey).toBe("route-a");
    expect(byKind.best_safe_route.routeKey).toBe("route-c");
    expect(byKind.best_isk_per_jump.routeKey).toBe("route-b");
    expect(byKind.best_low_capital.routeKey).toBe("route-c");
    expect(byKind.best_backhaul.routeKey).toBe("route-c");
  });

  it("adds near-lens-origin card only when lens is active and recomputes card route", () => {
    const inactive = deriveRadiusBestDealCards({
      topRoutePicks: picks,
      actionQueue: queue,
      batchMetricsByRoute,
      routeAggregateMetricsByRoute,
      routeExplanationByKey,
      lensDeltaByRouteKey: {},
      lensActive: false,
    });
    expect(inactive.some((card) => card.kind === "best_near_lens_origin")).toBe(false);

    const active = deriveRadiusBestDealCards({
      topRoutePicks: picks,
      actionQueue: queue,
      batchMetricsByRoute,
      routeAggregateMetricsByRoute,
      routeExplanationByKey,
      lensDeltaByRouteKey: {
        "route-a": "Δ +6.0 from lens baseline",
        "route-b": "Δ +2.0 from lens baseline",
        "route-c": "Δ -4.0 from lens baseline",
      },
      lensActive: true,
    });
    expect(active.find((card) => card.kind === "best_near_lens_origin")?.routeKey).toBe("route-b");
  });

  it("sources why summaries directly from route explanation map", () => {
    const cards = deriveRadiusBestDealCards({
      topRoutePicks: picks,
      actionQueue: queue,
      batchMetricsByRoute,
      routeAggregateMetricsByRoute,
      routeExplanationByKey,
    });

    const quickCard = cards.find((card) => card.kind === "best_single_item");
    expect(quickCard?.whySummary).toBe("B summary");
  });

  it("recomputes outputs on filter/preset-style input changes", () => {
    const first = deriveRadiusBestDealCards({
      topRoutePicks: picks,
      actionQueue: queue,
      batchMetricsByRoute,
      routeAggregateMetricsByRoute,
      routeExplanationByKey,
    });

    const filteredPicks: TopRoutePicks = {
      ...picks,
      bestQuickSingleRoute: picks.bestRecommendedRoutePack,
    };
    const presetShiftedMetrics: Record<string, RouteBatchMetadata> = {
      ...batchMetricsByRoute,
      "route-c": {
        ...batchMetricsByRoute["route-c"],
        routeCapacityUsedPercent: 98,
      },
    };

    const second = deriveRadiusBestDealCards({
      topRoutePicks: filteredPicks,
      actionQueue: [],
      batchMetricsByRoute: presetShiftedMetrics,
      routeAggregateMetricsByRoute,
      routeExplanationByKey,
    });

    expect(first.find((card) => card.kind === "best_single_item")?.routeKey).toBe("route-b");
    expect(second.find((card) => card.kind === "best_single_item")?.routeKey).toBe("route-a");
    expect(second.find((card) => card.kind === "best_full_cargo")?.routeKey).toBe("route-c");
  });
});
