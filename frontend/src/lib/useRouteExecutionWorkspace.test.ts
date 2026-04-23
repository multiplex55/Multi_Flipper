import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRouteExecutionWorkspace } from "@/lib/useRouteExecutionWorkspace";
import type { SavedRoutePack } from "@/lib/types";

function makePack(): SavedRoutePack {
  return {
    routeKey: "route:jita-amarr",
    routeLabel: "Jita → Amarr",
    buyLocationId: 1,
    sellLocationId: 2,
    buySystemId: 3,
    sellSystemId: 4,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastVerifiedAt: null,
    verificationProfileId: "standard",
    entryMode: "core",
    launchIntent: null,
    selectedLineKeys: ["a"],
    excludedLineKeys: [],
    summarySnapshot: {
      routeItemCount: 1,
      routeTotalProfit: 500,
      routeTotalCapital: 1000,
      routeRealIskPerJump: 10,
      routeDailyIskPerJump: 10,
      routeDailyProfit: 10,
      routeWeightedSlippagePct: 1,
      routeTurnoverDays: null,
      routeSafetyRank: null,
    },
    lines: {
      a: {
        lineKey: "a",
        typeId: 34,
        typeName: "Tritanium",
        plannedQty: 10,
        plannedBuyPrice: 5,
        plannedSellPrice: 7,
        plannedProfit: 20,
        plannedVolume: 1,
        boughtQty: 0,
        boughtTotal: 0,
        soldQty: 0,
        soldTotal: 0,
        remainingQty: 10,
        status: "planned",
        skipReason: null,
        notes: "",
      },
    },
    manifestSnapshot: {
      expected_buy_isk: 50,
      expected_sell_isk: 70,
      expected_profit_isk: 20,
      min_acceptable_profit_isk: 14,
      max_buy_drift_pct: 5,
      max_sell_drift_pct: 5,
      lines: [],
    },
    verificationSnapshot: null,
    notes: "",
    tags: [],
    status: "active",
  };
}

describe("useRouteExecutionWorkspace", () => {
  beforeEach(() => localStorage.clear());

  it("initializes with empty state", () => {
    const { result } = renderHook(() => useRouteExecutionWorkspace());
    expect(result.current.activeRouteKey).toBeNull();
    expect(result.current.activeMode).toBe("finder");
    expect(result.current.savedRoutePacks).toEqual([]);
    expect(result.current.selectedPack).toBeNull();
  });

  it("selects route and mode transitions are deterministic", () => {
    const { result } = renderHook(() => useRouteExecutionWorkspace());
    const pack = makePack();
    act(() => result.current.upsertPack(pack));
    act(() => result.current.openRoute(pack.routeKey, "workbench"));
    expect(result.current.activeRouteKey).toBe(pack.routeKey);
    expect(result.current.activeMode).toBe("workbench");
    act(() => result.current.verifyRoute(pack.routeKey, { result: { status: "Good", recommendation: "proceed", expected_profit_isk: 20, min_acceptable_profit_isk: 10, current_profit_isk: 20, offenders: [], buyDriftPct: 0, sellDriftPct: 0, profitRetentionPct: 100, liquidityRetentionPct: 100, offenderLines: [], ageMinutes: 0, verifiedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), summary: "ok" } }));
    expect(result.current.activeMode).toBe("validate");
    act(() => result.current.selectPack(pack.routeKey));
    expect(result.current.activeMode).toBe("workbench");
  });

  it("verifies execution and copy action payloads", () => {
    const writeClipboard = vi.fn();
    const { result } = renderHook(() =>
      useRouteExecutionWorkspace({ writeClipboard }),
    );
    const pack = makePack();
    act(() => result.current.upsertPack(pack));
    act(() => result.current.markBought(pack.routeKey, "a", 2, 10));
    act(() => result.current.markSold(pack.routeKey, "a", 1, 7));
    expect(result.current.getPackByRouteKey(pack.routeKey)?.lines.a.soldQty).toBe(1);
    const summaryPayload = result.current.copySummary(pack.routeKey);
    const manifestPayload = result.current.copyManifest(pack.routeKey);
    expect(summaryPayload).toContain("Route: Jita → Amarr");
    expect(manifestPayload).toContain("Expected profit");
    expect(writeClipboard).toHaveBeenCalledTimes(2);
  });
});
