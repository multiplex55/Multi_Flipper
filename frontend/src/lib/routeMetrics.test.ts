import { describe, expect, it } from "vitest";
import { computeHopMetrics, computeRouteMetrics } from "@/lib/routeMetrics";
import type { RouteResult } from "@/lib/types";

function fixtureRoute(): RouteResult {
  return {
    Hops: [
      {
        SystemName: "Jita",
        StationName: "4-4",
        SystemID: 1,
        DestSystemName: "Perimeter",
        DestSystemID: 2,
        TypeName: "Tritanium",
        TypeID: 34,
        BuyPrice: 10,
        SellPrice: 12,
        Units: 100,
        Profit: 0,
        Jumps: 2,
        Items: [
          { TypeID: 34, TypeName: "Tritanium", Units: 100, BuyPrice: 10, SellPrice: 12, Fees: 40, Taxes: 10, Profit: 0 },
          { TypeID: 35, TypeName: "Pyerite", Units: 50, BuyPrice: 20, SellPrice: 23, TransactionCosts: 15, Profit: 0 },
        ],
      },
      {
        SystemName: "Perimeter",
        StationName: "Tranquility",
        SystemID: 2,
        DestSystemName: "Amarr",
        DestSystemID: 3,
        TypeName: "Mexallon",
        TypeID: 36,
        BuyPrice: 200,
        SellPrice: 180,
        Units: 5,
        Profit: 0,
        Jumps: 3,
        EmptyJumps: 1,
        Items: [
          { TypeID: 36, TypeName: "Mexallon", Units: 5, BuyPrice: 200, SellPrice: 180, Fees: 5, Profit: 0 },
        ],
      },
    ],
    TotalProfit: 0,
    TotalJumps: 6,
    ProfitPerJump: 0,
    HopCount: 2,
  };
}

describe("routeMetrics", () => {
  it("computes canonical real profit, isk/jump, margin, and break-even", () => {
    const route = fixtureRoute();
    const metrics = computeRouteMetrics(route);

    // Hop1: (1200 + 1150) - (1000 + 1000) - (40+10+15) = 285
    // Hop2: 900 - 1000 - 5 = -105
    expect(metrics.totalRealProfit).toBe(180);
    expect(metrics.totalJumps).toBe(6);
    expect(metrics.iskPerJump).toBe(30);
    expect(metrics.averageIskPerJump).toBeCloseTo((285 / 2 + (-105 / 4)) / 2, 6);
    expect(metrics.profitMarginPercent).toBeCloseTo(6, 6);
    expect(metrics.profitVolatilityRange).toBe(390);
    expect(metrics.breakEvenJumps).toBeCloseTo(3000 / 30, 6);
  });

  it("handles edge cases: zero jumps, zero buy cost, negative profits, missing fee data", () => {
    const route: RouteResult = {
      Hops: [
        {
          SystemName: "A",
          StationName: "A",
          SystemID: 1,
          DestSystemName: "B",
          DestSystemID: 2,
          TypeName: "Gift",
          TypeID: 1,
          BuyPrice: 0,
          SellPrice: 5,
          Units: 10,
          Profit: 0,
          Jumps: 0,
          Items: [{ TypeID: 1, TypeName: "Gift", Units: 10, BuyPrice: 0, SellPrice: 5, Profit: 0 }],
        },
      ],
      TotalProfit: 0,
      TotalJumps: 0,
      ProfitPerJump: 0,
      HopCount: 1,
    };

    const metrics = computeRouteMetrics(route);
    expect(metrics.iskPerJump).toBe(0);
    expect(metrics.profitMarginPercent).toBe(0);
    expect(metrics.breakEvenJumps).toBeNull();
    expect(metrics.totalAttributableCosts).toBe(0);
  });

  it("uses high precision in computation (rounding deferred to display)", () => {
    const hop = computeHopMetrics({
      SystemName: "A",
      StationName: "A",
      SystemID: 1,
      DestSystemName: "B",
      DestSystemID: 2,
      TypeName: "Precise",
      TypeID: 9,
      BuyPrice: 1.111111,
      SellPrice: 1.999999,
      Units: 3,
      Profit: 0,
      Jumps: 3,
      Items: [{ TypeID: 9, TypeName: "Precise", Units: 3, BuyPrice: 1.111111, SellPrice: 1.999999, AttributableCosts: 0.000333, Profit: 0 }],
    });

    expect(hop.realProfit).toBeCloseTo(2.666331, 9);
    expect(hop.iskPerJump).toBeCloseTo(0.888777, 9);
  });
});
