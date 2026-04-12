import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { computeLoopOpportunities } from "@/lib/loopPlanner";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Test Item",
    Volume: 10,
    BuyPrice: 100,
    BuyStation: "Buy",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyRegionID: 100,
    SellPrice: 130,
    SellStation: "Sell",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    SellRegionID: 200,
    ProfitPerUnit: 30,
    MarginPercent: 30,
    UnitsToBuy: 100,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 3_000_000,
    ProfitPerJump: 300_000,
    BuyJumps: 1,
    SellJumps: 8,
    TotalJumps: 9,
    DailyVolume: 100,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 3_000_000,
    ...overrides,
  };
}

describe("computeLoopOpportunities", () => {
  it("builds anchored pairwise loops with deterministic metrics", () => {
    const outbound = makeRow({
      TypeName: "Tritanium",
      BuySystemName: "Jita",
      BuySystemID: 1,
      SellSystemName: "Amarr",
      SellSystemID: 2,
      SellRegionID: 200,
      TotalProfit: 4_000_000,
      SellJumps: 8,
      TotalJumps: 9,
    });
    const inbound = makeRow({
      TypeName: "Pyerite",
      BuySystemName: "Amarr",
      BuySystemID: 2,
      BuyRegionID: 200,
      SellSystemName: "Jita",
      SellSystemID: 1,
      TotalProfit: 2_500_000,
      BuyJumps: 9,
      SellJumps: 1,
      TotalJumps: 10,
    });

    const loops = computeLoopOpportunities([outbound, inbound], {
      homeSystemId: 1,
      homeSystemName: "Jita",
      maxDetourJumps: 0,
      cargoCapacityM3: 2_000,
      minLegProfit: 1_000_000,
      minTotalLoopProfit: 4_000_000,
    });

    expect(loops).toHaveLength(1);
    expect(loops[0]).toMatchObject({
      outboundProfit: 4_000_000,
      returnProfit: 2_500_000,
      totalLoopProfit: 6_500_000,
      totalLoopJumps: 19,
      detourJumps: 0,
      emptyJumpsAvoided: 17,
    });
    expect(loops[0].deadheadRatio).toBe(0);
    expect(loops[0].loopEfficiencyScore).toBeGreaterThan(0);
  });

  it("enforces detour, cargo, and per-leg profit constraints", () => {
    const outbound = makeRow({
      BuySystemID: 1,
      SellSystemID: 20,
      SellSystemName: "Destination",
      SellRegionID: 700,
      UnitsToBuy: 500,
      Volume: 10,
      TotalProfit: 3_000_000,
    });
    const returnLeg = makeRow({
      BuySystemID: 22,
      BuySystemName: "Nearby",
      BuyRegionID: 700,
      SellSystemID: 1,
      SellSystemName: "Jita",
      TotalProfit: 900_000,
    });

    const blocked = computeLoopOpportunities([outbound, returnLeg], {
      homeSystemId: 1,
      maxDetourJumps: 0,
      cargoCapacityM3: 3_000,
      minLegProfit: 1_000_000,
      minTotalLoopProfit: 2_000_000,
    });

    expect(blocked).toHaveLength(0);

    const allowed = computeLoopOpportunities([outbound, returnLeg], {
      homeSystemId: 1,
      maxDetourJumps: 1,
      cargoCapacityM3: 6_000,
      minLegProfit: 800_000,
      minTotalLoopProfit: 3_000_000,
    });

    expect(allowed).toHaveLength(1);
    expect(allowed[0].detourJumps).toBe(1);
  });

  it("sorts deterministically by profit, efficiency, jumps, then id", () => {
    const rows: FlipResult[] = [
      makeRow({ TypeName: "A", BuySystemID: 1, SellSystemID: 2, TotalProfit: 2_000_000 }),
      makeRow({ TypeName: "B", BuySystemID: 2, SellSystemID: 1, TotalProfit: 2_000_000 }),
      makeRow({ TypeName: "C", BuySystemID: 1, SellSystemID: 3, SellRegionID: 300, TotalProfit: 3_000_000 }),
      makeRow({ TypeName: "D", BuySystemID: 3, BuyRegionID: 300, SellSystemID: 1, TotalProfit: 1_000_000 }),
    ];

    const loops = computeLoopOpportunities(rows, {
      homeSystemId: 1,
      maxDetourJumps: 1,
      minLegProfit: 500_000,
      minTotalLoopProfit: 1_000_000,
      maxResults: 10,
    });

    expect(loops.slice(0, 2).map((loop) => loop.id)).toEqual(["0:1:0", "2:3:0"]);
  });
});
