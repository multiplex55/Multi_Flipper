import { describe, expect, it } from "vitest";
import { buildRouteFillPlannerSections } from "@/lib/routeFillPlanner";
import type { FlipResult, SavedRoutePack } from "@/lib/types";
import type { LoopOpportunity } from "@/lib/loopPlanner";

function row(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 2,
    UnitsToBuy: 10,
    BuyPrice: 100,
    SellPrice: 130,
    BuySystemID: 10,
    BuyLocationID: 100,
    BuySystemName: "Jita",
    SellSystemID: 20,
    SellLocationID: 200,
    SellSystemName: "Amarr",
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalJumps: 4,
    FilledQty: 10,
    ExpectedProfit: 100_000,
    ...overrides,
  } as FlipResult;
}

function pack(): SavedRoutePack {
  return {
    routeKey: "loc:100->loc:200",
    routeLabel: "Jita → Amarr",
    buyLocationId: 100,
    sellLocationId: 200,
    buySystemId: 10,
    sellSystemId: 20,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastVerifiedAt: null,
    verificationProfileId: "standard",
    entryMode: "core",
    launchIntent: null,
    selectedLineKeys: ["1001:100:200"],
    excludedLineKeys: [],
    summarySnapshot: {
      routeItemCount: 1,
      routeTotalProfit: 100000,
      routeTotalCapital: 1000000,
      routeRealIskPerJump: 0,
      routeDailyIskPerJump: 0,
      routeDailyProfit: 0,
      routeWeightedSlippagePct: 0,
      routeTurnoverDays: null,
      routeSafetyRank: null,
    },
    lines: {},
    manifestSnapshot: null,
    verificationSnapshot: null,
    notes: "",
    tags: [],
    status: "active",
  };
}

function loops(rows: FlipResult[]): LoopOpportunity[] {
  return [
    {
      id: "loop-1",
      outbound: { rowIndex: 0, row: rows[0], profit: 100000, jumps: 4, cargoM3: 20 },
      returnLeg: { rowIndex: 2, row: rows[2], profit: 120000, jumps: 5, cargoM3: 18 },
      detourJumps: 1,
      outboundProfit: 100000,
      returnProfit: 120000,
      totalLoopProfit: 220000,
      totalLoopJumps: 10,
      emptyJumpsAvoided: 2,
      deadheadRatio: 0.1,
      loopEfficiencyScore: 82,
    },
  ];
}

describe("routeFillPlanner", () => {
  it("classifies suggestions into core/filler/loop_backhaul", () => {
    const rows = [
      row({ TypeID: 1001, TypeName: "Anchor", ExpectedProfit: 100000 }),
      row({ TypeID: 1002, TypeName: "Same Endpoint", ExpectedProfit: 150000 }),
      row({ TypeID: 1003, TypeName: "Return Cargo", BuyLocationID: 200, SellLocationID: 100, BuySystemID: 20, SellSystemID: 10 }),
    ];

    const sections = buildRouteFillPlannerSections({ rows, pack: pack(), loops: loops(rows), cargoCapacityM3: 120 });

    expect(sections.sameEndpointFiller[0]?.type).toBe("filler");
    expect(sections.alongTheWayDetourFiller[0]?.type).toBe("core");
    expect(sections.backhaulReturnLegFiller[0]?.type).toBe("loop_backhaul");
  });

  it("calculates incremental metrics", () => {
    const rows = [
      row({ TypeID: 1001, TypeName: "Anchor", TotalJumps: 2, Volume: 1, UnitsToBuy: 10, ExpectedProfit: 100000 }),
      row({ TypeID: 1002, TypeName: "Detour", TotalJumps: 5, Volume: 3, UnitsToBuy: 4, ExpectedProfit: 160000 }),
    ];

    const sections = buildRouteFillPlannerSections({ rows, pack: pack(), loops: [], cargoCapacityM3: 80 });
    const detour = sections.alongTheWayDetourFiller.find((entry) => entry.title === "Detour");
    expect(detour?.addedJumps).toBe(3);
    expect(detour?.addedM3).toBe(12);
    expect(detour?.incrementalProfitIsk).toBe(160000);
  });

  it("ranks suggestions deterministically", () => {
    const rows = [
      row({ TypeID: 1001, TypeName: "Anchor", ExpectedProfit: 100000 }),
      row({ TypeID: 1002, TypeName: "B", ExpectedProfit: 120000 }),
      row({ TypeID: 1003, TypeName: "A", ExpectedProfit: 120000 }),
    ];

    const sections = buildRouteFillPlannerSections({ rows, pack: pack(), loops: [], cargoCapacityM3: 120 });
    const orderedIds = sections.alongTheWayDetourFiller.map((entry) => entry.id);
    expect(orderedIds).toEqual([...orderedIds].sort((a, b) => a.localeCompare(b)));
  });
});
