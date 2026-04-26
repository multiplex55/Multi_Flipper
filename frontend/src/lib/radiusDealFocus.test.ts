import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import type { TopRoutePicks } from "@/lib/radiusMetrics";
import type { RouteBatchMetadata } from "@/lib/batchMetrics";
import type { RouteAggregateMetrics } from "@/lib/useRadiusRouteInsights";
import { deriveRadiusDealFocusCandidates } from "@/lib/radiusDealFocus";

function row(partial: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Tritanium",
    Volume: 1,
    BuyPrice: 1,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyLocationID: 60003760,
    SellPrice: 2,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    SellLocationID: 60008494,
    ProfitPerUnit: 1,
    MarginPercent: 1,
    UnitsToBuy: 100,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 1000,
    ProfitPerJump: 100,
    BuyJumps: 1,
    SellJumps: 1,
    TotalJumps: 2,
    DailyVolume: 100,
    Velocity: 1,
    PriceTrend: 1,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 1000,
    ...partial,
  };
}

const topRoutePicks: TopRoutePicks = {
  bestRecommendedRoutePack: null,
  bestQuickSingleRoute: null,
  bestSafeFillerRoute: null,
};

describe("deriveRadiusDealFocusCandidates", () => {
  it("ranks best-buy-now while suppressing extreme-risk low-confidence routes", () => {
    const rows = [
      row({ BuyLocationID: 1, SellLocationID: 2, TypeName: "Safe" }),
      row({ BuyLocationID: 3, SellLocationID: 4, TypeName: "Risky" }),
    ];
    const batchMetricsByRoute: Record<string, RouteBatchMetadata> = {
      "loc:1->loc:2": { ...( {} as RouteBatchMetadata), routeTotalProfit: 80_000_000, routeTotalCapital: 500_000_000, routeTotalVolume: 10_000, routeDailyIskPerJump: 9_000_000, routeWeakestExecutionQuality: 88, routeAverageFillConfidencePct: 82, routeRiskSpikeCount: 0, routeRiskNoHistoryCount: 0, routeRiskUnstableHistoryCount: 0, routeRiskThinFillCount: 0 },
      "loc:3->loc:4": { ...( {} as RouteBatchMetadata), routeTotalProfit: 120_000_000, routeTotalCapital: 800_000_000, routeTotalVolume: 12_000, routeDailyIskPerJump: 15_000_000, routeWeakestExecutionQuality: 35, routeAverageFillConfidencePct: 40, routeRiskSpikeCount: 5, routeRiskNoHistoryCount: 2, routeRiskUnstableHistoryCount: 1, routeRiskThinFillCount: 1, routeWeightedSlippagePct: 12 },
    };

    const cards = deriveRadiusDealFocusCandidates({
      rows,
      cargoBuilds: [],
      topRoutePicks,
      actionQueue: [],
      batchMetricsByRoute,
      routeAggregateMetricsByRoute: {},
      verificationStateByRouteKey: { "loc:1->loc:2": "fresh", "loc:3->loc:4": "fresh" },
      cargoCapacityM3: 20_000,
    });

    expect(cards.find((card) => card.kind === "best_buy_now")?.routeKey).toBe("loc:1->loc:2");
  });

  it("maps verification state to action and excludes invalid low-capital rows", () => {
    const rows = [row({ BuyLocationID: 1, SellLocationID: 2 })];
    const cards = deriveRadiusDealFocusCandidates({
      rows,
      cargoBuilds: [],
      topRoutePicks,
      actionQueue: [],
      batchMetricsByRoute: {
        "loc:1->loc:2": { ...( {} as RouteBatchMetadata), routeTotalProfit: 2_000_000, routeTotalCapital: 0, routeTotalVolume: 1000, routeDailyIskPerJump: 500_000, routeWeakestExecutionQuality: 90, routeAverageFillConfidencePct: 90 },
      },
      routeAggregateMetricsByRoute: {},
      verificationStateByRouteKey: { "loc:1->loc:2": "stale" },
      cargoCapacityM3: 20_000,
    });

    const buyNow = cards.find((card) => card.kind === "best_buy_now");
    expect(buyNow?.recommendedAction).toBe("verify");
    expect(cards.some((card) => card.kind === "best_low_capital")).toBe(false);
  });

  it("uses deterministic tie-breakers", () => {
    const rows = [
      row({ BuyLocationID: 11, SellLocationID: 21, TypeName: "B Item" }),
      row({ BuyLocationID: 10, SellLocationID: 20, TypeName: "A Item" }),
    ];
    const metrics: Record<string, RouteBatchMetadata> = {
      "loc:11->loc:21": { ...( {} as RouteBatchMetadata), routeTotalProfit: 10_000_000, routeTotalCapital: 100_000_000, routeTotalVolume: 2000, routeDailyIskPerJump: 2_000_000, routeWeakestExecutionQuality: 80, routeAverageFillConfidencePct: 80 },
      "loc:10->loc:20": { ...( {} as RouteBatchMetadata), routeTotalProfit: 10_000_000, routeTotalCapital: 100_000_000, routeTotalVolume: 2000, routeDailyIskPerJump: 2_000_000, routeWeakestExecutionQuality: 80, routeAverageFillConfidencePct: 80 },
    };
    const aggregate: Record<string, RouteAggregateMetrics> = {
      "loc:10->loc:20": { ...( {} as RouteAggregateMetrics), riskTotalCount: 0, weakestExecutionQuality: 80, weightedSlippagePct: 0 },
      "loc:11->loc:21": { ...( {} as RouteAggregateMetrics), riskTotalCount: 0, weakestExecutionQuality: 80, weightedSlippagePct: 0 },
    };

    const cards = deriveRadiusDealFocusCandidates({
      rows,
      cargoBuilds: [],
      topRoutePicks,
      actionQueue: [],
      batchMetricsByRoute: metrics,
      routeAggregateMetricsByRoute: aggregate,
      verificationStateByRouteKey: { "loc:11->loc:21": "fresh", "loc:10->loc:20": "fresh" },
      cargoCapacityM3: 20_000,
    });

    expect(cards.find((card) => card.kind === "best_full_cargo")?.routeKey).toBe("loc:10->loc:20");
  });

  it("remains stable with sparse rows and missing queue/verification payloads", () => {
    const sparseRows = [
      row({ BuyLocationID: 44, SellLocationID: 55, TypeName: "Sparse", HistoryAvailable: undefined, FilledQty: undefined }),
    ];
    expect(() =>
      deriveRadiusDealFocusCandidates({
        rows: sparseRows,
        cargoBuilds: [],
        topRoutePicks,
        actionQueue: [],
        batchMetricsByRoute: {},
        routeAggregateMetricsByRoute: {},
      }),
    ).not.toThrow();
  });

  it("does not hide all candidates when routes are high-risk or abort-marked", () => {
    const rows = [row({ BuyLocationID: 1, SellLocationID: 2, TypeName: "Extreme" })];
    const cards = deriveRadiusDealFocusCandidates({
      rows,
      cargoBuilds: [],
      topRoutePicks,
      actionQueue: [],
      batchMetricsByRoute: {
        "loc:1->loc:2": { ...( {} as RouteBatchMetadata), routeTotalProfit: 5_000_000, routeTotalCapital: 500_000_000, routeTotalVolume: 1000, routeDailyIskPerJump: 100_000, routeWeakestExecutionQuality: 20, routeAverageFillConfidencePct: 10, routeRiskSpikeCount: 8, routeRiskNoHistoryCount: 4, routeRiskUnstableHistoryCount: 3, routeRiskThinFillCount: 2 },
      },
      routeAggregateMetricsByRoute: {},
      verificationStateByRouteKey: { "loc:1->loc:2": "abort" },
    });

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some((card) => card.kind === "best_safe_depth")).toBe(true);
  });
});
