import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import {
  compareRowsStable,
  compareScanRows,
  type CompareScanRowsOptions,
  type IndexedOrderingRow,
  type SmartOrderingSignals,
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
  endpointScoreDelta = 0,
): IndexedOrderingRow {
  return { id, sourceIndex, row, endpointPreferences: { scoreDelta: endpointScoreDelta } };
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

function sortIds(
  rows: IndexedOrderingRow[],
  signalsById: Map<number, SmartOrderingSignals>,
  optionsOverride: Partial<CompareScanRowsOptions<string>> = {},
): number[] {
  const options: CompareScanRowsOptions<string> = {
    ...baseOptions((item) => signalsById.get(item.id) ?? {
      isPinned: false,
      isTracked: false,
      isSessionDeprioritized: false,
      endpointScoreDelta: 0,
    }),
    ...optionsOverride,
  };
  return [...rows].sort((a, b) => compareScanRows(a, b, options)).map((item) => item.id);
}

describe("scanResultsOrdering comparator", () => {
  it.each([
    {
      name: "pinned outranks tracked and endpoint deltas in smart mode",
      expected: [1, 2, 4, 3],
    },
    {
      name: "session-deprioritized sinks even with very large endpoint boost",
      expected: [1, 2, 4, 3],
    },
  ])("smart stacked ordering: $name", ({ expected }) => {
    const pinned = makeIndexed(1, 0, makeRow({ TypeID: 1, TypeName: "Pinned", RealProfit: 10 }));
    const tracked = makeIndexed(2, 1, makeRow({ TypeID: 2, TypeName: "Tracked", RealProfit: 20 }));
    const deprioritized = makeIndexed(3, 2, makeRow({ TypeID: 3, TypeName: "Dep", RealProfit: 300 }));
    const endpointBoost = makeIndexed(4, 3, makeRow({ TypeID: 4, TypeName: "Endpoint", RealProfit: 50 }));

    const signalsById = new Map<number, SmartOrderingSignals>([
      [1, { isPinned: true, isTracked: false, isSessionDeprioritized: false, endpointScoreDelta: 0 }],
      [2, { isPinned: false, isTracked: true, isSessionDeprioritized: false, endpointScoreDelta: 0 }],
      [3, { isPinned: false, isTracked: false, isSessionDeprioritized: true, endpointScoreDelta: 999 }],
      [4, { isPinned: false, isTracked: false, isSessionDeprioritized: false, endpointScoreDelta: 5 }],
    ]);

    expect(sortIds([deprioritized, endpointBoost, tracked, pinned], signalsById)).toEqual(expected);
  });

  it.each([
    { caseName: "positive endpoint delta", leftDelta: 4, rightDelta: -2, expected: [101, 102] },
    { caseName: "negative endpoint delta", leftDelta: -3, rightDelta: 8, expected: [102, 101] },
    { caseName: "zero endpoint tie falls back to active column", leftDelta: 0, rightDelta: 0, expected: [102, 101] },
  ])("smart mode endpoint delta comparator: $caseName", ({ leftDelta, rightDelta, expected }) => {
    const left = makeIndexed(101, 0, makeRow({ TypeID: 1001, RealProfit: 30 }));
    const right = makeIndexed(102, 1, makeRow({ TypeID: 1002, RealProfit: 300 }));
    const signalsById = new Map<number, SmartOrderingSignals>([
      [101, { isPinned: false, isTracked: false, isSessionDeprioritized: false, endpointScoreDelta: leftDelta }],
      [102, { isPinned: false, isTracked: false, isSessionDeprioritized: false, endpointScoreDelta: rightDelta }],
    ]);

    expect(sortIds([left, right], signalsById)).toEqual(expected);
  });

  it("orders by selected column in column-only mode and ignores hidden smart ranks", () => {
    const lowProfitPinned = makeIndexed(10, 0, makeRow({ TypeID: 700, TypeName: "Low", RealProfit: 10 }));
    const highProfitUnpinned = makeIndexed(11, 1, makeRow({ TypeID: 710, TypeName: "High", RealProfit: 500 }));
    const signals = new Map<number, SmartOrderingSignals>([
      [10, { isPinned: true, isTracked: true, isSessionDeprioritized: false, endpointScoreDelta: 5_000 }],
      [11, { isPinned: false, isTracked: false, isSessionDeprioritized: true, endpointScoreDelta: -500 }],
    ]);

    expect(
      sortIds([lowProfitPinned, highProfitUnpinned], signals, {
        orderingMode: "column_only",
        pinsFirst: true,
        trackedFirst: true,
      }),
    ).toEqual([11, 10]);
  });

  it("has deterministic stable ordering for equal sort values", () => {
    const alpha = makeIndexed(31, 2, makeRow({ TypeID: 99, TypeName: "Alpha", RealProfit: 100 }));
    const beta = makeIndexed(32, 1, makeRow({ TypeID: 99, TypeName: "Alpha", RealProfit: 100 }));
    const gamma = makeIndexed(33, 4, makeRow({ TypeID: 99, TypeName: "Alpha", RealProfit: 100 }));

    const sorted = [gamma, beta, alpha].sort((a, b) => compareRowsStable(a, b));

    expect(sorted.map((item) => item.id)).toEqual([31, 32, 33]);
  });

  it("uses stable tie-breakers in column-only mode for equal sort values", () => {
    const first = makeIndexed(50, 3, makeRow({ TypeID: 500, TypeName: "Tie", RealProfit: 200 }));
    const second = makeIndexed(51, 1, makeRow({ TypeID: 500, TypeName: "Tie", RealProfit: 200 }));
    const third = makeIndexed(52, 2, makeRow({ TypeID: 500, TypeName: "Tie", RealProfit: 200 }));

    const ordered = sortIds(
      [first, second, third],
      new Map(),
      { orderingMode: "column_only", pinsFirst: false, trackedFirst: false },
    );

    expect(ordered).toEqual([50, 51, 52]);
  });
});
