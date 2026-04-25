import { describe, expect, it } from "vitest";
import type { AuthCharacter, FlipResult } from "@/lib/types";
import type { RadiusHubSummary } from "@/lib/radiusHubSummaries";
import { buildRadiusStagingRecommendations } from "@/lib/radiusStagingAdvisor";

const characters: AuthCharacter[] = [
  { character_id: 7, character_name: "Alpha", active: true },
  { character_id: 8, character_name: "Beta", active: false },
];

const rows: FlipResult[] = [
  {
    TypeID: 1,
    TypeName: "Tritanium",
    Volume: 1,
    BuyPrice: 1,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 2,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 1,
    MarginPercent: 5,
    UnitsToBuy: 1,
    BuyOrderRemain: 1,
    SellOrderRemain: 1,
    TotalProfit: 1,
    ProfitPerJump: 1,
    BuyJumps: 1,
    SellJumps: 2,
    TotalJumps: 3,
    DailyVolume: 1,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 1,
  },
  {
    TypeID: 2,
    TypeName: "Pyerite",
    Volume: 1,
    BuyPrice: 1,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 2,
    SellStation: "Dodixie",
    SellSystemName: "Dodixie",
    SellSystemID: 30002659,
    ProfitPerUnit: 1,
    MarginPercent: 5,
    UnitsToBuy: 1,
    BuyOrderRemain: 1,
    SellOrderRemain: 1,
    TotalProfit: 1,
    ProfitPerJump: 1,
    BuyJumps: 2,
    SellJumps: 6,
    TotalJumps: 8,
    DailyVolume: 1,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 1,
  },
];

const buyHubs: RadiusHubSummary[] = [
  {
    location_id: 1,
    station_name: "Jita 4-4",
    system_id: 30000142,
    system_name: "Jita",
    row_count: 2,
    item_count: 2,
    units: 50,
    capital_required: 100,
    period_profit: 800_000,
    avg_jumps: 2,
  },
  {
    location_id: 2,
    station_name: "Rens",
    system_id: 30002510,
    system_name: "Rens",
    row_count: 1,
    item_count: 1,
    units: 25,
    capital_required: 90,
    period_profit: 300_000,
    avg_jumps: 8,
  },
];

const sellHubs: RadiusHubSummary[] = [
  {
    location_id: 3,
    station_name: "Amarr",
    system_id: 30002187,
    system_name: "Amarr",
    row_count: 1,
    item_count: 1,
    units: 25,
    capital_required: 100,
    period_profit: 400_000,
    avg_jumps: 2,
  },
];

describe("buildRadiusStagingRecommendations", () => {
  it("ranks recommendations deterministically and includes reason text", () => {
    const recommendations = buildRadiusStagingRecommendations({
      rows,
      buyHubs,
      sellHubs,
      characters,
      fallbackSystemName: "Perimeter",
    });

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0].recommendedSystemName).toBe("Jita");
    expect(recommendations[0].reason).toContain("matching row(s)");
    expect(recommendations[0].reason).toContain("avg jump(s)");
    expect(recommendations[1].recommendedSystemName).toBe("Jita");
  });
});
