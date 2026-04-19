import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import {
  compareRowsStable,
  compareScanRows,
  type CompareScanRowsOptions,
  type IndexedOrderingRow,
} from "@/components/scanResultsOrdering";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 101,
    TypeName: "Item 101",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 125,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 25,
    MarginPercent: 25,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 250,
    ProfitPerJump: 20,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 0,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 50,
    RealProfit: 250,
    ...overrides,
  };
}

function makeIndexed(
  id: number,
  sourceIndex: number,
  row: FlipResult,
): IndexedOrderingRow {
  return { id, sourceIndex, row, endpointPreferences: { scoreDelta: 0 } };
}

function baseOptions(
  getSmartSignals: CompareScanRowsOptions<string>["getSmartSignals"],
): CompareScanRowsOptions<string> {
  return {
    orderingMode: "smart",
    pinsFirst: true,
    trackedFirst: true,
    sortKey: "RealProfit",
    sortDir: "desc",
    getSmartSignals,
    getCellValue: (row) => row.RealProfit,
    isBatchSyntheticKey: () => false,
    compareBatchSyntheticValues: () => 0,
  };
}

describe("scanResultsOrdering comparator", () => {
  it("preserves smart layered behavior before column sorting", () => {
    const pinned = makeIndexed(1, 0, makeRow({ TypeID: 1, TypeName: "Pinned" }));
    const tracked = makeIndexed(2, 1, makeRow({ TypeID: 2, TypeName: "Tracked" }));
    const deprioritized = makeIndexed(
      3,
      2,
      makeRow({ TypeID: 3, TypeName: "Deprioritized" }),
    );
    const endpointBoost = makeIndexed(
      4,
      3,
      makeRow({ TypeID: 4, TypeName: "Endpoint" }),
    );

    const signalsById = new Map<number, ReturnType<CompareScanRowsOptions<string>["getSmartSignals"]>>([
      [1, { isPinned: true, isTracked: false, isSessionDeprioritized: false, endpointScoreDelta: 0 }],
      [2, { isPinned: false, isTracked: true, isSessionDeprioritized: false, endpointScoreDelta: 0 }],
      [3, { isPinned: false, isTracked: false, isSessionDeprioritized: true, endpointScoreDelta: 100 }],
      [4, { isPinned: false, isTracked: false, isSessionDeprioritized: false, endpointScoreDelta: 5 }],
    ]);

    const options = baseOptions((item) => signalsById.get(item.id)!);
    const sorted = [deprioritized, endpointBoost, tracked, pinned].sort((a, b) =>
      compareScanRows(a, b, options),
    );

    expect(sorted.map((item) => item.id)).toEqual([1, 2, 4, 3]);
  });

  it("orders by selected column in column-only mode and uses stable tie-breaker", () => {
    const first = makeIndexed(10, 0, makeRow({ TypeID: 700, TypeName: "Gamma", RealProfit: 100 }));
    const second = makeIndexed(11, 1, makeRow({ TypeID: 700, TypeName: "Gamma", RealProfit: 100 }));
    const high = makeIndexed(12, 2, makeRow({ TypeID: 710, TypeName: "High", RealProfit: 300 }));

    const options = {
      ...baseOptions(() => {
        throw new Error("smart signals should not be read in column-only mode");
      }),
      orderingMode: "column_only" as const,
    };

    const sorted = [second, high, first].sort((a, b) => compareScanRows(a, b, options));

    expect(sorted.map((item) => item.id)).toEqual([12, 10, 11]);
  });

  it("applies pinsFirst only in smart mode", () => {
    const pinned = makeIndexed(21, 0, makeRow({ TypeID: 21, RealProfit: 100 }));
    const unpinned = makeIndexed(22, 1, makeRow({ TypeID: 22, RealProfit: 300 }));
    const signals = (item: IndexedOrderingRow) => ({
      isPinned: item.id === 21,
      isTracked: false,
      isSessionDeprioritized: false,
      endpointScoreDelta: 0,
    });

    const smartSorted = [unpinned, pinned].sort((a, b) =>
      compareScanRows(a, b, { ...baseOptions(signals), pinsFirst: true }),
    );
    expect(smartSorted.map((item) => item.id)).toEqual([21, 22]);

    const columnOnlySorted = [unpinned, pinned].sort((a, b) =>
      compareScanRows(a, b, {
        ...baseOptions(signals),
        orderingMode: "column_only",
        pinsFirst: true,
      }),
    );
    expect(columnOnlySorted.map((item) => item.id)).toEqual([22, 21]);
  });

  it("has deterministic stable ordering for equal values", () => {
    const alpha = makeIndexed(31, 2, makeRow({ TypeID: 99, TypeName: "Alpha", RealProfit: 100 }));
    const beta = makeIndexed(32, 1, makeRow({ TypeID: 99, TypeName: "Alpha", RealProfit: 100 }));

    const sorted = [alpha, beta].sort((a, b) => compareRowsStable(a, b));

    expect(sorted.map((item) => item.id)).toEqual([31, 32]);
  });

  it("uses raw column ordering in reset-equivalent settings", () => {
    const endpointBoostedLowProfit = makeIndexed(
      41,
      0,
      makeRow({ TypeID: 41, TypeName: "Low", RealProfit: 50 }),
    );
    const plainHighProfit = makeIndexed(
      42,
      1,
      makeRow({ TypeID: 42, TypeName: "High", RealProfit: 400 }),
    );
    const options = {
      ...baseOptions((item) => ({
        isPinned: item.id === 41,
        isTracked: item.id === 41,
        isSessionDeprioritized: false,
        endpointScoreDelta: item.id === 41 ? 10_000 : 0,
      })),
      orderingMode: "column_only" as const,
      pinsFirst: false,
      trackedFirst: false,
    };

    const sorted = [endpointBoostedLowProfit, plainHighProfit].sort((a, b) =>
      compareScanRows(a, b, options),
    );
    expect(sorted.map((item) => item.id)).toEqual([42, 41]);
  });
});
