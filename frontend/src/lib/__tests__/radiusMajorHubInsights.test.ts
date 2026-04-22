import { describe, expect, it } from "vitest";
import {
  buildRadiusMajorHubInsights,
  RADIUS_CANONICAL_MAJOR_HUBS,
} from "@/lib/radiusMajorHubInsights";
import type { FlipResult } from "@/lib/types";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 140,
    SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 40,
    MarginPercent: 40,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 400,
    ProfitPerJump: 40,
    BuyJumps: 1,
    SellJumps: 1,
    TotalJumps: 2,
    DailyVolume: 500,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 80,
    ...overrides,
  };
}

describe("radiusMajorHubInsights", () => {
  it("returns canonical hubs with directional splits", () => {
    const rows: FlipResult[] = [
      makeRow({ TypeID: 11 }),
      makeRow({ TypeID: 12, BuySystemID: 30002053, BuySystemName: "Hek" }),
      makeRow({
        TypeID: 13,
        BuySystemID: 30002187,
        BuySystemName: "Amarr",
        SellSystemID: 30002053,
        SellSystemName: "Hek",
      }),
    ];

    const hubs = buildRadiusMajorHubInsights(rows);

    expect(hubs.map((hub) => hub.hub.key)).toEqual(
      RADIUS_CANONICAL_MAJOR_HUBS.map((hub) => hub.key),
    );
    const jita = hubs.find((hub) => hub.hub.key === "jita");
    const hek = hubs.find((hub) => hub.hub.key === "hek");
    expect(jita?.buy.rowCount).toBe(1);
    expect(jita?.sell.rowCount).toBe(0);
    expect(hek?.buy.rowCount).toBe(1);
    expect(hek?.sell.rowCount).toBe(1);
  });

  it("excludes invalid and non-actionable rows", () => {
    const rows: FlipResult[] = [
      makeRow({ TypeID: 11, TotalProfit: 500 }),
      makeRow({ TypeID: 12, UnitsToBuy: 0, TotalProfit: 500 }),
      makeRow({ TypeID: 13, TotalProfit: 0 }),
      makeRow({ TypeID: 14, CanFill: false, TotalProfit: 500 }),
    ];

    const hubs = buildRadiusMajorHubInsights(rows);
    const jita = hubs.find((hub) => hub.hub.key === "jita");

    expect(jita?.buy.rowCount).toBe(1);
    expect(jita?.buy.distinctItems).toBe(1);
  });

  it("matches Perimeter only by TTT structure name", () => {
    const rows: FlipResult[] = [
      makeRow({
        TypeID: 21,
        BuySystemID: 30000144,
        BuySystemName: "Perimeter",
        BuyStation: "Perimeter - Tranquility Trading Tower",
      }),
      makeRow({
        TypeID: 22,
        BuySystemID: 30000144,
        BuySystemName: "Perimeter",
        BuyStation: "Perimeter - Caldari Business Tribunal",
      }),
    ];

    const hubs = buildRadiusMajorHubInsights(rows);
    const perimeter = hubs.find((hub) => hub.hub.key === "perimeter_ttt");

    expect(perimeter?.buy.rowCount).toBe(1);
    expect(perimeter?.buy.distinctItems).toBe(1);
  });

  it("keeps zero-match hubs with zeroed metrics", () => {
    const hubs = buildRadiusMajorHubInsights([]);

    expect(hubs).toHaveLength(6);
    for (const hub of hubs) {
      expect(hub.buy.rowCount).toBe(0);
      expect(hub.buy.distinctItems).toBe(0);
      expect(hub.sell.rowCount).toBe(0);
      expect(hub.sell.distinctItems).toBe(0);
    }
  });
});
