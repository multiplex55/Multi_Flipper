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
  it("includes oversized rows as partial fills when cargo allows only part of the request", () => {
    const rows = [
      row("Fits", { Volume: 10, UnitsToBuy: 100, BuyPrice: 100000, ProfitPerUnit: 5000 }),
      row("Too big", { Volume: 600, UnitsToBuy: 100, BuyPrice: 500000, ProfitPerUnit: 20000 }),
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
    const tooBigLine = builds[0].lines.find((line) => line.row.TypeName === "Too big");
    expect(tooBigLine).toBeDefined();
    expect(tooBigLine?.partial).toBe(true);
    expect(tooBigLine?.units).toBe(25);
    expect(tooBigLine?.volumeM3).toBe(15000);
    expect(builds[0].totalCapitalIsk).toBeLessThanOrEqual(
      RADIUS_CARGO_BUILD_PRESETS.low_capital.maxCapitalIsk,
    );
    expect(builds[0].rows).toEqual(builds[0].lines.map((line) => line.row));
  });

  it("partially fills rows when limited by capital", () => {
    const rows = [row("Capital capped", { Volume: 1, UnitsToBuy: 1000, BuyPrice: 1000000, ProfitPerUnit: 100000, ExpectedBuyPrice: 1000000 })];
    const key = routeGroupKey(rows[0]);
    const preset = {
      ...RADIUS_CARGO_BUILD_PRESETS.low_capital,
      cargoCapacityM3: 100_000,
      maxCapitalIsk: 350_000_000,
      minExecutionQuality: 0,
      minConfidencePercent: 0,
      minJumpEfficiencyIsk: 0,
    };

    const builds = buildRadiusCargoBuilds({
      rows,
      routeAggregateMetricsByRoute: { [key]: aggregate },
      preset,
    });

    expect(builds).toHaveLength(1);
    expect(builds[0].lines[0]?.units).toBe(350);
    expect(builds[0].lines[0]?.partial).toBe(true);
    expect(builds[0].totalCapitalIsk).toBe(350_000_000);
  });

  it("handles exact-fit and zero-fit boundaries", () => {
    const exactFit = row("Exact fit", {
      Volume: 100,
      UnitsToBuy: 100,
      BuyPrice: 1_000_000,
      ExpectedBuyPrice: 1_000_000,
      ProfitPerUnit: 10_000,
    });
    const zeroFit = row("Zero fit", {
      Volume: 100,
      UnitsToBuy: 100,
      BuyPrice: 1_000_000,
      ExpectedBuyPrice: 1_000_000,
      ProfitPerUnit: 10_000,
      TotalProfit: 1_000_000,
      ExpectedProfit: 1_000_000,
      RealProfit: 1_000_000,
    });
    const exactKey = routeGroupKey(exactFit);
    const preset = {
      ...RADIUS_CARGO_BUILD_PRESETS.low_capital,
      cargoCapacityM3: 10_000,
      maxCapitalIsk: 100_000_000,
      minExecutionQuality: 0,
      minConfidencePercent: 0,
      minJumpEfficiencyIsk: 0,
    };

    const builds = buildRadiusCargoBuilds({
      rows: [exactFit, zeroFit],
      routeAggregateMetricsByRoute: {
        [exactKey]: aggregate,
      },
      preset,
    });

    expect(builds).toHaveLength(1);
    expect(builds[0].routeKey).toBe(exactKey);
    expect(builds[0].lines[0]?.units).toBe(100);
    expect(builds[0].lines[0]?.partial).toBe(false);
  });

  it("computes totals from selected line units", () => {
    const rows = [
      row("Line one", {
        Volume: 5,
        UnitsToBuy: 100,
        BuyPrice: 10_000,
        ExpectedBuyPrice: 10_000,
        SellPrice: 12_000,
        ProfitPerUnit: 2_000,
        TotalProfit: 10_000_000,
        ExpectedProfit: 10_000_000,
        RealProfit: 10_000_000,
      }),
      row("Line two partial", {
        Volume: 20,
        UnitsToBuy: 300,
        BuyPrice: 100_000,
        ExpectedBuyPrice: 100_000,
        SellPrice: 115_000,
        ProfitPerUnit: 15_000,
        TotalProfit: 40_000_000,
        ExpectedProfit: 40_000_000,
        RealProfit: 40_000_000,
      }),
    ];
    const key = routeGroupKey(rows[0]);
    const preset = {
      ...RADIUS_CARGO_BUILD_PRESETS.low_capital,
      cargoCapacityM3: 5_000,
      maxCapitalIsk: 350_000_000,
      minExecutionQuality: 0,
      minConfidencePercent: 0,
      minJumpEfficiencyIsk: 0,
    };

    const builds = buildRadiusCargoBuilds({
      rows,
      routeAggregateMetricsByRoute: { [key]: aggregate },
      preset,
    });

    expect(builds).toHaveLength(1);
    const expectedCapital = builds[0].lines.reduce((sum, line) => sum + line.capitalIsk, 0);
    const expectedProfit = builds[0].lines.reduce((sum, line) => sum + line.profitIsk, 0);
    const expectedGrossSell = builds[0].lines.reduce((sum, line) => sum + line.grossSellIsk, 0);
    expect(builds[0].lines.some((line) => line.partial)).toBe(true);
    expect(builds[0].totalCapitalIsk).toBe(expectedCapital);
    expect(builds[0].totalProfitIsk).toBe(expectedProfit);
    expect(builds[0].totalGrossSellIsk).toBe(expectedGrossSell);
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


  it("admits practical Viator-safe low six-figure ISK/jump routes", () => {
    const practical = row("Practical viator", {
      UnitsToBuy: 100,
      ProfitPerUnit: 1_500,
      TotalProfit: 150_000,
      ExpectedProfit: 150_000,
      RealProfit: 150_000,
      TotalJumps: 1,
    });
    const key = routeGroupKey(practical);

    const builds = buildRadiusCargoBuilds({
      rows: [practical],
      routeAggregateMetricsByRoute: {
        [key]: { ...aggregate, dailyIskPerJump: 0, riskTotalCount: 1 },
      },
      preset: RADIUS_CARGO_BUILD_PRESETS.viator_safe,
    });

    expect(builds).toHaveLength(1);
    expect(builds[0].iskPerJump).toBe(150_000);
  });

  it("allows moderate warning density when maxRiskRate permits it", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      row(`Batch ${index + 1}`, {
        TypeID: 4_000 + index,
        BuyLocationID: 501,
        SellLocationID: 601,
        BuyStation: "Jita",
        SellStation: "Amarr",
        BuySystemName: "Jita",
        SellSystemName: "Amarr",
      }),
    );
    const key = routeGroupKey(rows[0]);
    const byRoute: Record<string, RouteAggregateMetrics> = {
      [key]: { ...aggregate, dailyIskPerJump: 0, riskTotalCount: 4 },
    };

    const allowed = buildRadiusCargoBuilds({
      rows,
      routeAggregateMetricsByRoute: byRoute,
      preset: RADIUS_CARGO_BUILD_PRESETS.dst_bulk,
    });

    const blocked = buildRadiusCargoBuilds({
      rows,
      routeAggregateMetricsByRoute: byRoute,
      preset: { ...RADIUS_CARGO_BUILD_PRESETS.dst_bulk, maxRiskRate: 0.45 },
    });

    expect(allowed).toHaveLength(1);
    expect(allowed[0].riskRate).toBe(0.5);
    expect(blocked).toHaveLength(0);
  });

  it("still accepts high-quality high-efficiency routes under viator safe", () => {
    const reliable = row("Reliable", { ProfitPerUnit: 50_000, TotalJumps: 4 });
    const key = routeGroupKey(reliable);

    const builds = buildRadiusCargoBuilds({
      rows: [reliable],
      routeAggregateMetricsByRoute: {
        [key]: { ...aggregate, dailyIskPerJump: 0, riskTotalCount: 1 },
      },
      preset: RADIUS_CARGO_BUILD_PRESETS.viator_safe,
    });

    expect(builds).toHaveLength(1);
    expect(builds[0].executionCue).toBe("smooth");
  });

  it("preset switches alter eligible outputs", () => {
    const risky = row("Risky", {
      BuyLocationID: 77,
      SellLocationID: 88,
      BuyStation: "Hek",
      SellStation: "Rens",
      BuySystemName: "Hek",
      SellSystemName: "Rens",
      ProfitPerUnit: 100_000,
    });
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
