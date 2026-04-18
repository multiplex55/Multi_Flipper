import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { getExactLegKey, getSameLegRows, rankSameLegRows } from "@/lib/sameLegSuggestions";

function makeRow(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyLocationID: 60003760,
    SellPrice: 120,
    SellStation: "Amarr VIII",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    SellLocationID: 60008494,
    ProfitPerUnit: 20,
    MarginPercent: 20,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 200,
    ProfitPerJump: 20,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 4,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 100,
    RealProfit: 200,
    FilledQty: 9,
    SlippageBuyPct: 1,
    SlippageSellPct: 1,
    ...overrides,
  };
}

describe("sameLegSuggestions", () => {
  it("uses location IDs when present and falls back to normalized names when missing", () => {
    const withIds = makeRow({});
    const withoutIds = makeRow({
      BuyLocationID: 0,
      SellLocationID: 0,
      BuyStation: "  Jita  IV - Moon 4 ",
      SellStation: "Amarr   VIII",
    });

    expect(getExactLegKey(withIds)).toContain("buy_loc:60003760");
    expect(getExactLegKey(withoutIds)).toContain("buy_name:jita|jita iv - moon 4");
    expect(getExactLegKey(withoutIds)).toContain("sell_name:amarr|amarr viii");
  });

  it("returns only exact-leg rows", () => {
    const anchor = makeRow({ TypeID: 11 });
    const sameLeg = makeRow({ TypeID: 12 });
    const differentSell = makeRow({ TypeID: 13, SellLocationID: 60008495 });

    const output = getSameLegRows(anchor, [anchor, sameLeg, differentSell]);

    expect(output.map((row) => row.TypeID)).toEqual([11, 12]);
  });

  it("ranks by real profit, isk-per-jump, fillable qty, then lower risk proxies", () => {
    const highProfit = makeRow({ TypeID: 21, TypeName: "High", RealProfit: 500, TotalJumps: 8 });
    const betterIpk = makeRow({ TypeID: 22, TypeName: "Ipk", RealProfit: 400, TotalJumps: 2 });
    const moreFillable = makeRow({
      TypeID: 23,
      TypeName: "Fill",
      RealProfit: 400,
      TotalJumps: 2,
      UnitsToBuy: 20,
      BuyOrderRemain: 20,
      SellOrderRemain: 20,
      FilledQty: 19,
      SlippageBuyPct: 1,
      SlippageSellPct: 1,
    });
    const lowerRisk = makeRow({
      TypeID: 24,
      TypeName: "Risk",
      RealProfit: 400,
      TotalJumps: 2,
      UnitsToBuy: 20,
      BuyOrderRemain: 20,
      SellOrderRemain: 20,
      FilledQty: 20,
      SlippageBuyPct: 0.1,
      SlippageSellPct: 0.1,
    });

    const ranked = rankSameLegRows([betterIpk, highProfit, moreFillable, lowerRisk]);

    expect(ranked.map((row) => row.TypeID)).toEqual([21, 24, 23, 22]);
  });
});
