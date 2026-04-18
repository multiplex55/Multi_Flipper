import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import {
  classifyFlipUrgency,
  deriveActionQueue,
  dailyIskPerJump,
  realIskPerJump,
  realIskPerM3PerJump,
  selectTopRoutePicks,
  slippageCostIsk,
  turnoverDays,
} from "@/lib/radiusMetrics";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Test",
    Volume: 10,
    BuyPrice: 100,
    BuyStation: "A",
    BuySystemName: "A",
    BuySystemID: 1,
    SellPrice: 130,
    SellStation: "B",
    SellSystemName: "B",
    SellSystemID: 2,
    ProfitPerUnit: 30,
    MarginPercent: 30,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 300,
    ProfitPerJump: 50,
    BuyJumps: 1,
    SellJumps: 1,
    TotalJumps: 2,
    DailyVolume: 100,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 200,
    RealProfit: 120,
    FilledQty: 4,
    ExpectedBuyPrice: 102,
    ExpectedSellPrice: 126,
    ...overrides,
  };
}

describe("radiusMetrics formulas", () => {
  it.each([
    { name: "normal jumps", totalJumps: 4, realProfit: 200, expected: 50 },
    { name: "zero jumps guarded", totalJumps: 0, realProfit: 200, expected: 200 },
  ])("realIskPerJump: $name", ({ totalJumps, realProfit, expected }) => {
    expect(realIskPerJump(makeRow({ TotalJumps: totalJumps, RealProfit: realProfit }))).toBe(
      expected,
    );
  });

  it.each([
    { name: "normal jumps", totalJumps: 5, dailyProfit: 250, expected: 50 },
    { name: "zero jumps guarded", totalJumps: 0, dailyProfit: 250, expected: 250 },
  ])("dailyIskPerJump: $name", ({ totalJumps, dailyProfit, expected }) => {
    expect(dailyIskPerJump(makeRow({ TotalJumps: totalJumps, DailyProfit: dailyProfit }))).toBe(
      expected,
    );
  });

  it.each([
    {
      name: "normal",
      row: makeRow({ RealProfit: 200, FilledQty: 2, Volume: 5, TotalJumps: 4 }),
      expected: 5,
    },
    {
      name: "zero jumps guarded",
      row: makeRow({ RealProfit: 200, FilledQty: 2, Volume: 5, TotalJumps: 0 }),
      expected: 20,
    },
    {
      name: "zero volume",
      row: makeRow({ RealProfit: 200, FilledQty: 2, Volume: 0, TotalJumps: 4 }),
      expected: 0,
    },
    {
      name: "missing fills",
      row: makeRow({ RealProfit: 200, FilledQty: undefined, Volume: 5, TotalJumps: 4 }),
      expected: 0,
    },
  ])("realIskPerM3PerJump: $name", ({ row, expected }) => {
    expect(realIskPerM3PerJump(row)).toBe(expected);
  });

  it.each([
    {
      name: "normal",
      row: makeRow({ DayCapitalRequired: 1_000, DailyProfit: 200 }),
      expected: 5,
    },
    {
      name: "zero daily profit guarded",
      row: makeRow({ DayCapitalRequired: 1_000, DailyProfit: 0 }),
      expected: null,
    },
    {
      name: "negative daily profit guarded",
      row: makeRow({ DayCapitalRequired: 1_000, DailyProfit: -10 }),
      expected: null,
    },
  ])("turnoverDays: $name", ({ row, expected }) => {
    expect(turnoverDays(row)).toBe(expected);
  });

  it.each([
    {
      name: "both sides slip",
      row: makeRow({ FilledQty: 10, BuyPrice: 100, ExpectedBuyPrice: 105, SellPrice: 140, ExpectedSellPrice: 132 }),
      expected: 130,
    },
    {
      name: "missing fills",
      row: makeRow({ FilledQty: undefined, BuyPrice: 100, ExpectedBuyPrice: 105, SellPrice: 140, ExpectedSellPrice: 132 }),
      expected: 0,
    },
  ])("slippageCostIsk: $name", ({ row, expected }) => {
    expect(slippageCostIsk(row)).toBe(expected);
  });

  it("supports edge case: positive raw profit but negative real after slippage", () => {
    const row = makeRow({
      TotalProfit: 1_000,
      RealProfit: -200,
      FilledQty: 10,
      BuyPrice: 100,
      ExpectedBuyPrice: 115,
      SellPrice: 150,
      ExpectedSellPrice: 120,
      TotalJumps: 2,
      Volume: 5,
    });

    expect(realIskPerJump(row)).toBe(-100);
    expect(realIskPerM3PerJump(row)).toBe(-2);
    expect(slippageCostIsk(row)).toBe(450);
  });

  it("urgency score increases with higher slippage and lower depth", () => {
    const lowUrgency = classifyFlipUrgency(
      makeRow({
        UnitsToBuy: 100,
        FilledQty: 95,
        BuyOrderRemain: 120,
        SellOrderRemain: 120,
        SlippageBuyPct: 0.2,
        SlippageSellPct: 0.2,
        TotalJumps: 1,
      }),
    );
    const highUrgency = classifyFlipUrgency(
      makeRow({
        UnitsToBuy: 100,
        FilledQty: 15,
        BuyOrderRemain: 20,
        SellOrderRemain: 20,
        SlippageBuyPct: 8,
        SlippageSellPct: 7,
        TotalJumps: 10,
      }),
    );

    expect(highUrgency.urgency_score).toBeGreaterThan(lowUrgency.urgency_score);
  });

  it("maps urgency bands at threshold edges", () => {
    expect(
      classifyFlipUrgency(
        makeRow({
          UnitsToBuy: 100,
          FilledQty: 100,
          BuyOrderRemain: 100,
          SellOrderRemain: 100,
          SlippageBuyPct: 0,
          SlippageSellPct: 0,
          TotalJumps: 1,
        }),
      ).urgency_band,
    ).toBe("stable");
    expect(
      classifyFlipUrgency(
        makeRow({
          UnitsToBuy: 100,
          FilledQty: 35,
          BuyOrderRemain: 40,
          SellOrderRemain: 40,
          SlippageBuyPct: 7,
          SlippageSellPct: 6,
          TotalJumps: 8,
        }),
      ).urgency_band,
    ).toBe("aging");
    expect(
      classifyFlipUrgency(
        makeRow({
          UnitsToBuy: 100,
          FilledQty: 20,
          BuyOrderRemain: 20,
          SellOrderRemain: 20,
          SlippageBuyPct: 9,
          SlippageSellPct: 8,
          TotalJumps: 12,
          HistoryAvailable: false,
        }),
      ).urgency_band,
    ).toBe("fragile");
  });

  it("selects top picks using route pick selectors", () => {
    const picks = selectTopRoutePicks([
      {
        routeKey: "route-a",
        routeLabel: "A -> B",
        totalProfit: 1_000_000,
        dailyIskPerJump: 520_000,
        confidenceScore: 82,
        cargoUsePercent: 78,
        recommendationScore: 99,
        stopCount: 3,
        riskCount: 1,
      },
      {
        routeKey: "route-b",
        routeLabel: "C -> D",
        totalProfit: 700_000,
        dailyIskPerJump: 460_000,
        confidenceScore: 74,
        cargoUsePercent: 88,
        recommendationScore: 78,
        stopCount: 2,
        riskCount: 3,
      },
      {
        routeKey: "route-c",
        routeLabel: "E -> F",
        totalProfit: 600_000,
        dailyIskPerJump: 250_000,
        confidenceScore: 95,
        cargoUsePercent: 52,
        recommendationScore: 80,
        stopCount: 2,
        riskCount: 0,
      },
    ]);

    expect(picks.bestRecommendedRoutePack?.routeKey).toBe("route-a");
    expect(picks.bestQuickSingleRoute?.routeKey).toBe("route-b");
    expect(picks.bestSafeFillerRoute?.routeKey).toBe("route-c");
  });

  it("uses tracked share as a bounded tie-breaker signal for recommended picks", () => {
    const picks = selectTopRoutePicks([
      {
        routeKey: "strong-untracked",
        routeLabel: "Strong",
        totalProfit: 1_400_000,
        dailyIskPerJump: 700_000,
        confidenceScore: 88,
        cargoUsePercent: 75,
        recommendationScore: 93,
        stopCount: 2,
        riskCount: 1,
        trackedShare: 0,
      },
      {
        routeKey: "weaker-tracked",
        routeLabel: "Tracked",
        totalProfit: 900_000,
        dailyIskPerJump: 420_000,
        confidenceScore: 72,
        cargoUsePercent: 80,
        recommendationScore: 74,
        stopCount: 2,
        riskCount: 2,
        trackedShare: 1,
      },
    ]);

    expect(picks.bestRecommendedRoutePack?.routeKey).toBe("strong-untracked");
  });

  it("derives action queue with machine-readable reasons", () => {
    const queue = deriveActionQueue({
      candidates: [
        {
          routeKey: "hub-heavy",
          routeLabel: "Hub Heavy",
          totalProfit: 900_000,
          dailyIskPerJump: 450_000,
          confidenceScore: 76,
          cargoUsePercent: 68,
          recommendationScore: 80,
          stopCount: 2,
          riskCount: 2,
          endpointScoreDelta: -12,
          endpointRuleHits: 2,
        },
        {
          routeKey: "loop-out",
          routeLabel: "Loop Out",
          totalProfit: 800_000,
          dailyIskPerJump: 410_000,
          confidenceScore: 90,
          cargoUsePercent: 60,
          recommendationScore: 82,
          stopCount: 2,
          riskCount: 1,
          hasLoopCandidate: true,
          trackedShare: 0.5,
        },
      ],
      suppression: {
        hardBanFiltered: 4,
        softSessionFiltered: 2,
      },
    });

    expect(queue).toHaveLength(2);
    expect(queue[0].routeKey).toBe("loop-out");
    expect(queue[0].reasons).toContain("watchlist_signal");
    expect(queue[0].reasons).toContain("loop_candidate_outbound");
    expect(queue[1].action).toBe("avoid_hub_race");
    expect(queue[1].reasons).toContain("endpoint_hub_penalty");
    expect(queue[1].reasons).toContain("endpoint_rules_applied");
  });

  it("assigns queue item action types from combined route signals", () => {
    const queue = deriveActionQueue({
      candidates: [
        {
          routeKey: "tracked-candidate",
          routeLabel: "Tracked Candidate",
          totalProfit: 500_000,
          dailyIskPerJump: 300_000,
          confidenceScore: 75,
          cargoUsePercent: 60,
          recommendationScore: 70,
          stopCount: 3,
          riskCount: 2,
          trackedShare: 0.6,
        },
        {
          routeKey: "return-candidate",
          routeLabel: "Return Candidate",
          totalProfit: 650_000,
          dailyIskPerJump: 330_000,
          confidenceScore: 74,
          cargoUsePercent: 55,
          recommendationScore: 72,
          stopCount: 3,
          riskCount: 2,
          hasBackhaulCandidate: true,
        },
        {
          routeKey: "safe-buy-now",
          routeLabel: "Safe Buy",
          totalProfit: 800_000,
          dailyIskPerJump: 380_000,
          confidenceScore: 92,
          cargoUsePercent: 70,
          recommendationScore: 88,
          stopCount: 2,
          riskCount: 1,
        },
        {
          routeKey: "risky-filler",
          routeLabel: "Risky Filler",
          totalProfit: 400_000,
          dailyIskPerJump: 150_000,
          confidenceScore: 61,
          cargoUsePercent: 85,
          recommendationScore: 54,
          stopCount: 4,
          riskCount: 5,
        },
      ],
    });

    const byKey = new Map(queue.map((item) => [item.routeKey, item.action]));
    expect(byKey.get("tracked-candidate")).toBe("tracked");
    expect(byKey.get("return-candidate")).toBe("loop_return");
    expect(byKey.get("safe-buy-now")).toBe("buy_now");
    expect(byKey.get("risky-filler")).toBe("filler");
  });

  it("keeps reason metadata stable and includes endpoint/session markers", () => {
    const queue = deriveActionQueue({
      candidates: [
        {
          routeKey: "meta-check",
          routeLabel: "Metadata Check",
          totalProfit: 650_000,
          dailyIskPerJump: 310_000,
          confidenceScore: 72,
          cargoUsePercent: 63,
          recommendationScore: 75,
          stopCount: 2,
          riskCount: 2,
          endpointScoreDelta: -9,
          endpointRuleHits: 3,
          hasDeprioritizedRows: true,
        },
      ],
    });

    expect(queue).toHaveLength(1);
    expect(queue[0].reasons).toEqual(
      expect.arrayContaining([
        "endpoint_hub_penalty",
        "endpoint_rules_applied",
        "session_deprioritized",
      ]),
    );
  });

  it("uses the same candidate dataset for Top Picks and Action Queue without contradictions", () => {
    const candidates = [
      {
        routeKey: "primary",
        routeLabel: "Primary Route",
        totalProfit: 1_500_000,
        dailyIskPerJump: 650_000,
        confidenceScore: 90,
        cargoUsePercent: 72,
        recommendationScore: 95,
        stopCount: 2,
        riskCount: 1,
        trackedShare: 0.2,
      },
      {
        routeKey: "secondary",
        routeLabel: "Secondary Route",
        totalProfit: 900_000,
        dailyIskPerJump: 390_000,
        confidenceScore: 78,
        cargoUsePercent: 66,
        recommendationScore: 80,
        stopCount: 3,
        riskCount: 2,
      },
    ];

    const picks = selectTopRoutePicks(candidates);
    const queue = deriveActionQueue({ candidates });

    expect(picks.bestRecommendedRoutePack?.routeKey).toBe("primary");
    expect(queue[0].routeKey).toBe("primary");
    expect(queue.map((item) => item.routeKey)).toContain(
      picks.bestRecommendedRoutePack?.routeKey,
    );
  });
});
