import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import type { RouteBatchMetadata } from "@/lib/batchMetrics";
import { routeGroupKey } from "@/lib/batchMetrics";
import {
  deriveRadiusRouteInsights,
  type RadiusRouteInsightInputRow,
} from "@/lib/useRadiusRouteInsights";

function makeFlip(partial: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Buy",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 120,
    SellStation: "Sell",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 20,
    MarginPercent: 20,
    UnitsToBuy: 10,
    BuyOrderRemain: 200,
    SellOrderRemain: 200,
    TotalProfit: 200,
    ProfitPerJump: 20,
    BuyJumps: 1,
    SellJumps: 2,
    TotalJumps: 3,
    DailyVolume: 100,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 50,
    ...partial,
  };
}

function makeRouteMeta(partial: Partial<RouteBatchMetadata>): RouteBatchMetadata {
  const merged = {
    batchNumber: 1,
    batchProfit: 1,
    batchTotalCapital: 1,
    batchIskPerJump: 1,
    routeItemCount: 1,
    routeTotalProfit: 100,
    routeTotalCapital: 1000,
    routeTotalVolume: 10,
    routeCapacityUsedPercent: 20,
    routeRealIskPerJump: 50,
    routeDailyIskPerJump: 60,
    routeRealIskPerM3PerJump: 7,
    routeDailyProfit: 90,
    routeDailyProfitOverCapital: 0.1,
    routeWeightedSlippagePct: 2,
    routeWeakestExecutionQuality: 75,
    routeTurnoverDays: 3,
    routeExitOverhangDays: 2,
    routeBreakevenBuffer: 10,
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
    routeProfitConcentrationPct: null,
    routeRemainingCargoM3: null,
    routeComplexity: "Clean",
    ...partial,
  };
  return {
    ...merged,
    routeProfitConcentrationPct: merged.routeProfitConcentrationPct ?? null,
  } as RouteBatchMetadata;
}

function run(rows: RadiusRouteInsightInputRow[], byRoute: Record<string, RouteBatchMetadata>) {
  return deriveRadiusRouteInsights({
    rows,
    resultsCount: rows.length,
    batchMetricsByRoute: byRoute,
    routeSafetyMap: {
      "30000142:30002187": { status: "summary", danger: "green", kills: 0, totalISK: 0 },
      "30002187:30000142": { status: "summary", danger: "green", kills: 0, totalISK: 0 },
    },
    trackedTypeIds: new Set([34]),
    filterSnapshots: {},
  });
}

describe("deriveRadiusRouteInsights", () => {
  it("returns deterministic outputs for fixed fixtures", () => {
    const a = makeFlip({ TypeID: 34, TypeName: "Trit", TotalProfit: 300 });
    const b = makeFlip({ TypeID: 35, TypeName: "Pyer", BuySystemID: 30002187, SellSystemID: 30000142, BuySystemName: "Amarr", SellSystemName: "Jita", TotalProfit: 150 });
    const rows = [
      { row: a, endpointPreferences: { scoreDelta: 3, appliedRules: ["r1"], excluded: false, excludedReasons: [] } },
      { row: b, endpointPreferences: { scoreDelta: -2, appliedRules: [], excluded: false, excludedReasons: [] } },
    ];
    const byRoute = {
      [routeGroupKey(a)]: makeRouteMeta({ routeTotalProfit: 300, routeComplexity: "Clean" }),
      [routeGroupKey(b)]: makeRouteMeta({ routeTotalProfit: 150, routeComplexity: "Moderate", routeRiskSpikeCount: 1 }),
    };

    const first = run(rows, byRoute);
    const second = run(rows, byRoute);

    expect(first.routeSummaries).toEqual(second.routeSummaries);
    expect(first.topRoutePickCandidates).toEqual(second.topRoutePickCandidates);
    expect(first.topRoutePicks).toEqual(second.topRoutePicks);
  });

  it("handles empty results", () => {
    const result = deriveRadiusRouteInsights({
      rows: [],
      resultsCount: 0,
      batchMetricsByRoute: {},
      routeSafetyMap: {},
      trackedTypeIds: new Set(),
      filterSnapshots: {},
    });

    expect(result.routeSummaries).toEqual([]);
    expect(result.topRoutePickCandidates).toEqual([]);
    expect(result.actionQueue).toEqual([]);
  });

  it("handles all-hidden rows and conflicting endpoint preferences", () => {
    const row = makeFlip({ TypeID: 40, TypeName: "Mex", TotalProfit: 120 });
    const key = routeGroupKey(row);
    const result = deriveRadiusRouteInsights({
      rows: [
        {
          row,
          endpointPreferences: {
            scoreDelta: -9,
            appliedRules: ["sell_structure"],
            excluded: false,
            excludedReasons: ["hard_require_hub_sell"],
          },
        },
      ],
      resultsCount: 4,
      batchMetricsByRoute: { [key]: makeRouteMeta({ routeComplexity: "Busy" }) },
      routeSafetyMap: {},
      trackedTypeIds: new Set(),
      hiddenRowCount: 3,
      endpointPreferenceMode: "hide",
      filterSnapshots: { BuyStation: "Astrahus" },
    });

    expect(result.suppressionTelemetry.hiddenRows).toBe(3);
    expect(result.suppressionTelemetry.hardBanFiltered).toBe(3);
    expect(result.routeSummaries[0].endpointScoreDelta).toBe(-9);
    expect(result.routeSummaries[0].endpointRuleHits).toBe(1);
  });

  it("flags low-confidence routes", () => {
    const row = makeFlip({ TypeID: 70, TypeName: "Nocx" });
    const key = routeGroupKey(row);
    const result = deriveRadiusRouteInsights({
      rows: [{ row }],
      resultsCount: 1,
      batchMetricsByRoute: {
        [key]: makeRouteMeta({
          routeWeakestExecutionQuality: 12,
          routeWeightedSlippagePct: 25,
          routeRiskSpikeCount: 2,
          routeRiskNoHistoryCount: 2,
          routeComplexity: "Busy",
        }),
      },
      routeSafetyMap: { "30000142:30002187": { status: "summary", danger: "red", kills: 0, totalISK: 0 } },
      trackedTypeIds: new Set(),
      filterSnapshots: {},
    });

    expect(result.routeSummaries[0].badge.confidence.label).toBe("Low");
    expect(result.loopOpportunitySummary.lowConfidenceRoutes).toBeGreaterThanOrEqual(1);
  });

  it("keeps sort stability, no duplicate keys, and aggregate totals", () => {
    const rows = [
      { row: makeFlip({ TypeID: 101, TypeName: "A" }) },
      { row: makeFlip({ TypeID: 102, TypeName: "B", BuySystemID: 30002187, SellSystemID: 30000142, BuySystemName: "Amarr", SellSystemName: "Jita" }) },
      { row: makeFlip({ TypeID: 103, TypeName: "C" }) },
    ];
    const routeA = routeGroupKey(rows[0].row);
    const routeB = routeGroupKey(rows[1].row);
    const byRoute = {
      [routeA]: makeRouteMeta({ routeTotalProfit: 400 }),
      [routeB]: makeRouteMeta({ routeTotalProfit: 100 }),
    };

    const result = run(rows, byRoute);
    const keys = result.routeSummaries.map((item) => item.routeKey);
    const unique = new Set(keys);

    expect(keys).toEqual([...keys].sort());
    expect(unique.size).toBe(keys.length);
    expect(result.routeAggregateMetricsByRoute[routeA].routeTotalProfit).toBe(400);
    expect(result.routeAggregateMetricsByRoute[routeB].routeTotalProfit).toBe(100);
  });
});
