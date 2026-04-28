import { describe, expect, it } from "vitest";
import { buildIskPerJumpHistogram, buildPinnedTrendSeries, buildScatterSeries, iskPerJumpBin, movementColor } from "@/lib/radiusAnalytics";
import type { FlipResult, PinnedOpportunitySnapshotRecord } from "@/lib/types";

const row = (overrides: Partial<FlipResult> = {}): FlipResult => ({
  TypeID: 1, TypeName: "Item", Volume: 5, BuyPrice: 1, BuyStation: "A", BuySystemName: "Jita", BuySystemID: 1,
  SellPrice: 2, SellStation: "B", SellSystemName: "Amarr", SellSystemID: 2, ProfitPerUnit: 1, MarginPercent: 10,
  UnitsToBuy: 100, BuyOrderRemain: 100, SellOrderRemain: 100, TotalProfit: 1000000, ProfitPerJump: 1000,
  BuyJumps: 1, SellJumps: 1, TotalJumps: 2, DailyVolume: 10, Velocity: 0, PriceTrend: 0, BuyCompetitors: 0,
  SellCompetitors: 0, DailyProfit: 0,
  ...overrides,
});

describe("radiusAnalytics", () => {
  it("bins isk/jump", () => {
    expect(iskPerJumpBin(99_999)).toBe("0-100k");
    expect(iskPerJumpBin(100_000)).toBe("100k-250k");
    expect(iskPerJumpBin(250_000)).toBe("250k-500k");
    expect(iskPerJumpBin(500_000)).toBe("500k-1m");
    expect(iskPerJumpBin(2_000_000)).toBe("1m+");
  });

  it("builds histogram counts", () => {
    const bins = buildIskPerJumpHistogram([row({ ProfitPerJump: 50_000 }), row({ ProfitPerJump: 300_000 }), row({ ProfitPerJump: 2_000_000 })]);
    expect(bins["0-100k"]).toBe(1);
    expect(bins["250k-500k"]).toBe(1);
    expect(bins["1m+"]).toBe(1);
  });

  it("maps movement colors", () => {
    expect(movementColor("improving")).toBe("#14b8a6");
    expect(movementColor("unknown")).toBe("#a78bfa");
  });

  it("keeps pinned continuity when timestamps have gaps", () => {
    const snapshotsByKey: Record<string, PinnedOpportunitySnapshotRecord[]> = {
      k1: [
        { id: 2, user_id: "u", opportunity_key: "k1", snapshot_label: "b", snapshot_at: "2026-01-03T00:00:00Z", metrics_json: "{}", metrics: { profit: 5, volume: 2, margin: 10, route_risk: 3 } },
        { id: 1, user_id: "u", opportunity_key: "k1", snapshot_label: "a", snapshot_at: "2026-01-01T00:00:00Z", metrics_json: "{}", metrics: { profit: 2, volume: 1, margin: 20, route_risk: 1 } },
      ],
    };
    const series = buildPinnedTrendSeries(snapshotsByKey);
    expect(series.k1).toHaveLength(2);
    expect(series.k1[0].at).toBe("2026-01-01T00:00:00Z");
    expect(series.k1[1].profit).toBe(5);
  });

  it("builds scatter rows", () => {
    const series = buildScatterSeries([row({ RealProfit: 123 })], new Map());
    expect(series[0].realProfit).toBe(123);
    expect(series[0].route).toContain("→");
  });
});
