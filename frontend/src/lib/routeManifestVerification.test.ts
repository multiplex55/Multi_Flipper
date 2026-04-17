import { describe, expect, it } from "vitest";
import type { FlipResult, RouteManifestVerificationSnapshot } from "@/lib/types";
import { verifyRouteManifestAgainstRows } from "@/lib/routeManifestVerification";

function makeRow(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Buy",
    BuySystemName: "BuySys",
    BuySystemID: 1,
    BuyLocationID: 11,
    SellPrice: 150,
    SellStation: "Sell",
    SellSystemName: "SellSys",
    SellSystemID: 2,
    SellLocationID: 22,
    ProfitPerUnit: 50,
    MarginPercent: 50,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 500,
    ProfitPerJump: 100,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 0,
    DailyVolume: 10,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 500,
    ...overrides,
  };
}

const snapshot: RouteManifestVerificationSnapshot = {
  expected_buy_isk: 1000,
  expected_sell_isk: 1500,
  expected_profit_isk: 500,
  min_acceptable_profit_isk: 350,
  max_buy_drift_pct: 5,
  max_sell_drift_pct: 5,
  lines: [
    {
      line_ref: "1:11:22",
      type_id: 1,
      type_name: "Item A",
      buy_system_id: 1,
      buy_location_id: 11,
      sell_system_id: 2,
      sell_location_id: 22,
      expected_buy_isk: 1000,
      expected_sell_isk: 1500,
      expected_profit_isk: 500,
    },
  ],
};

describe("verifyRouteManifestAgainstRows", () => {
  it("classifies good/reduced/abort threshold scenarios", () => {
    const good = verifyRouteManifestAgainstRows({
      snapshot,
      rows: [makeRow({ UnitsToBuy: 10, BuyPrice: 100, SellPrice: 150 })],
    });
    expect(good.status).toBe("Good");

    const reduced = verifyRouteManifestAgainstRows({
      snapshot,
      rows: [makeRow({ UnitsToBuy: 10, BuyPrice: 102, SellPrice: 140 })],
    });
    expect(reduced.status).toBe("Reduced edge");

    const abort = verifyRouteManifestAgainstRows({
      snapshot,
      rows: [makeRow({ UnitsToBuy: 10, BuyPrice: 120, SellPrice: 130 })],
    });
    expect(abort.status).toBe("Abort");
  });

  it("reports per-line offenders with item ids and drift direction", () => {
    const result = verifyRouteManifestAgainstRows({
      snapshot: {
        ...snapshot,
        lines: [
          ...snapshot.lines,
          {
            line_ref: "2:12:23",
            type_id: 2,
            type_name: "Item B",
            buy_system_id: 1,
            buy_location_id: 12,
            sell_system_id: 2,
            sell_location_id: 23,
            expected_buy_isk: 2000,
            expected_sell_isk: 3000,
            expected_profit_isk: 1000,
          },
        ],
      },
      rows: [
        makeRow({ TypeID: 1, BuyLocationID: 11, SellLocationID: 22, UnitsToBuy: 10, BuyPrice: 110, SellPrice: 150 }),
        makeRow({ TypeID: 2, BuyLocationID: 12, SellLocationID: 23, UnitsToBuy: 10, BuyPrice: 200, SellPrice: 280 }),
      ],
    });
    expect(result.offenders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type_id: 1, direction: "buy_up" }),
        expect.objectContaining({ type_id: 2, direction: "sell_down" }),
      ]),
    );
  });
});

