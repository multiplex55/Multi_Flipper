import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { removeOffendersAndRefill } from "@/lib/routeVerificationRefill";

function row(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 34,
    TypeName: "Tritanium",
    Volume: 1,
    BuyPrice: 10,
    SellPrice: 13,
    ProfitPerUnit: 3,
    MarginPercent: 30,
    UnitsToBuy: 10,
    BuySystemID: 1,
    SellSystemID: 2,
    BuyStation: "Buy",
    SellStation: "Sell",
    BuySystemName: "Buy",
    SellSystemName: "Sell",
    BuyLocationID: 11,
    SellLocationID: 22,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 30,
    ProfitPerJump: 30,
    BuyJumps: 1,
    SellJumps: 1,
    TotalJumps: 2,
    DailyVolume: 100,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 1000,
    FilledQty: 10,
    ...overrides,
  };
}

describe("removeOffendersAndRefill", () => {
  it("removes offenders from selection", () => {
    const rows = [
      row({ TypeID: 1 }),
      row({ TypeID: 2, BuyLocationID: 12 }),
    ];
    const result = removeOffendersAndRefill({
      rows,
      selectedLineKeys: ["1:11:22", "2:12:22"],
      offenderLineKeys: ["2:12:22"],
      cargoCapacityM3: 100,
      maxCapitalIsk: 10_000,
      maxNewLines: 0,
    });
    expect(result.selectedLineKeys).toEqual(["1:11:22"]);
    expect(result.removedLineKeys).toEqual(["2:12:22"]);
  });

  it("does not reintroduce offender keys while refilling", () => {
    const rows = [
      row({ TypeID: 1, BuyLocationID: 11, SellLocationID: 22, ProfitPerUnit: 1 }),
      row({ TypeID: 2, BuyLocationID: 11, SellLocationID: 22, ProfitPerUnit: 12 }),
      row({ TypeID: 3, BuyLocationID: 11, SellLocationID: 22, ProfitPerUnit: 9 }),
    ];
    const result = removeOffendersAndRefill({
      rows,
      selectedLineKeys: ["1:11:22", "2:11:22"],
      offenderLineKeys: ["2:11:22"],
      cargoCapacityM3: 100,
      maxCapitalIsk: 10_000,
      maxNewLines: 2,
      minConfidencePercent: 0,
      minExecutionQuality: 0,
    });
    expect(result.selectedLineKeys).toContain("3:11:22");
    expect(result.selectedLineKeys).not.toContain("2:11:22");
  });
});
