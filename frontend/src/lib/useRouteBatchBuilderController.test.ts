import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  resolveRouteBatchBuilderRouteKey,
  useRouteBatchBuilderController,
} from "@/lib/useRouteBatchBuilderController";
import type { FlipResult, SavedRoutePack } from "@/lib/types";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 34,
    TypeName: "Tritanium",
    BuySystemID: 30000142,
    BuySystemName: "Jita",
    SellSystemID: 30002187,
    SellSystemName: "Amarr",
    BuyStation: "Jita IV",
    SellStation: "Amarr VIII",
    BuyLocationID: 60003760,
    SellLocationID: 60008494,
    BuyPrice: 5,
    SellPrice: 7,
    ProfitPerUnit: 2,
    UnitsToBuy: 1000,
    FilledQty: 1000,
    DailyVolume: 10000,
    DailyProfit: 2000000,
    TotalJumps: 9,
    Volume: 0.01,
    ...overrides,
  } as FlipResult;
}

describe("useRouteBatchBuilderController", () => {
  it("resolves exact route key and refuses explicit missing route keys", () => {
    const rows = { "route:a": [makeRow()], "route:b": [makeRow({ TypeID: 35 })] };

    expect(
      resolveRouteBatchBuilderRouteKey({
        routeKey: "route:b",
        routeRowsByKey: rows,
      }),
    ).toBe("route:b");

    expect(
      resolveRouteBatchBuilderRouteKey({
        routeKey: "route:missing",
        preferredRouteKey: "route:a",
        routeRowsByKey: rows,
      }),
    ).toBeNull();
  });

  it("uses fallback only for generic launches without routeKey", () => {
    const packs = [{ routeKey: "route:b" } as SavedRoutePack];
    const rows = { "route:a": [makeRow()], "route:b": [makeRow({ TypeID: 35 })] };

    expect(
      resolveRouteBatchBuilderRouteKey({
        routeRowsByKey: rows,
        preferredRouteKey: "route:a",
        savedRoutePacks: packs,
      }),
    ).toBe("route:a");
  });

  it("assigns anchor row, rows, entry mode, and launch intent", () => {
    const setBatchPlanRow = vi.fn();
    const setBatchPlanRows = vi.fn();
    const setActiveRouteGroupKey = vi.fn();
    const setBatchBuilderEntryMode = vi.fn();
    const setBatchBuilderLaunchIntent = vi.fn();
    const setBatchBuilderMode = vi.fn();
    const setBatchBuilderInitialSelectedLineKeys = vi.fn();
    const rows = [makeRow(), makeRow({ TypeID: 35 })];

    const { result } = renderHook(() =>
      useRouteBatchBuilderController({
        routeRowsByKey: { "route:a": rows },
        preferredRouteKey: null,
        setBatchPlanRow,
        setBatchPlanRows,
        setActiveRouteGroupKey,
        setBatchBuilderEntryMode,
        setBatchBuilderLaunchIntent,
        setBatchBuilderMode,
        setBatchBuilderInitialSelectedLineKeys,
      }),
    );

    let opened = false;
    act(() => {
      opened = result.current.openBatchBuilderForRoute("route:a", {
        batchEntryMode: "loop",
        intentLabel: "Route workspace",
      });
    });

    expect(opened).toBe(true);
    expect(setBatchPlanRow).toHaveBeenCalledWith(rows[0]);
    expect(setBatchPlanRows).toHaveBeenCalledWith(rows);
    expect(setActiveRouteGroupKey).toHaveBeenCalledWith("route:a");
    expect(setBatchBuilderEntryMode).toHaveBeenCalledWith("loop");
    expect(setBatchBuilderLaunchIntent).toHaveBeenCalledWith("Route workspace");
    expect(setBatchBuilderMode).toHaveBeenCalledWith("single_anchor");
    expect(setBatchBuilderInitialSelectedLineKeys).toHaveBeenCalledWith(undefined);
  });

  it("opens recommendation route with launch context and selected line keys", () => {
    const setBatchPlanRow = vi.fn();
    const setBatchPlanRows = vi.fn();
    const setActiveRouteGroupKey = vi.fn();
    const setBatchBuilderEntryMode = vi.fn();
    const setBatchBuilderLaunchIntent = vi.fn();
    const setBatchBuilderMode = vi.fn();
    const setBatchBuilderInitialSelectedLineKeys = vi.fn();
    const rows = [makeRow()];
    const { result } = renderHook(() => useRouteBatchBuilderController({
      routeRowsByKey: { "route:a": rows }, preferredRouteKey: null, setBatchPlanRow, setBatchPlanRows, setActiveRouteGroupKey, setBatchBuilderEntryMode, setBatchBuilderLaunchIntent, setBatchBuilderMode, setBatchBuilderInitialSelectedLineKeys,
    }));
    act(() => { result.current.openBatchBuilderForRecommendation({ routeKey: "route:a", recommendation: { rows }, intentLabel: "Buy-Now recommendation" }); });
    expect(setActiveRouteGroupKey).toHaveBeenCalledWith("route:a");
    expect(setBatchBuilderLaunchIntent).toHaveBeenCalled();
    expect(setBatchBuilderInitialSelectedLineKeys).toHaveBeenCalledWith(["34:60003760:60008494"]);
  });

});
