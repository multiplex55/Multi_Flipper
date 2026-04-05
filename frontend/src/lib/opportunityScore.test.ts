import { describe, expect, it } from "vitest";
import {
  buildFlipScoreContext,
  buildOpportunityScanContext,
  buildStationScoreContext,
  contractResultMetrics,
  explainOpportunityScore,
  flipResultMetrics,
  normalizeTo100,
  normalizeWeights,
  percentile,
  scoreContractResult,
  scoreFlipResult,
  scoreStationTrade,
  stationTradeMetrics,
  strategyScoreToOpportunityProfile,
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
  it("maps strategy score config into opportunity profile keys", () => {
    expect(
      strategyScoreToOpportunityProfile({
        profit_weight: 45,
        risk_weight: 15,
        velocity_weight: 20,
        jump_weight: 10,
        capital_weight: 10,
      }),
    ).toEqual({
      profit: 45,
      risk: 15,
      velocity: 20,
      jumps: 10,
      capital: 10,
    });
  });

  it("normalizes new factor weights and preserves backward-compatible slider input", () => {
    const normalized = normalizeWeights({ profit: 4, risk: 2, velocity: 2, jumps: 1, capital: 1 });
    const total = Object.values(normalized).reduce((sum, n) => sum + n, 0);
    expect(total).toBeCloseTo(1, 8);
    expect(normalized.expectedProfit).toBeGreaterThan(normalized.jumpBurden);

    const fallback = normalizeWeights({ profit: 0, risk: 0, velocity: 0, jumps: 0, capital: 0 });
    expect(Object.values(fallback).reduce((sum, n) => sum + n, 0)).toBeCloseTo(1, 8);
  });

  it("produces deterministic score for fixture rows", () => {
    const flipA = scoreFlipResult(makeFlip({ ExpectedProfit: 35_000_000, DayCapitalRequired: 180_000_000 }));
    const stationA = scoreStationTrade(makeStation({ ExpectedProfit: 120_000_000 }));
    const contractA = scoreContractResult(
      makeContract({ ExpectedProfit: 210_000_000, SellConfidence: 0.8, EstLiquidationDays: 6 }),
    );

    const flipB = scoreFlipResult(makeFlip({ ExpectedProfit: 35_000_000, DayCapitalRequired: 180_000_000 }));
    const stationB = scoreStationTrade(makeStation({ ExpectedProfit: 120_000_000 }));
    const contractB = scoreContractResult(
      makeContract({ ExpectedProfit: 210_000_000, SellConfidence: 0.8, EstLiquidationDays: 6 }),
    );

    expect(flipA.finalScore).toBeCloseTo(flipB.finalScore, 8);
    expect(stationA.finalScore).toBeCloseTo(stationB.finalScore, 8);
    expect(contractA.finalScore).toBeCloseTo(contractB.finalScore, 8);
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

  it("builds short natural-language rationale", () => {
    const explanation = scoreFlipResult(
      makeFlip({ ExpectedProfit: 70_000_000, BuyCompetitors: 0, SellCompetitors: 0, DayCapitalRequired: 40_000_000 }),
    );
    expect(explainOpportunityScore(explanation)).toContain("High");
  });

  it("maps flip adapter fields predictably", () => {
    const metrics = flipResultMetrics(
      makeFlip({
        ExpectedProfit: 11,
        DayNowProfit: 22,
        TotalJumps: 6,
        DayCapitalRequired: 33,
      }),
    );

    expect(metrics).toMatchObject({ expectedProfit: 11, dailyRealizableProfit: 22, jumpBurden: 6 });
  });

  it("maps station adapter fields predictably", () => {
    const metrics = stationTradeMetrics(
      makeStation({
        ExpectedProfit: 10,
        DailyProfit: 25,
        CapitalRequired: 900,
      }),
    );

    expect(metrics).toMatchObject({ expectedProfit: 10, dailyRealizableProfit: 25, jumpBurden: 0 });
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

    expect(metrics.expectedProfit).toBe(66);
    expect(metrics.dailyRealizableProfit).toBeCloseTo(22);
    expect(metrics.jumpBurden).toBe(9);
    expect(metrics.capitalEfficiency).not.toBeNull();
  });

  it("dampens outliers with log/sqrt normalization", () => {
    const mediumProfit = normalizeTo100(100_000_000, { min: 0, max: 5_000_000_000, curve: "log" });
    const hugeProfit = normalizeTo100(5_000_000_000, { min: 0, max: 5_000_000_000, curve: "log" });
    const linearMedium = normalizeTo100(100_000_000, { min: 0, max: 5_000_000_000, curve: "linear" });
    const linearHuge = normalizeTo100(5_000_000_000, { min: 0, max: 5_000_000_000, curve: "linear" });

    expect(hugeProfit - mediumProfit).toBeLessThan(linearHuge - linearMedium);
  });

  it("percentile normalization stays robust with outliers", () => {
    const rows = [
      makeFlip({ ExpectedProfit: 10_000_000, DayNowProfit: 1_000_000 }),
      makeFlip({ ExpectedProfit: 11_000_000, DayNowProfit: 1_100_000 }),
      makeFlip({ ExpectedProfit: 12_000_000, DayNowProfit: 1_050_000 }),
      makeFlip({ ExpectedProfit: 500_000_000, DayNowProfit: 50_000_000 }),
    ];

    const context = buildFlipScoreContext(rows);
    const low = scoreFlipResult(rows[0], undefined, context).factors.expectedProfit.normalized;
    const high = scoreFlipResult(rows[2], undefined, context).factors.expectedProfit.normalized;

    expect(context.ranges.expectedProfit?.high ?? 0).toBeLessThan(500_000_000);
    expect(high).toBeGreaterThan(low);
  });

  it("handles narrow distributions via min-span normalization", () => {
    const rows = [
      makeStation({ ExpectedProfit: 20_000_000, DailyProfit: 2_000_000 }),
      makeStation({ ExpectedProfit: 20_010_000, DailyProfit: 2_010_000 }),
      makeStation({ ExpectedProfit: 20_020_000, DailyProfit: 2_020_000 }),
    ];
    const context = buildStationScoreContext(rows);
    const a = scoreStationTrade(rows[0], undefined, context).finalScore;
    const c = scoreStationTrade(rows[2], undefined, context).finalScore;
    expect(c).toBeGreaterThan(a);
  });

  it("same dataset with different visible ranges yields meaningful ordering", () => {
    const dataset = [
      makeFlip({ TypeID: 1, TypeName: "A", ExpectedProfit: 8_000_000, DayNowProfit: 700_000 }),
      makeFlip({ TypeID: 2, TypeName: "B", ExpectedProfit: 12_000_000, DayNowProfit: 1_000_000 }),
      makeFlip({ TypeID: 3, TypeName: "C", ExpectedProfit: 20_000_000, DayNowProfit: 1_700_000 }),
      makeFlip({ TypeID: 4, TypeName: "D", ExpectedProfit: 100_000_000, DayNowProfit: 5_000_000 }),
    ];

    const broadContext = buildFlipScoreContext(dataset);
    const narrowContext = buildFlipScoreContext(dataset.slice(0, 3));

    const broadRank = dataset.map((row) => ({ name: row.TypeName, s: scoreFlipResult(row, undefined, broadContext).finalScore }));
    const narrowRank = dataset.slice(0, 3).map((row) => ({ name: row.TypeName, s: scoreFlipResult(row, undefined, narrowContext).finalScore }));

    broadRank.sort((a, b) => b.s - a.s);
    narrowRank.sort((a, b) => b.s - a.s);

    expect(broadRank[0].name).toBe("D");
    expect(narrowRank[0].name).toBe("C");
    expect(narrowRank[0].s - narrowRank[2].s).toBeGreaterThan(1);
  });

  it("falls back to static defaults when scan context is missing", () => {
    const row = makeFlip({ ExpectedProfit: 48_000_000, DayCapitalRequired: 240_000_000 });
    const implicit = scoreFlipResult(row);
    const explicitNoRanges = scoreFlipResult(row, undefined, { ranges: {} });
    expect(implicit.finalScore).toBeCloseTo(explicitNoRanges.finalScore, 8);
  });

  it("supports percentile helper directly", () => {
    expect(percentile([1, 2, 100], 0.5)).toBe(2);
    expect(percentile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 8);
  });

  it("buildOpportunityScanContext can operate on precomputed metrics", () => {
    const context = buildOpportunityScanContext([
      flipResultMetrics(makeFlip({ ExpectedProfit: 10_000_000 })),
      flipResultMetrics(makeFlip({ ExpectedProfit: 20_000_000 })),
    ]);
    expect(context.ranges.expectedProfit).toBeTruthy();
  });
});
