import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import {
  buildFillerCandidates,
  summarizeTopFillerCandidates,
} from "@/lib/fillerCandidates";
import { routeLineKey } from "@/lib/batchMetrics";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 100,
    TypeName: "Item",
    Volume: 5,
    BuyPrice: 100,
    BuyStation: "Buy",
    BuySystemName: "BuySys",
    BuySystemID: 1,
    BuyLocationID: 101,
    SellPrice: 125,
    SellStation: "Sell",
    SellSystemName: "SellSys",
    SellSystemID: 2,
    SellLocationID: 202,
    ProfitPerUnit: 20,
    MarginPercent: 20,
    UnitsToBuy: 10,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 200,
    ProfitPerJump: 20,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 1,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 200,
    FilledQty: 10,
    PreExecutionUnits: 10,
    HistoryAvailable: true,
    ...overrides,
  };
}

describe("buildFillerCandidates", () => {
  it("applies inclusion/exclusion for endpoint match, selected lines, and cargo fit", () => {
    const core = makeRow({ TypeID: 1, TypeName: "Core" });
    const selectedCoreKey = routeLineKey(core);
    const sameRouteFit = makeRow({ TypeID: 2, TypeName: "Same route fit", Volume: 2, UnitsToBuy: 10 });
    const sameRouteTooBig = makeRow({ TypeID: 3, TypeName: "Too big", Volume: 100, UnitsToBuy: 2 });
    const otherRoute = makeRow({
      TypeID: 4,
      TypeName: "Other route",
      BuyLocationID: 999,
      BuySystemID: 9,
    });

    const candidates = buildFillerCandidates({
      routeRows: [core, sameRouteFit, sameRouteTooBig, otherRoute],
      selectedCoreLineKeys: [selectedCoreKey],
      remainingCargoM3: 50,
      remainingCapitalIsk: 10_000,
    });

    expect(candidates.map((item) => item.typeName)).toEqual(["Same route fit"]);
  });

  it("ranks mixed profitability and risk with penalties", () => {
    const core = makeRow({ TypeID: 10, TypeName: "Core" });
    const robust = makeRow({ TypeID: 11, TypeName: "Robust", TotalProfit: 600, Volume: 5, UnitsToBuy: 10 });
    const risky = makeRow({
      TypeID: 12,
      TypeName: "Risky",
      TotalProfit: 900,
      Volume: 5,
      UnitsToBuy: 10,
      SlippageBuyPct: 20,
      SlippageSellPct: 10,
      HistoryAvailable: false,
      DayNowProfit: 10,
      DayPeriodProfit: -5,
    });

    const candidates = buildFillerCandidates({
      routeRows: [core, robust, risky],
      selectedCoreLineKeys: [routeLineKey(core)],
      remainingCargoM3: 500,
      remainingCapitalIsk: 1_000_000,
    });

    expect(candidates[0]?.typeName).toBe("Robust");
    expect(candidates[1]?.flags.length).toBeGreaterThan(0);
  });

  it("returns top-N summary totals", () => {
    const core = makeRow({ TypeID: 20, TypeName: "Core" });
    const a = makeRow({ TypeID: 21, TypeName: "A", TotalProfit: 200, UnitsToBuy: 10, BuyPrice: 100, Volume: 2 });
    const b = makeRow({ TypeID: 22, TypeName: "B", TotalProfit: 300, UnitsToBuy: 10, BuyPrice: 200, Volume: 1 });
    const c = makeRow({ TypeID: 23, TypeName: "C", TotalProfit: 100, UnitsToBuy: 10, BuyPrice: 50, Volume: 4 });

    const candidates = buildFillerCandidates({
      routeRows: [core, a, b, c],
      selectedCoreLineKeys: [routeLineKey(core)],
      remainingCargoM3: 200,
      remainingCapitalIsk: 1_000_000,
    });

    const summary = summarizeTopFillerCandidates(candidates, 2);
    expect(summary.count).toBe(2);
    expect(summary.totalProfitIsk).toBeCloseTo(
      candidates[0].incrementalProfitIsk + candidates[1].incrementalProfitIsk,
    );
    expect(summary.totalCapitalIsk).toBeCloseTo(
      candidates[0].incrementalCapitalIsk + candidates[1].incrementalCapitalIsk,
    );
  });
});
