import { describe, expect, it } from "vitest";
import type { RouteResult } from "@/lib/types";
import { evaluateRoutePlanValidation } from "@/lib/routePlanValidation";

function route(
  overrides: Partial<RouteResult["Hops"][number]> = {},
): RouteResult {
  return {
    Hops: [
      {
        SystemName: "Jita",
        StationName: "Jita",
        SystemID: 30000142,
        DestSystemName: "Amarr",
        DestSystemID: 30002187,
        TypeName: "Tritanium",
        TypeID: 34,
        BuyPrice: 10,
        SellPrice: 13,
        Units: 100,
        Profit: 300,
        Jumps: 9,
        modeled_qty: 100,
        buy_remaining: 100,
        sell_remaining: 100,
        effective_buy: 10,
        effective_sell: 13,
        ...overrides,
      },
    ],
    TotalProfit: 300,
    TotalJumps: 9,
    ProfitPerJump: 33,
    HopCount: 1,
  };
}

const thresholds = {
  max_buy_drift_pct: 5,
  max_sell_drift_pct: 5,
  min_route_profit_retained_pct: 80,
  min_stop_liquidity_retained_pct: 70,
};

describe("evaluateRoutePlanValidation", () => {
  it("returns green at threshold boundaries", () => {
    const result = evaluateRoutePlanValidation({
      route: route({
        effective_buy: 10.5,
        effective_sell: 12.9,
        buy_remaining: 70,
        sell_remaining: 70,
      }),
      thresholds,
      nowMs: Date.parse("2026-04-05T12:00:00Z"),
    });
    expect(result.band).toBe("green");
  });

  it("returns yellow inside degraded band", () => {
    const result = evaluateRoutePlanValidation({
      route: route({ effective_buy: 10.6 }),
      thresholds,
      nowMs: Date.parse("2026-04-05T12:00:00Z"),
    });
    expect(result.band).toBe("yellow");
  });

  it("returns red for hard threshold breach", () => {
    const result = evaluateRoutePlanValidation({
      route: route({ effective_buy: 10.7 }),
      thresholds,
      nowMs: Date.parse("2026-04-05T12:00:00Z"),
    });
    expect(result.band).toBe("red");
  });
});
