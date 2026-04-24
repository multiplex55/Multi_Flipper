import { describe, expect, it } from "vitest";
import {
  buildRadiusMajorHubInsights,
  isRowCountedInMajorHubMetrics,
  normalizeHubMatchText,
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
    expect(jita?.card.buyFlipsRows).toBe(1);
    expect(jita?.card.sellFlipsRows).toBe(0);
    expect(hek?.buy.rowCount).toBe(1);
    expect(hek?.sell.rowCount).toBe(1);
  });

  it("computes union-distinct items and union profit without side-sum double counting", () => {
    const rows: FlipResult[] = [
      makeRow({
        TypeID: 101,
        BuySystemID: 30000142,
        BuySystemName: "Jita",
        SellSystemID: 30000142,
        SellSystemName: "Jita",
        DayPeriodProfit: 120,
      }),
      makeRow({
        TypeID: 101,
        BuySystemID: 30000142,
        BuySystemName: "Jita",
        SellSystemID: 30002187,
        SellSystemName: "Amarr",
        DayPeriodProfit: 80,
      }),
      makeRow({
        TypeID: 202,
        BuySystemID: 30002053,
        BuySystemName: "Hek",
        SellSystemID: 30000142,
        SellSystemName: "Jita",
        DayPeriodProfit: 60,
      }),
    ];

    const jita = buildRadiusMajorHubInsights(rows).find((hub) => hub.hub.key === "jita");
    expect(jita?.buy.rowCount).toBe(2);
    expect(jita?.sell.rowCount).toBe(2);
    expect(jita?.buy.distinctItems).toBe(1);
    expect(jita?.sell.distinctItems).toBe(2);
    expect(jita?.card.distinctItemsUnion).toBe(2);
    expect(jita?.card.profitUnion).toBe(260);
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

  it("applies row policy exclusions via shared predicate", () => {
    const row = makeRow({ TypeID: 33, TotalProfit: 800, UnitsToBuy: 25 });
    const cases = [
      {
        name: "session station ignored",
        context: { excludedBySessionStationIgnore: true },
      },
      {
        name: "endpoint preference excluded",
        context: { excludedByEndpointPreferences: true },
      },
      {
        name: "route safety excluded",
        context: { excludedByRouteSafetyFilter: true },
      },
      {
        name: "hidden row excluded",
        context: { excludedByRowVisibility: true },
      },
      {
        name: "fillability/stale policy excluded",
        context: { excludedByFillabilityOrStalePolicy: true },
      },
    ] as const;

    expect(isRowCountedInMajorHubMetrics(row)).toBe(true);
    for (const testCase of cases) {
      expect(
        isRowCountedInMajorHubMetrics(row, testCase.context),
        testCase.name,
      ).toBe(false);
    }
  });

  it("excludes rows that pass legacy actionable checks but fail full policy", () => {
    const rows: FlipResult[] = [
      makeRow({ TypeID: 41, BuySystemID: 30000142, BuySystemName: "Jita", TotalProfit: 600 }),
      makeRow({ TypeID: 42, BuySystemID: 30000142, BuySystemName: "Jita", TotalProfit: 600 }),
      makeRow({ TypeID: 43, BuySystemID: 30000142, BuySystemName: "Jita", TotalProfit: 600 }),
      makeRow({ TypeID: 44, BuySystemID: 30000142, BuySystemName: "Jita", TotalProfit: 600 }),
    ];
    const excludedTypeIds = new Set([42, 43, 44]);

    const hubs = buildRadiusMajorHubInsights(rows, (row) => ({
      excludedByEndpointPreferences: row.TypeID === 42,
      excludedByRowVisibility: row.TypeID === 43,
      excludedByRouteSafetyFilter: row.TypeID === 44,
      excludedByFillabilityOrStalePolicy: false,
    }));
    const jita = hubs.find((hub) => hub.hub.key === "jita");

    expect(rows.filter((row) => !excludedTypeIds.has(row.TypeID))).toHaveLength(1);
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

  it("normalizes structure variants for case/punctuation/system prefix", () => {
    expect(normalizeHubMatchText("Tranquility Trading Tower")).toBe(
      "tranquility trading tower",
    );
    expect(normalizeHubMatchText("TRANQUILITY-TRADING-TOWER")).toBe(
      "tranquility trading tower",
    );
    expect(
      normalizeHubMatchText("Perimeter – Tranquility Trading Tower"),
    ).toContain("tranquility trading tower");
  });

  it("does not count Perimeter non-TTT stations even with punctuation/case variants", () => {
    const rows: FlipResult[] = [
      makeRow({
        TypeID: 31,
        BuySystemID: 30000144,
        BuySystemName: "Perimeter",
        BuyStation: "Perimeter - Caldari Business Tribunal",
      }),
      makeRow({
        TypeID: 32,
        BuySystemID: 30000144,
        BuySystemName: "Perimeter",
        BuyStation: "PERIMETER: Tranquility-Trading-Tower",
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

  it("optionally includes directional row ids that align to row counts", () => {
    const rows: FlipResult[] = [
      makeRow({ TypeID: 91, BuySystemID: 30000142, BuySystemName: "Jita" }),
      makeRow({ TypeID: 92, BuySystemID: 30000142, BuySystemName: "Jita" }),
      makeRow({ TypeID: 93, SellSystemID: 30002187, SellSystemName: "Amarr" }),
    ];
    const hubs = buildRadiusMajorHubInsights(rows, undefined, (row) => `row-${row.TypeID}`);
    const jita = hubs.find((hub) => hub.hub.key === "jita");
    const amarr = hubs.find((hub) => hub.hub.key === "amarr");

    expect(jita?.buyRowIds).toEqual(["row-91", "row-92", "row-93"]);
    expect(jita?.buyRowIds?.length).toBe(jita?.buy.rowCount);
    expect(amarr?.sellRowIds).toEqual(["row-91", "row-92", "row-93"]);
    expect(amarr?.sellRowIds?.length).toBe(amarr?.sell.rowCount);
  });
});
