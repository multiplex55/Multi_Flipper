import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import {
  breakevenBuffer,
  breakevenBufferForFlip,
  computeExecutionQuality,
  executionQualityForFlip,
  exitOverhangDays,
  hasDestinationPriceSpike,
  requestedUnitsForFlip,
} from "@/lib/executionQuality";

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
    UnitsToBuy: 10000,
    BuyOrderRemain: 14000,
    SellOrderRemain: 12000,
    TotalProfit: 120000,
    ProfitPerJump: 20000,
    BuyJumps: 1,
    SellJumps: 3,
    TotalJumps: 4,
    DailyVolume: 25000,
    Velocity: 40,
    PriceTrend: 1,
    BuyCompetitors: 2,
    SellCompetitors: 3,
    DailyProfit: 50000,
    FilledQty: 9000,
    SlippageBuyPct: 1,
    SlippageSellPct: 1,
    DayTargetPeriodPrice: 7,
    DayNowProfit: 100,
    DayPeriodProfit: 90,
    TargetSellSupply: 5000,
    S2BPerDay: 250,
    ExpectedProfit: 100000,
    ExpectedSellPrice: 7,
    ...overrides,
  };
}

describe("executionQuality", () => {
  it("computes table-driven quality matrix", () => {
    const matrix: Array<{
      name: string;
      row: FlipResult;
      expectMaxScore?: number;
      expectSpike?: boolean;
    }> = [
      {
        name: "thin liquidity",
        row: makeFlip({ BuyOrderRemain: 200, SellOrderRemain: 200, FilledQty: 2500 }),
        expectMaxScore: 60,
      },
      {
        name: "partial fills",
        row: makeFlip({ FilledQty: 3000 }),
        expectMaxScore: 80,
      },
      {
        name: "no history",
        row: makeFlip({ DayTargetPeriodPrice: 0, DayPriceHistory: [], HistoryAvailable: false }),
        expectMaxScore: 90,
      },
      {
        name: "high slippage",
        row: makeFlip({ SlippageBuyPct: 14, SlippageSellPct: 12 }),
        expectMaxScore: 80,
      },
      {
        name: "destination spike",
        row: makeFlip({ DayNowProfit: 200, DayPeriodProfit: -50 }),
        expectSpike: true,
      },
    ];

    for (const testCase of matrix) {
      const result = executionQualityForFlip(testCase.row);
      if (testCase.expectMaxScore != null) {
        expect(result.score, testCase.name).toBeLessThanOrEqual(testCase.expectMaxScore);
      }
      if (testCase.expectSpike) {
        expect(hasDestinationPriceSpike(testCase.row), testCase.name).toBe(true);
        expect(result.topPenalties.some((f) => f.factor === "spike" || f.factor === "slippage")).toBe(true);
      }
    }
  });

  it("exposes dominant positive and penalty factors", () => {
    const result = computeExecutionQuality({
      fillRatio: 0.95,
      slippageBurden: 0.5,
      topOfBookDepthCoverage: 0.25,
      hasHistory: false,
      destinationSpike: true,
      marketStable: false,
    });

    expect(result.topPositives[0].factor).toBe("fillRatio");
    expect(["spike", "history", "depthCoverage", "slippage"]).toContain(result.topPenalties[0].factor);
  });

  it("returns safe defaults when optional fields are absent", () => {
    const sparse = makeFlip({
      FilledQty: undefined,
      SlippageBuyPct: undefined,
      SlippageSellPct: undefined,
      DayTargetPeriodPrice: undefined,
      DayPriceHistory: undefined,
      HistoryAvailable: undefined,
      TargetSellSupply: undefined,
      S2BPerDay: undefined,
      ExpectedProfit: undefined,
      TotalProfit: 0,
      ExpectedSellPrice: undefined,
      SellPrice: 0,
      BuyOrderRemain: undefined as unknown as number,
      SellOrderRemain: undefined as unknown as number,
    });

    const quality = executionQualityForFlip(sparse);
    expect(quality.score).toBeGreaterThanOrEqual(0);
    expect(quality.score).toBeLessThanOrEqual(100);
    expect(exitOverhangDays(sparse.TargetSellSupply, sparse.S2BPerDay)).toBe(0);
    expect(breakevenBufferForFlip(sparse)).toBe(0);
    expect(breakevenBuffer(undefined, undefined)).toBe(0);
  });

  it("uses pre-execution requested units when scoring execution sufficiency ratios", () => {
    const result = executionQualityForFlip(
      makeFlip({
        PreExecutionUnits: 100,
        UnitsToBuy: 60,
        FilledQty: 60,
        BuyOrderRemain: 60,
        SellOrderRemain: 60,
        SlippageBuyPct: 0,
        SlippageSellPct: 0,
        DayTargetPeriodPrice: 7,
      }),
    );

    expect(requestedUnitsForFlip(makeFlip({ PreExecutionUnits: 100, UnitsToBuy: 60 }))).toBe(100);
    expect(result.factors.find((factor) => factor.factor === "fillRatio")?.score).toBe(60);
    expect(result.factors.find((factor) => factor.factor === "depthCoverage")?.score).toBe(60);
    expect(result.score).toBeLessThan(100);
  });

  it("falls back to UnitsToBuy when pre-execution units are missing", () => {
    const withMissingPreExecution = makeFlip({
      PreExecutionUnits: undefined,
      UnitsToBuy: 60,
      FilledQty: 30,
      BuyOrderRemain: 30,
      SellOrderRemain: 30,
    });

    expect(requestedUnitsForFlip(withMissingPreExecution)).toBe(60);
    const result = executionQualityForFlip(withMissingPreExecution);
    expect(result.factors.find((factor) => factor.factor === "fillRatio")?.score).toBe(50);
  });

  it("clamps oversubscribed fill against requested units", () => {
    const result = executionQualityForFlip(
      makeFlip({
        PreExecutionUnits: 50,
        UnitsToBuy: 10,
        FilledQty: 120,
        BuyOrderRemain: 200,
        SellOrderRemain: 200,
      }),
    );

    expect(result.factors.find((factor) => factor.factor === "fillRatio")?.score).toBe(100);
    expect(result.factors.find((factor) => factor.factor === "depthCoverage")?.score).toBe(100);
  });

  it("handles zero requested units without divide-by-zero", () => {
    const row = makeFlip({
      PreExecutionUnits: 0,
      UnitsToBuy: 0,
      FilledQty: 20,
      BuyOrderRemain: 100,
      SellOrderRemain: 100,
      CanFill: false,
    });
    const result = executionQualityForFlip(row);
    expect(requestedUnitsForFlip(row)).toBe(0);
    expect(result.factors.find((factor) => factor.factor === "fillRatio")?.score).toBe(0);
    expect(result.factors.find((factor) => factor.factor === "depthCoverage")?.score).toBe(0);
  });

  it("computes exit overhang safeguards", () => {
    expect(exitOverhangDays(1000, 100)).toBe(10);
    expect(exitOverhangDays(1000, 0)).toBe(Infinity);
    expect(exitOverhangDays(undefined, 100)).toBe(0);
  });
});
