import type { FlipResult } from "@/lib/types";
import type { RouteAggregateMetrics } from "@/lib/useRadiusRouteInsights";

export function makeFlipResult(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: overrides.TypeID ?? 1,
    TypeName: overrides.TypeName ?? `Type ${overrides.TypeID ?? 1}`,
    Volume: overrides.Volume ?? 2,
    BuyPrice: overrides.BuyPrice ?? 100,
    BuyStation: overrides.BuyStation ?? "Buy",
    BuySystemName: overrides.BuySystemName ?? "BuySys",
    BuySystemID: overrides.BuySystemID ?? 300001,
    BuyLocationID: overrides.BuyLocationID ?? 600001,
    SellPrice: overrides.SellPrice ?? 130,
    SellStation: overrides.SellStation ?? "Sell",
    SellSystemName: overrides.SellSystemName ?? "SellSys",
    SellSystemID: overrides.SellSystemID ?? 300002,
    SellLocationID: overrides.SellLocationID ?? 600002,
    ProfitPerUnit: overrides.ProfitPerUnit ?? 20,
    MarginPercent: overrides.MarginPercent ?? 20,
    UnitsToBuy: overrides.UnitsToBuy ?? 10,
    BuyOrderRemain: overrides.BuyOrderRemain ?? 10,
    SellOrderRemain: overrides.SellOrderRemain ?? 10,
    TotalProfit: overrides.TotalProfit ?? 200,
    ProfitPerJump: overrides.ProfitPerJump ?? 50,
    BuyJumps: overrides.BuyJumps ?? 1,
    SellJumps: overrides.SellJumps ?? 1,
    TotalJumps: overrides.TotalJumps ?? 2,
    DailyVolume: overrides.DailyVolume ?? 100,
    Velocity: overrides.Velocity ?? 1,
    PriceTrend: overrides.PriceTrend ?? 1,
    BuyCompetitors: overrides.BuyCompetitors ?? 1,
    SellCompetitors: overrides.SellCompetitors ?? 1,
    DailyProfit: overrides.DailyProfit ?? 10,
    ...overrides,
  };
}

export function makeRouteAggregateMetrics(
  overrides: Partial<RouteAggregateMetrics> = {},
): RouteAggregateMetrics {
  return {
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
    ...overrides,
  };
}
