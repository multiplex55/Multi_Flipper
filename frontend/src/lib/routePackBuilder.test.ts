import { describe, expect, it } from "vitest";
import { buildSavedRoutePack } from "@/lib/routePackBuilder";
import type { FlipResult, RouteManifestVerificationSnapshot, SavedRoutePack } from "@/lib/types";
import type { RouteVerificationResult } from "@/lib/routeManifestVerification";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 101,
    TypeName: "Item 101",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyLocationID: 60003760,
    SellPrice: 130,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    SellLocationID: 60008494,
    ProfitPerUnit: 30,
    MarginPercent: 30,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 300,
    ProfitPerJump: 100,
    BuyJumps: 0,
    SellJumps: 3,
    TotalJumps: 3,
    DailyVolume: 50,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 100,
    ...overrides,
  };
}

describe("routePackBuilder", () => {
  it("builder includes manifest and verification snapshots when present", () => {
    const manifest: RouteManifestVerificationSnapshot = {
      expected_buy_isk: 100,
      expected_sell_isk: 150,
      expected_profit_isk: 50,
      min_acceptable_profit_isk: 30,
      max_buy_drift_pct: 5,
      max_sell_drift_pct: 5,
      lines: [],
    };
    const verification: RouteVerificationResult = {
      status: "Good",
      current_profit_isk: 55,
      expected_profit_isk: 50,
      min_acceptable_profit_isk: 30,
      offenders: [],
    };
    const pack = buildSavedRoutePack({
      routeKey: "loc:1->loc:2",
      routeLabel: "Jita → Amarr",
      anchorRow: makeRow(),
      routeRows: [makeRow()],
      selectedRows: [makeRow()],
      entryMode: "core",
      launchIntent: "Primary",
      summary: null,
      routeSafetyRank: 0,
      manifestSnapshot: manifest,
      verificationResult: verification,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(pack.manifestSnapshot).toEqual(manifest);
    expect(pack.verificationSnapshot?.status).toBe("Good");
    expect(pack.lastVerifiedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("builder includes only selected line keys", () => {
    const rowA = makeRow({ TypeID: 1001 });
    const rowB = makeRow({ TypeID: 1002 });
    const rowC = makeRow({ TypeID: 1003 });
    const pack = buildSavedRoutePack({
      routeKey: "loc:1->loc:2",
      routeLabel: "Jita → Amarr",
      anchorRow: rowA,
      routeRows: [rowA, rowB, rowC],
      selectedRows: [rowA, rowC],
      entryMode: "core",
      launchIntent: null,
      summary: null,
      routeSafetyRank: null,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(pack.selectedLineKeys).toHaveLength(2);
    expect(pack.excludedLineKeys).toHaveLength(1);
  });

  it("builder timestamp/update semantics", () => {
    const existing: SavedRoutePack = {
      ...buildSavedRoutePack({
        routeKey: "loc:1->loc:2",
        routeLabel: "R",
        anchorRow: makeRow(),
        routeRows: [makeRow()],
        selectedRows: [makeRow()],
        entryMode: "core",
        launchIntent: null,
        summary: null,
        routeSafetyRank: null,
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const updated = buildSavedRoutePack({
      existingPack: existing,
      routeKey: "loc:1->loc:2",
      routeLabel: "R",
      anchorRow: makeRow(),
      routeRows: [makeRow()],
      selectedRows: [makeRow()],
      entryMode: "loop",
      launchIntent: "Queue",
      summary: null,
      routeSafetyRank: 1,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(updated.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(updated.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(updated.entryMode).toBe("loop");
  });
});
