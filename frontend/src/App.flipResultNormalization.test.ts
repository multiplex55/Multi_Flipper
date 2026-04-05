import { describe, expect, it } from "vitest";
import { normalizeFlipResultLike } from "@/App";

describe("normalizeFlipResultLike", () => {
  it("hydrates execution and target fields from snake_case payloads", () => {
    const row = normalizeFlipResultLike({
      type_id: 34,
      type_name: "Tritanium",
      buy_price: 5.5,
      buy_station: "Jita",
      buy_system_name: "Jita",
      buy_system_id: 30000142,
      sell_price: 6.1,
      sell_station: "Perimeter",
      sell_system_name: "Perimeter",
      sell_system_id: 30000144,
      profit_per_unit: 0.6,
      margin_percent: 10,
      units_to_buy: 100,
      buy_order_remain: 1000,
      sell_order_remain: 900,
      total_profit: 60,
      profit_per_jump: 60,
      buy_jumps: 0,
      sell_jumps: 1,
      total_jumps: 1,
      daily_volume: 5000,
      velocity: 1.2,
      price_trend: 0.4,
      buy_competitors: 3,
      sell_competitors: 4,
      daily_profit: 20,
      target_sell_supply: 250,
      target_lowest_sell: 6.2,
      pre_execution_units: 130,
      filled_qty: 97,
      can_fill: 0,
    });

    expect(row).not.toBeNull();
    expect(row?.TargetSellSupply).toBe(250);
    expect(row?.TargetLowestSell).toBe(6.2);
    expect(row?.PreExecutionUnits).toBe(130);
    expect(row?.FilledQty).toBe(97);
    expect(row?.CanFill).toBe(false);
  });

  it("accepts mixed payload keys and ignores missing optional fields", () => {
    const row = normalizeFlipResultLike({
      TypeID: 587,
      type_name: "Rifter",
      BuyPrice: 350_000,
      BuyStation: "Hek",
      BuySystemName: "Hek",
      BuySystemID: 30002053,
      SellPrice: 390_000,
      SellStation: "Rens",
      SellSystemName: "Rens",
      SellSystemID: 30002510,
      ProfitPerUnit: 40_000,
      MarginPercent: 8.5,
      UnitsToBuy: 12,
      BuyOrderRemain: 99,
      SellOrderRemain: 120,
      TotalProfit: 480_000,
      ProfitPerJump: 160_000,
      BuyJumps: 0,
      SellJumps: 3,
      TotalJumps: 3,
      DailyVolume: 600,
      Velocity: 0,
      PriceTrend: 0,
      BuyCompetitors: 0,
      SellCompetitors: 0,
      DailyProfit: 100_000,
      RequestedQty: 12,
    });

    expect(row).not.toBeNull();
    expect(row?.PreExecutionUnits).toBe(12);
    expect(row?.TargetSellSupply).toBeUndefined();
    expect(row?.TargetLowestSell).toBeUndefined();
  });

  it("returns null when payload does not include a valid type id", () => {
    expect(normalizeFlipResultLike({ type_name: "Invalid" })).toBeNull();
  });
});
