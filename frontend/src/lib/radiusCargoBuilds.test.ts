import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import {
  buildRadiusCargoBuilds,
  RADIUS_CARGO_BUILD_PRESETS,
} from "@/lib/radiusCargoBuilds";
import type { RouteAggregateMetrics } from "@/lib/useRadiusRouteInsights";
import { routeGroupKey } from "@/lib/batchMetrics";

function row(name: string, overrides: Partial<FlipResult> = {}): FlipResult {
  const typeIdSeed = name
    .split("")
    .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
  return {
    TypeID: typeIdSeed + 1000,
    TypeName: name,
    Volume: 10,
    UnitsToBuy: 100,
    BuyPrice: 100000,
    ExpectedBuyPrice: 100000,
    SellPrice: 120000,
    ProfitPerUnit: 20000,
    MarginPercent: 20,
    TotalProfit: 20000000,
    ExpectedProfit: 22000000,
    RealProfit: 20000000,
    ProfitPerJump: 2500000,
    BuyJumps: 2,
    SellJumps: 6,
    BuyStation: "Jita",
    SellStation: "Amarr",
    BuySystemName: "Jita",
    SellSystemName: "Amarr",
    BuySystemID: 1,
    SellSystemID: 2,
    BuyLocationID: 10,
    SellLocationID: 20,
    FilledQty: 100,
    CanFill: true,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalJumps: 8,
    DailyVolume: 5000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 10000000,
    ...overrides,
  };
}

const aggregate: RouteAggregateMetrics = {
  routeSafetyRank: 0,
  dailyIskPerJump: 20_000_000,
  dailyProfit: 180_000_000,
  iskPerM3PerJump: 2000,
  fastestIskPerJump: 20_000_000,
  weakestExecutionQuality: 70,
  riskSpikeCount: 0,
  riskNoHistoryCount: 0,
  riskUnstableHistoryCount: 0,
  riskThinFillCount: 0,
  riskTotalCount: 1,
  turnoverDays: 1,
  exitOverhangDays: 1,
  breakevenBuffer: 12,
  dailyProfitOverCapital: 0.18,
  routeTotalProfit: 180_000_000,
  routeTotalCapital: 800_000_000,
  weightedSlippagePct: 1,
};

describe("buildRadiusCargoBuilds", () => {
  it("respects capacity and capital constraints", () => {
    const rows = [
      row("Fits", { Volume: 5, UnitsToBuy: 200, BuyPrice: 200000 }),
      row("Too big", { Volume: 600, UnitsToBuy: 100, BuyPrice: 500000 }),
    ];
    const key = routeGroupKey(rows[0]);

    const builds = buildRadiusCargoBuilds({
      rows,
      routeAggregateMetricsByRoute: { [key]: aggregate },
      preset: {
        ...RADIUS_CARGO_BUILD_PRESETS.low_capital,
        minExecutionQuality: 0,
        minConfidencePercent: 0,
        minJumpEfficiencyIsk: 0,
      },
    });

    expect(builds).toHaveLength(1);
    expect(builds[0].rows.some((r) => r.TypeName === "Too big")).toBe(false);
    expect(builds[0].totalCapitalIsk).toBeLessThanOrEqual(
      RADIUS_CARGO_BUILD_PRESETS.low_capital.maxCapitalIsk,
    );
  });

  it("ranks deterministically with tie-break rules", () => {
    const rows = [
      row("A route", { BuyLocationID: 10, SellLocationID: 20, TotalProfit: 10_000_000, ExpectedProfit: 11_000_000 }),
      row("B route", { BuyLocationID: 11, SellLocationID: 21, BuyStation: "Perimeter", SellStation: "Dodixie", BuySystemName: "Perimeter", SellSystemName: "Dodixie", TotalProfit: 10_000_000, ExpectedProfit: 11_000_000 }),
    ];

    const byRoute: Record<string, RouteAggregateMetrics> = {
      [routeGroupKey(rows[0])]: aggregate,
      [routeGroupKey(rows[1])]: { ...aggregate },
    };

    const first = buildRadiusCargoBuilds({ rows, routeAggregateMetricsByRoute: byRoute, preset: RADIUS_CARGO_BUILD_PRESETS.viator_safe });
    const second = buildRadiusCargoBuilds({ rows, routeAggregateMetricsByRoute: byRoute, preset: RADIUS_CARGO_BUILD_PRESETS.viator_safe });

    expect(first.map((b) => b.routeKey)).toEqual(second.map((b) => b.routeKey));
  });

  it("preset switches alter eligible outputs", () => {
    const risky = row("Risky", { BuyLocationID: 77, SellLocationID: 88, BuyStation: "Hek", SellStation: "Rens", BuySystemName: "Hek", SellSystemName: "Rens" });
    const riskyKey = routeGroupKey(risky);
    const byRoute: Record<string, RouteAggregateMetrics> = {
      [riskyKey]: { ...aggregate, riskTotalCount: 4 },
    };

    const highConfidence = buildRadiusCargoBuilds({
      rows: [risky],
      routeAggregateMetricsByRoute: byRoute,
      preset: RADIUS_CARGO_BUILD_PRESETS.high_confidence,
    });
    const maxProfit = buildRadiusCargoBuilds({
      rows: [risky],
      routeAggregateMetricsByRoute: byRoute,
      preset: RADIUS_CARGO_BUILD_PRESETS.viator_max_profit,
    });

    expect(highConfidence).toHaveLength(0);
    expect(maxProfit).toHaveLength(1);
  });
});
