import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { isRadiusTradeExecutableNow } from "@/lib/radiusExecutableNow";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Test Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "A",
    BuySystemName: "A",
    BuySystemID: 10,
    SellPrice: 120,
    SellStation: "B",
    SellSystemName: "B",
    SellSystemID: 20,
    ProfitPerUnit: 20,
    MarginPercent: 20,
    UnitsToBuy: 100,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 2_000,
    ProfitPerJump: 1_000,
    BuyJumps: 0,
    SellJumps: 1,
    TotalJumps: 1,
    DailyVolume: 500,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 1_000,
    RealProfit: 2_000,
    ExpectedProfit: 2_000,
    PreExecutionUnits: 100,
    FilledQty: 90,
    CanFill: true,
    SlippageBuyPct: 0.5,
    SlippageSellPct: 0.5,
    ExpectedSellPrice: 120,
    HistoryAvailable: true,
    ...overrides,
  };
}

describe("isRadiusTradeExecutableNow", () => {
  it("returns true for rows that satisfy default thresholds", () => {
    expect(isRadiusTradeExecutableNow({ row: makeRow() })).toBe(true);
  });

  it("excludes queued or assigned routes", () => {
    const row = makeRow();
    expect(
      isRadiusTradeExecutableNow({ row, routeStatus: "queued" }),
    ).toBe(false);
    expect(
      isRadiusTradeExecutableNow({ row, routeStatus: "idle", assignedPilotName: "Pilot" }),
    ).toBe(false);
  });

  it("excludes verification abort routes", () => {
    expect(
      isRadiusTradeExecutableNow({
        row: makeRow(),
        verificationState: "abort",
      }),
    ).toBe(false);
  });

  it("supports threshold tuning via overrides", () => {
    const row = makeRow({ RealProfit: 50, ExpectedProfit: 50 });
    expect(isRadiusTradeExecutableNow({ row }, { minProfit: 100 })).toBe(false);
    expect(
      isRadiusTradeExecutableNow({ row }, { minProfit: 25, minBreakevenBufferPct: 0.4 }),
    ).toBe(true);
  });
});
