import { describe, expect, it } from "vitest";
import { buildRadiusHubSummaries } from "@/lib/radiusHubSummaries";
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
    BuyLocationID: 60003760,
    SellPrice: 6,
    SellStation: "Amarr VIII",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    SellLocationID: 60008494,
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
    BuyPrice: 10,
    BuyStation: "Jita 4-4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyLocationID: 60003760,
    SellPrice: 13,
    SellStation: "Dodixie IX",
    SellSystemName: "Dodixie",
    SellSystemID: 30002659,
    SellLocationID: 60011866,
    ProfitPerUnit: 3,
    MarginPercent: 30,
    UnitsToBuy: 50,
    BuyOrderRemain: 50,
    SellOrderRemain: 50,
    TotalProfit: 150,
    ProfitPerJump: 30,
    BuyJumps: 2,
    SellJumps: 4,
    TotalJumps: 6,
    DailyVolume: 100,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 150,
  },
];

describe("buildRadiusHubSummaries", () => {
  it("groups buy hubs by location and aggregates core metrics", () => {
    const { buyHubs } = buildRadiusHubSummaries(rows);
    expect(buyHubs).toHaveLength(1);
    expect(buyHubs[0].item_count).toBe(2);
    expect(buyHubs[0].capital_required).toBe(1_000);
    expect(buyHubs[0].period_profit).toBe(250);
    expect(buyHubs[0].avg_jumps).toBeCloseTo((100 * 4 + 50 * 6) / 150, 6);
  });

  it("builds independent sell hub groups", () => {
    const { sellHubs } = buildRadiusHubSummaries(rows);
    expect(sellHubs).toHaveLength(2);
    expect(sellHubs[0].period_profit).toBeGreaterThanOrEqual(sellHubs[1].period_profit);
    expect(sellHubs.map((row) => row.system_name)).toContain("Amarr");
    expect(sellHubs.map((row) => row.system_name)).toContain("Dodixie");
  });
});
