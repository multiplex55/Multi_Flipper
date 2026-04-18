import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { buildOneLegFillers, sameLegKey } from "@/features/oneLegMode/oneLegMode";

function row(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 2,
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
    FilledQty: 10,
    PreExecutionUnits: 10,
    HistoryAvailable: true,
    ...overrides,
  };
}

describe("OneLegMode fillers", () => {
  it("restricts filler candidates to the same leg as anchor", () => {
    const anchor = row({ TypeID: 2001, TypeName: "Anchor", UnitsToBuy: 10 });
    const sameLegA = row({ TypeID: 2002, TypeName: "SameLeg A", UnitsToBuy: 5 });
    const sameLegB = row({ TypeID: 2003, TypeName: "SameLeg B", UnitsToBuy: 4 });
    const otherLeg = row({ TypeID: 2004, TypeName: "Wrong leg", SellLocationID: 201, UnitsToBuy: 5 });

    const fillers = buildOneLegFillers({
      rows: [anchor, sameLegA, sameLegB, otherLeg],
      anchor,
      cargoLimit: 60,
    });

    expect(fillers.remainingCapacityM3).toBe(40);
    expect(fillers.candidates.length).toBeGreaterThan(0);
    for (const candidate of fillers.candidates) {
      expect(sameLegKey(candidate.row)).toBe(sameLegKey(anchor));
      expect(candidate.row.TypeID).not.toBe(2004);
    }
  });
});
