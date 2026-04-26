import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { computeRadiusSessionSummary } from "@/lib/radiusSessionSummary";

function makeRow(typeId: number, buy: number, sell: number): FlipResult {
  return {
    TypeID: typeId,
    TypeName: `Item ${typeId}`,
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Buy",
    BuySystemName: "Buy",
    BuySystemID: buy,
    SellPrice: 130,
    SellStation: "Sell",
    SellSystemName: "Sell",
    SellSystemID: sell,
    ProfitPerUnit: 30,
    MarginPercent: 30,
    UnitsToBuy: 100,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 3_000,
    ProfitPerJump: 1_000,
    BuyJumps: 0,
    SellJumps: 1,
    TotalJumps: 1,
    DailyVolume: 1_000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 900,
    RealProfit: 3_000,
    ExpectedProfit: 3_000,
    PreExecutionUnits: 100,
    FilledQty: 85,
    CanFill: true,
    SlippageBuyPct: 1,
    SlippageSellPct: 1,
    ExpectedSellPrice: 130,
    HistoryAvailable: true,
  };
}

describe("computeRadiusSessionSummary", () => {
  it("computes row, route, execution and filter counters", () => {
    const row1 = makeRow(1, 10, 20);
    const row2 = makeRow(2, 10, 20);
    const row3 = makeRow(3, 11, 21);
    const getRouteKey = (row: FlipResult) => `${row.BuySystemID}->${row.SellSystemID}`;

    const summary = computeRadiusSessionSummary({
      totalRows: [row1, row2, row3],
      visibleRows: [row1, row3],
      hiddenRowCount: 1,
      activeFilterCount: 3,
      getRouteKey,
      routeStateByKey: {
        [getRouteKey(row1)]: { status: "queued", verificationState: "stale" },
        [getRouteKey(row3)]: { status: "assigned", assignedPilotName: "Alice" },
      },
    });

    expect(summary.totalRowCount).toBe(3);
    expect(summary.visibleRowCount).toBe(2);
    expect(summary.routeCount).toBe(2);
    expect(summary.queuedRowCount).toBe(1);
    expect(summary.assignedRowCount).toBe(1);
    expect(summary.staleRowCount).toBe(1);
    expect(summary.hiddenRowCount).toBe(1);
    expect(summary.activeFilterCount).toBe(3);
    expect(summary.executableRowCount).toBe(0);
  });
});
