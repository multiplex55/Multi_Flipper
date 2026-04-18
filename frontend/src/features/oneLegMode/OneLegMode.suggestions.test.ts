import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { buildOneLegSuggestions, sameLegKey } from "@/features/oneLegMode/oneLegMode";

function row(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "A",
    BuySystemName: "A",
    BuySystemID: 10,
    BuyLocationID: 100,
    SellPrice: 130,
    SellStation: "B",
    SellSystemName: "B",
    SellSystemID: 20,
    SellLocationID: 200,
    ProfitPerUnit: 30,
    MarginPercent: 30,
    UnitsToBuy: 10,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 300,
    ProfitPerJump: 100,
    BuyJumps: 0,
    SellJumps: 2,
    TotalJumps: 2,
    DailyVolume: 50,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 120,
    ...overrides,
  };
}

describe("OneLegMode suggestions", () => {
  it("returns same-endpoint and next-best candidates ranked around anchor", () => {
    const anchor = row({ TypeID: 1001, TypeName: "Anchor", MarginPercent: 20, TotalJumps: 4 });
    const betterSameOrigin = row({ TypeID: 1002, TypeName: "Origin Better", BuyLocationID: 100, SellLocationID: 250, MarginPercent: 50, TotalJumps: 1 });
    const sameDestination = row({ TypeID: 1003, TypeName: "Dest", BuyLocationID: 120, SellLocationID: 200, MarginPercent: 35, TotalJumps: 2 });
    const sameLeg = row({ TypeID: 1004, TypeName: "Same Leg", BuyLocationID: 100, SellLocationID: 200, MarginPercent: 40, TotalJumps: 2 });
    const unrelated = row({ TypeID: 1005, TypeName: "Other", BuyLocationID: 999, SellLocationID: 998 });

    const suggestions = buildOneLegSuggestions({
      rows: [anchor, betterSameOrigin, sameDestination, sameLeg, unrelated],
      anchor,
      cargoLimit: 150,
      limit: 4,
    });

    expect(sameLegKey(anchor)).toBe(sameLegKey(sameLeg));
    expect(suggestions.sameLeg.map((entry) => entry.row.TypeID)).toEqual([1004]);
    expect(suggestions.sameOriginOrDestination.map((entry) => entry.row.TypeID)).toEqual(
      expect.arrayContaining([1002, 1003, 1004]),
    );
    expect(suggestions.nextBestTrade[0].row.TypeID).toBe(1002);
    expect(suggestions.nextBestTrade.some((entry) => entry.row.TypeID === 1005)).toBe(false);
  });
});
