import { describe, expect, it } from "vitest";
import {
  contractResultMetrics,
  explainOpportunityScore,
  flipResultMetrics,
  normalizeTo100,
  normalizeWeights,
  scoreContractResult,
  scoreFlipResult,
  scoreStationTrade,
  stationTradeMetrics,
} from "@/lib/opportunityScore";
import type { ContractResult, FlipResult, StationTrade } from "@/lib/types";

function makeFlip(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 34,
    TypeName: "Tritanium",
    Volume: 0.01,
    BuyPrice: 5,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 7,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 1,
    MarginPercent: 20,
    UnitsToBuy: 100000,
    BuyOrderRemain: 100000,
    SellOrderRemain: 90000,
    TotalProfit: 100000,
    ProfitPerJump: 20000,
    BuyJumps: 0,
    SellJumps: 4,
    TotalJumps: 4,
    DailyVolume: 250000,
    Velocity: 40,
    PriceTrend: 1,
    BuyCompetitors: 2,
    SellCompetitors: 3,
    DailyProfit: 50000,
    ...overrides,
  };
}

function makeStation(overrides: Partial<StationTrade> = {}): StationTrade {
  return {
    TypeID: 44992,
    TypeName: "Skill Injector",
    Volume: 1,
    BuyPrice: 700_000_000,
    SellPrice: 730_000_000,
    Spread: 30_000_000,
    MarginPercent: 4.2,
    ProfitPerUnit: 28_000_000,
    DailyVolume: 18,
    BuyOrderCount: 22,
    SellOrderCount: 16,
    BuyVolume: 60,
    SellVolume: 50,
    TotalProfit: 280_000_000,
    ROI: 0.04,
    StationName: "Jita 4-4",
    StationID: 60003760,
    CapitalRequired: 700_000_000,
    NowROI: 0.04,
    PeriodROI: 0.05,
    BuyUnitsPerDay: 12,
    SellUnitsPerDay: 15,
    BvSRatio: 1.2,
    DOS: 3,
    VWAP: 710_000_000,
    PVI: 30,
    OBDS: 24,
    SDS: 10,
    CI: 0.2,
    CTS: 0.1,
    AvgPrice: 715_000_000,
    PriceHigh: 760_000_000,
    PriceLow: 680_000_000,
    IsExtremePriceFlag: false,
    IsHighRiskFlag: false,
    ...overrides,
  };
}

function makeContract(overrides: Partial<ContractResult> = {}): ContractResult {
  return {
    ContractID: 99,
    Title: "Officer loot",
    Price: 1_200_000_000,
    MarketValue: 1_450_000_000,
    Profit: 250_000_000,
    MarginPercent: 20,
    Volume: 120,
    StationName: "Perimeter",
    ItemCount: 4,
    Jumps: 3,
    ProfitPerJump: 83_000_000,
    ...overrides,
  };
}

describe("opportunityScore", () => {
  it("produces deterministic score for fixture rows", () => {
    const flip = scoreFlipResult(makeFlip({ ExpectedProfit: 35_000_000, DayCapitalRequired: 180_000_000 }));
    const station = scoreStationTrade(makeStation({ ExpectedProfit: 120_000_000 }));
    const contract = scoreContractResult(
      makeContract({ ExpectedProfit: 210_000_000, SellConfidence: 0.8, EstLiquidationDays: 6 }),
    );

    expect(flip.finalScore).toBeCloseTo(77.0077, 4);
    expect(station.finalScore).toBeCloseTo(71.5852, 4);
    expect(contract.finalScore).toBeCloseTo(64.9465, 4);
  });

  it("always keeps final score in 0..100", () => {
    const veryBad = scoreFlipResult(
      makeFlip({
        ExpectedProfit: -5_000_000,
        BuyCompetitors: 25,
        SellCompetitors: 25,
        TotalJumps: 45,
        DayCapitalRequired: 5_000_000_000,
        DailyVolume: 0,
      }),
    );

    const veryGood = scoreFlipResult(
      makeFlip({
        ExpectedProfit: 5_000_000_000,
        BuyCompetitors: 0,
        SellCompetitors: 0,
        TotalJumps: 0,
        DayCapitalRequired: 1_000_000,
        DailyVolume: 10_000,
      }),
    );

    expect(veryBad.finalScore).toBeGreaterThanOrEqual(0);
    expect(veryBad.finalScore).toBeLessThanOrEqual(100);
    expect(veryGood.finalScore).toBeGreaterThanOrEqual(0);
    expect(veryGood.finalScore).toBeLessThanOrEqual(100);
  });

  it("is monotonic for higher profit with equal factors", () => {
    const low = scoreStationTrade(makeStation({ ExpectedProfit: 10_000_000 }));
    const high = scoreStationTrade(makeStation({ ExpectedProfit: 150_000_000 }));
    expect(high.finalScore).toBeGreaterThan(low.finalScore);
  });

  it("handles missing fields with documented neutral/conservative defaults", () => {
    const sparse = scoreContractResult(
      makeContract({
        ExpectedProfit: undefined,
        Profit: undefined as unknown as number,
        SellConfidence: undefined,
        EstLiquidationDays: undefined,
        LiquidationJumps: undefined,
        Jumps: undefined as unknown as number,
        Price: 0,
      }),
    );

    expect(sparse.factors.profit.normalized).toBe(50);
    expect(sparse.factors.risk.normalized).toBeLessThan(50);
    expect(sparse.factors.jumps.normalized).toBeLessThan(50);
    expect(sparse.factors.capital.normalized).toBeLessThan(50);
  });

  it("dampens outliers with log/sqrt normalization", () => {
    const mediumProfit = normalizeTo100(100_000_000, { min: 0, max: 5_000_000_000, curve: "log" });
    const hugeProfit = normalizeTo100(5_000_000_000, { min: 0, max: 5_000_000_000, curve: "log" });
    const linearMedium = normalizeTo100(100_000_000, { min: 0, max: 5_000_000_000, curve: "linear" });
    const linearHuge = normalizeTo100(5_000_000_000, { min: 0, max: 5_000_000_000, curve: "linear" });

    expect(hugeProfit - mediumProfit).toBeLessThan(linearHuge - linearMedium);
  });

  it("normalizes weights and falls back to balanced defaults on all-zero", () => {
    const normalized = normalizeWeights({ profit: 4, risk: 2, velocity: 2, jumps: 1, capital: 1 });
    const total = Object.values(normalized).reduce((sum, n) => sum + n, 0);
    expect(total).toBeCloseTo(1, 8);
    expect(normalized.profit).toBeCloseTo(0.4, 8);

    const fallback = normalizeWeights({ profit: 0, risk: 0, velocity: 0, jumps: 0, capital: 0 });
    expect(fallback).toEqual({ profit: 0.34, risk: 0.2, velocity: 0.2, jumps: 0.13, capital: 0.13 });
  });

  it("maps flip adapter fields predictably", () => {
    const metrics = flipResultMetrics(
      makeFlip({
        ExpectedProfit: 11,
        DayTargetDemandPerDay: 22,
        TotalJumps: 6,
        DayCapitalRequired: 33,
      }),
    );

    expect(metrics).toMatchObject({ profit: 11, velocity: 22, jumps: 6, capital: 33 });
  });

  it("maps station adapter fields predictably", () => {
    const metrics = stationTradeMetrics(
      makeStation({
        ExpectedProfit: 10,
        SellUnitsPerDay: 25,
        CapitalRequired: 900,
      }),
    );

    expect(metrics).toMatchObject({ profit: 10, velocity: 25, jumps: 0, capital: 900 });
  });

  it("maps contract adapter fields predictably", () => {
    const metrics = contractResultMetrics(
      makeContract({
        ExpectedProfit: 66,
        SellConfidence: 0.9,
        EstLiquidationDays: 3,
        LiquidationJumps: 9,
        Price: 777,
      }),
    );

    expect(metrics.profit).toBe(66);
    expect(metrics.velocity).toBeCloseTo(10);
    expect(metrics.jumps).toBe(9);
    expect(metrics.capital).toBe(777);
    expect(metrics.risk).not.toBeNull();
  });

  it("builds short natural-language rationale", () => {
    const explanation = scoreFlipResult(
      makeFlip({ ExpectedProfit: 70_000_000, BuyCompetitors: 0, SellCompetitors: 0, DayCapitalRequired: 40_000_000 }),
    );
    expect(explainOpportunityScore(explanation)).toContain("Strengths");
  });
});
