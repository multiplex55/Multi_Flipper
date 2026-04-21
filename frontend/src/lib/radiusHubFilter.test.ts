import { describe, expect, it } from "vitest";
import { filterRadiusResultsByHub, type RadiusHubFilter } from "@/lib/radiusHubFilter";
import type { FlipResult } from "@/lib/types";

const rows: FlipResult[] = [
  {
    TypeID: 34,
    TypeName: "Tritanium",
    Volume: 0.01,
    BuyPrice: 5,
    BuyStation: "Jita 4-4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 6,
    SellStation: "Amarr VIII",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 1,
    MarginPercent: 10,
    UnitsToBuy: 100,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 100,
    ProfitPerJump: 20,
    BuyJumps: 1,
    SellJumps: 3,
    TotalJumps: 4,
    DailyVolume: 100,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 100,
  },
  {
    TypeID: 35,
    TypeName: "Pyerite",
    Volume: 0.01,
    BuyPrice: 7,
    BuyStation: "Perimeter",
    BuySystemName: "Perimeter",
    BuySystemID: 30000144,
    SellPrice: 11,
    SellStation: "Jita 4-4",
    SellSystemName: "Jita",
    SellSystemID: 30000142,
    ProfitPerUnit: 4,
    MarginPercent: 20,
    UnitsToBuy: 100,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 400,
    ProfitPerJump: 40,
    BuyJumps: 1,
    SellJumps: 3,
    TotalJumps: 4,
    DailyVolume: 100,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 400,
  },
];

describe("filterRadiusResultsByHub", () => {
  it("returns all rows when filter is null", () => {
    expect(filterRadiusResultsByHub(rows, null)).toEqual(rows);
  });

  it("filters by buy system id when side is buy", () => {
    const filter: RadiusHubFilter = { side: "buy", systemId: 30000142 };
    expect(filterRadiusResultsByHub(rows, filter)).toEqual([rows[0]]);
  });

  it("filters by sell system id when side is sell", () => {
    const filter: RadiusHubFilter = { side: "sell", systemId: 30000142 };
    expect(filterRadiusResultsByHub(rows, filter)).toEqual([rows[1]]);
  });

  it("returns all rows for empty or invalid system ids", () => {
    expect(filterRadiusResultsByHub(rows, { side: "buy", systemId: null })).toEqual(rows);
    expect(filterRadiusResultsByHub(rows, { side: "sell", systemId: 0 })).toEqual(rows);
  });
});
