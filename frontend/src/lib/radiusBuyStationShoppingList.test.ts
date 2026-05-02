import { describe, expect, it } from "vitest";
import { buildRadiusBuyStationShoppingLists } from "@/lib/radiusBuyStationShoppingList";
import { makeFlipResult } from "@/lib/testFixtures";
import type { FlipResult } from "@/lib/types";

function row(name: string, overrides: Partial<FlipResult> = {}) {
  return makeFlipResult({
    TypeName: name,
    UnitsToBuy: 10,
    Volume: 5,
    BuyPrice: 100,
    ExpectedBuyPrice: 100,
    SellPrice: 140,
    ExpectedSellPrice: 140,
    ProfitPerUnit: 40,
    TotalProfit: 400,
    ExpectedProfit: 400,
    BuySystemID: 300001,
    BuySystemName: "Jita",
    BuyLocationID: 600001,
    BuyStation: "Jita 4-4",
    SellSystemID: 300021,
    SellSystemName: "Amarr",
    SellLocationID: 60003760,
    SellStation: "Amarr VIII",
    TotalJumps: 8,
    ...overrides,
  });
}

describe("buildRadiusBuyStationShoppingLists", () => {
  it("groups by BuyLocationID fallback and computes aggregate math", () => {
    const lists = buildRadiusBuyStationShoppingLists({
      rows: [
        row("A", { TypeID: 1, BuyLocationID: undefined, BuySystemID: 300001 }),
        row("B", { TypeID: 2, BuyLocationID: undefined, BuySystemID: 300001 }),
        row("C", { TypeID: 3, BuyLocationID: 600002, BuyStation: "Perimeter", BuySystemName: "Perimeter" }),
      ],
    });
    expect(lists).toHaveLength(2);
    expect(lists[0].units).toBe(20);
    expect(lists[0].volumeM3).toBe(100);
    expect(lists[0].capitalIsk).toBe(2000);
    expect(lists[0].grossSellIsk).toBe(2800);
    expect(lists[0].totalProfitIsk).toBe(800);
  });

  it("excludes invalid rows", () => {
    const lists = buildRadiusBuyStationShoppingLists({
      rows: [
        row("valid", { TypeID: 1 }),
        row("no units", { TypeID: 2, UnitsToBuy: 0 }),
        row("no volume", { TypeID: 3, Volume: -1 }),
        row("bad spread", { TypeID: 4, SellPrice: 80, ExpectedSellPrice: 80 }),
        row("no profit", { TypeID: 5, ProfitPerUnit: 0, TotalProfit: 0, ExpectedProfit: 0 }),
      ],
    });
    expect(lists).toHaveLength(1);
    expect(lists[0].lines).toHaveLength(1);
  });

  it("ranks robust spreads over thin fake spreads", () => {
    const stable = row("stable", { TypeID: 10, BuyLocationID: 10, BuyStation: "Stable", ProfitPerUnit: 300, TotalProfit: 3000, ExpectedProfit: 3000, SellPrice: 400, ExpectedSellPrice: 400 });
    const thin = row("thin", {
      TypeID: 20,
      BuyLocationID: 20,
      BuyStation: "Thin",
      ProfitPerUnit: 600,
      TotalProfit: 6000,
      ExpectedProfit: 6000,
      SellPrice: 700,
      ExpectedSellPrice: 700,
      SlippageBuyPct: 30,
      SlippageSellPct: 30,
      CanFill: false,
      FilledQty: 1,
      BuyOrderRemain: 1,
      SellOrderRemain: 1,
      DailyVolume: 1,
      DayNowProfit: 100,
      DayPeriodProfit: -100,
      HistoryAvailable: false,
    });

    const lists = buildRadiusBuyStationShoppingLists({ rows: [thin, stable] });
    expect(lists[0].buyStationName).toBe("Stable");
  });

  it("applies cargo and capital caps", () => {
    const lists = buildRadiusBuyStationShoppingLists({
      rows: [
        row("line1", { TypeID: 1, UnitsToBuy: 20, Volume: 10, BuyPrice: 100 }),
        row("line2", { TypeID: 2, UnitsToBuy: 20, Volume: 10, BuyPrice: 100 }),
      ],
      cargoCapacityM3: 210,
      maxCapitalIsk: 2100,
    });
    expect(lists[0].lines).toHaveLength(1);
    expect(lists[0].volumeM3).toBeLessThanOrEqual(210);
    expect(lists[0].capitalIsk).toBeLessThanOrEqual(2100);
  });

  it("uses dominant profitable destination for primary sell station", () => {
    const lists = buildRadiusBuyStationShoppingLists({
      rows: [
        row("A", { SellStation: "Amarr", ProfitPerUnit: 100, TotalProfit: 1000, ExpectedProfit: 1000 }),
        row("B", { TypeID: 2, SellStation: "Dodixie", ProfitPerUnit: 300, TotalProfit: 3000, ExpectedProfit: 3000 }),
      ],
    });
    expect(lists[0].primarySellStation).toBe("Dodixie");
  });

  it("is deterministic on ties by station name then id", () => {
    const rows = [
      row("A", { BuyLocationID: 2, BuyStation: "Alpha", TypeID: 1 }),
      row("B", { BuyLocationID: 1, BuyStation: "Alpha", TypeID: 2 }),
      row("C", { BuyLocationID: 3, BuyStation: "Beta", TypeID: 3 }),
    ];
    const first = buildRadiusBuyStationShoppingLists({ rows });
    const second = buildRadiusBuyStationShoppingLists({ rows: [...rows].reverse() });
    expect(first.map((l) => l.id)).toEqual(second.map((l) => l.id));
    expect(first[0].buyGroupId).toBe(1);
  });

  it("handles sparse legacy rows without runtime exceptions", () => {
    const sparse = row("Sparse", {
      BuyLocationID: undefined,
      BuySystemID: undefined,
      BuyStation: undefined,
      SellStation: undefined,
      HistoryAvailable: undefined,
      FilledQty: undefined,
      SlippageBuyPct: Number.NaN,
      SlippageSellPct: Number.NaN,
    });
    expect(() => buildRadiusBuyStationShoppingLists({ rows: [sparse] })).not.toThrow();
  });

  it("keeps zero-volume profitable rows and includes their capital/profit totals", () => {
    const lists = buildRadiusBuyStationShoppingLists({
      rows: [
        row("zero vol", { TypeID: 99, Volume: 0, UnitsToBuy: 10, BuyPrice: 1_000, SellPrice: 1_600, ExpectedSellPrice: 1_600, ProfitPerUnit: 600, TotalProfit: 6_000, ExpectedProfit: 6_000 }),
      ],
    });
    expect(lists).toHaveLength(1);
    expect(lists[0].volumeM3).toBe(0);
    expect(lists[0].capitalIsk).toBeGreaterThan(0);
    expect(lists[0].totalProfitIsk).toBe(6_000);
  });

  it("rejects negative-volume rows while keeping mixed zero/non-zero packages", () => {
    const lists = buildRadiusBuyStationShoppingLists({
      rows: [
        row("bad vol", { TypeID: 201, Volume: -2 }),
        row("zero vol", { TypeID: 202, Volume: 0, UnitsToBuy: 4, BuyPrice: 1_000, ExpectedBuyPrice: 1_000, SellPrice: 1_250, ExpectedSellPrice: 1_250, ProfitPerUnit: 250, TotalProfit: 1_000, ExpectedProfit: 1_000 }),
        row("normal", { TypeID: 203, Volume: 3, UnitsToBuy: 5, BuyPrice: 2_000, ExpectedBuyPrice: 2_000, SellPrice: 2_500, ExpectedSellPrice: 2_500, ProfitPerUnit: 500, TotalProfit: 2_500, ExpectedProfit: 2_500 }),
      ],
    });
    expect(lists).toHaveLength(1);
    expect(lists[0].lines.map((l) => l.row.TypeName)).toEqual(expect.arrayContaining(["zero vol", "normal"]));
    expect(lists[0].lines.find((l) => l.row.TypeName === "bad vol")).toBeUndefined();
  });

});
