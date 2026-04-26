import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlipResult } from "@/lib/types";
import {
  createRadiusSavedDealPattern,
  matchRadiusDealPattern,
  matchesRadiusEndpoint,
  matchesRadiusType,
  radiusPatternBoostScore,
  saveCandidatePattern,
  type RadiusSavedDealPattern,
} from "@/lib/savedCandidatePatterns";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 34,
    TypeName: "Tritanium",
    BuyStation: "Jita 4-4",
    SellStation: "Amarr VIII",
    BuySystemName: "Jita",
    SellSystemName: "Amarr",
    BuyLocationID: 60003760,
    SellLocationID: 60008494,
    ExpectedProfit: 40_000_000,
    RealProfit: 35_000_000,
    TotalProfit: 30_000_000,
    ProfitPerJump: 2_000_000,
    CanFill: true,
    FilledQty: 100,
    UnitsToBuy: 100,
    PreExecutionUnits: 100,
    SlippageBuyPct: 1,
    SlippageSellPct: 1,
    BuyOrderRemain: 200,
    SellOrderRemain: 220,
    DayPriceHistory: [1, 2, 3, 4, 5],
    HistoryAvailable: true,
    TargetSellSupply: 50,
    S2BPerDay: 30,
    DailyVolume: 200,
    MarginPercent: 10,
    ...overrides,
  } as FlipResult;
}

describe("savedCandidatePatterns(radius)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T00:00:00Z"));
  });

  it("saves radius patterns and keeps deduped id", () => {
    const row = makeRow();
    const input = createRadiusSavedDealPattern(row, {
      label: "Jita -> Amarr",
      applicationMode: "filter",
      item: { typeId: row.TypeID, typeName: row.TypeName },
      buy: { locationId: row.BuyLocationID, stationName: row.BuyStation },
      sell: { locationId: row.SellLocationID, stationName: row.SellStation },
      minExecutionQuality: 70,
      maxTrapRisk: 40,
      requireFill: true,
      requireHistory: true,
    });

    const first = saveCandidatePattern(input);
    const second = saveCandidatePattern(input);
    expect(first[0].tab).toBe("radius");
    expect(second).toHaveLength(1);
  });

  it("matches type and endpoint helpers", () => {
    const row = makeRow();
    expect(matchesRadiusType(row, { item: { typeId: 34 } })).toBe(true);
    expect(matchesRadiusType(row, { item: { typeName: "trita" } })).toBe(true);
    expect(matchesRadiusType(row, { item: { typeId: 35 } })).toBe(false);

    expect(matchesRadiusEndpoint(row, "buy", { locationId: row.BuyLocationID })).toBe(true);
    expect(matchesRadiusEndpoint(row, "sell", { stationName: "amarr" })).toBe(true);
    expect(matchesRadiusEndpoint(row, "buy", { systemName: "Dodixie" })).toBe(false);
  });

  it("enforces trap-risk threshold and required flags in filter mode", () => {
    const row = makeRow({
      SlippageBuyPct: 20,
      SlippageSellPct: 15,
      CanFill: false,
      HistoryAvailable: false,
      DayPriceHistory: [],
      DayTargetPeriodPrice: 0,
    });
    const pattern = {
      ...createRadiusSavedDealPattern(row, {
        label: "Strict",
        applicationMode: "filter",
        item: { typeId: row.TypeID },
        maxTrapRisk: 20,
        requireFill: true,
        requireHistory: true,
      }),
      id: "p1",
      updatedAt: "2026-04-26T00:00:00Z",
    } as RadiusSavedDealPattern;

    const match = matchRadiusDealPattern(row, pattern);
    expect(match.matched).toBe(false);
    expect(match.reasons).toEqual(expect.arrayContaining(["max_trap_risk", "require_fill", "require_history"]));
  });

  it("supports boost mode reranking with non-match rows retained", () => {
    const baseline = makeRow({ TypeID: 100, TypeName: "Item A", ProfitPerJump: 1000 });
    const boosted = makeRow({ TypeID: 101, TypeName: "Item B", ProfitPerJump: 900 });
    const pattern = {
      ...createRadiusSavedDealPattern(boosted, {
        label: "Boost B",
        applicationMode: "boost",
        item: { typeId: boosted.TypeID },
        boostScore: 200,
      }),
      id: "p2",
      updatedAt: "2026-04-26T00:00:00Z",
    } as RadiusSavedDealPattern;

    const baseOrder = [baseline, boosted].sort((a, b) => (b.ProfitPerJump ?? 0) - (a.ProfitPerJump ?? 0));
    const boostedOrder = [baseline, boosted].sort((a, b) => {
      const aBoost = matchRadiusDealPattern(a, pattern).matched ? radiusPatternBoostScore(pattern) : 0;
      const bBoost = matchRadiusDealPattern(b, pattern).matched ? radiusPatternBoostScore(pattern) : 0;
      return (b.ProfitPerJump ?? 0) + bBoost - ((a.ProfitPerJump ?? 0) + aBoost);
    });

    expect(baseOrder.map((row) => row.TypeID)).toEqual([100, 101]);
    expect(boostedOrder.map((row) => row.TypeID)).toEqual([101, 100]);
    expect(boostedOrder).toHaveLength(2);
  });
});
