import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { applyDistanceLensToRow } from "./radiusDistanceLens";

const baseRow: FlipResult = {
  TypeID: 34,
  TypeName: "Tritanium",
  Volume: 1,
  BuyPrice: 4,
  BuyStation: "Jita",
  BuySystemName: "Jita",
  BuySystemID: 30000142,
  SellPrice: 5,
  SellStation: "Amarr",
  SellSystemName: "Amarr",
  SellSystemID: 30002187,
  ProfitPerUnit: 1,
  MarginPercent: 20,
  UnitsToBuy: 100,
  BuyOrderRemain: 100,
  SellOrderRemain: 100,
  TotalProfit: 100,
  ProfitPerJump: 50,
  BuyJumps: 1,
  SellJumps: 1,
  TotalJumps: 2,
  DailyVolume: 50,
  Velocity: 1,
  PriceTrend: 0,
  BuyCompetitors: 0,
  SellCompetitors: 0,
  DailyProfit: 80,
  RealProfit: 90,
};

describe("applyDistanceLensToRow", () => {
  it("applies distance overrides and preserves base values", () => {
    const row = applyDistanceLensToRow(baseRow, {
      row_key: "34:30000142:30002187",
      buy_jumps: 3,
      sell_jumps: 4,
      total_jumps: 7,
      profit_per_jump: 14,
      real_isk_per_jump: 12,
      daily_isk_per_jump: 11,
      unreachable: false,
    });
    expect(row.BuyJumps).toBe(3);
    expect(row.TotalJumps).toBe(7);
    expect(row.DistanceLensBaseTotalJumps).toBe(2);
    expect(row.DistanceLensApplied).toBe(true);
  });

  it("does not mutate source row", () => {
    const source = { ...baseRow };
    const result = applyDistanceLensToRow(source, undefined);
    expect(result).not.toBe(source);
    expect(source.BuyJumps).toBe(1);
  });
});
