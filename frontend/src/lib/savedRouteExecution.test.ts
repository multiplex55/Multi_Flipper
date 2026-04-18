import { describe, expect, it } from "vitest";
import {
  deriveExecutionSummary,
  markLineBought,
  markLineSkipped,
  markLineSold,
  resetLineState,
} from "@/lib/savedRouteExecution";
import type { SavedRoutePack } from "@/lib/types";

function makePack(): SavedRoutePack {
  return {
    routeKey: "loc:1->loc:2",
    routeLabel: "Jita → Amarr",
    buyLocationId: 1,
    sellLocationId: 2,
    buySystemId: 30000142,
    sellSystemId: 30002187,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastVerifiedAt: null,
    entryMode: "core",
    launchIntent: null,
    selectedLineKeys: ["100:1:2", "200:1:2"],
    excludedLineKeys: [],
    summarySnapshot: {
      routeItemCount: 2,
      routeTotalProfit: 700,
      routeTotalCapital: 3000,
      routeRealIskPerJump: 0,
      routeDailyIskPerJump: 0,
      routeDailyProfit: 0,
      routeWeightedSlippagePct: 0,
      routeTurnoverDays: null,
      routeSafetyRank: null,
    },
    lines: {
      "100:1:2": {
        lineKey: "100:1:2",
        typeId: 100,
        typeName: "Item A",
        plannedQty: 10,
        plannedBuyPrice: 100,
        plannedSellPrice: 130,
        plannedProfit: 300,
        plannedVolume: 20,
        boughtQty: 0,
        boughtTotal: 0,
        soldQty: 0,
        soldTotal: 0,
        remainingQty: 10,
        status: "planned",
        skipReason: null,
        notes: "",
      },
      "200:1:2": {
        lineKey: "200:1:2",
        typeId: 200,
        typeName: "Item B",
        plannedQty: 20,
        plannedBuyPrice: 50,
        plannedSellPrice: 70,
        plannedProfit: 400,
        plannedVolume: 10,
        boughtQty: 0,
        boughtTotal: 0,
        soldQty: 0,
        soldTotal: 0,
        remainingQty: 20,
        status: "planned",
        skipReason: null,
        notes: "",
      },
    },
    manifestSnapshot: null,
    verificationSnapshot: null,
    notes: "",
    tags: [],
    status: "active",
  };
}

describe("savedRouteExecution", () => {
  it("bought -> partial -> sold transitions", () => {
    const pack0 = makePack();
    const pack1 = markLineBought(pack0, pack0.routeKey, "100:1:2", 10, 1000);
    expect(pack1.lines["100:1:2"].status).toBe("bought");

    const pack2 = markLineSold(pack1, pack1.routeKey, "100:1:2", 4, 520);
    expect(pack2.lines["100:1:2"].status).toBe("partially_sold");
    expect(pack2.lines["100:1:2"].remainingQty).toBe(6);

    const pack3 = markLineSold(pack2, pack2.routeKey, "100:1:2", 6, 780);
    expect(pack3.lines["100:1:2"].status).toBe("completed");
    expect(pack3.lines["100:1:2"].soldQty).toBe(10);
  });

  it("skip/reset transitions", () => {
    const pack1 = markLineSkipped(makePack(), "loc:1->loc:2", "100:1:2", "too thin");
    expect(pack1.lines["100:1:2"].status).toBe("skipped");
    expect(pack1.lines["100:1:2"].skipReason).toBe("too thin");

    const pack2 = resetLineState(pack1, "loc:1->loc:2", "100:1:2");
    expect(pack2.lines["100:1:2"].status).toBe("planned");
    expect(pack2.lines["100:1:2"].boughtQty).toBe(0);
    expect(pack2.lines["100:1:2"].skipReason).toBeNull();
  });

  it("qty clamping and invalid input handling", () => {
    const pack0 = makePack();
    const unchanged = markLineBought(pack0, pack0.routeKey, "100:1:2", -1, 10);
    expect(unchanged).toBe(pack0);

    const pack1 = markLineBought(pack0, pack0.routeKey, "100:1:2", 99, 9900);
    expect(pack1.lines["100:1:2"].boughtQty).toBe(10);

    const pack2 = markLineSold(pack1, pack1.routeKey, "100:1:2", 20, 2600);
    expect(pack2.lines["100:1:2"].soldQty).toBe(10);
  });

  it("derived summary correctness with mixed line states", () => {
    let pack = makePack();
    pack = markLineBought(pack, pack.routeKey, "100:1:2", 10, 1000);
    pack = markLineSold(pack, pack.routeKey, "100:1:2", 10, 1300);
    pack = markLineSkipped(pack, pack.routeKey, "200:1:2", "manual");

    const summary = deriveExecutionSummary(pack);
    expect(summary.completedCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(summary.completionPct).toBe(100);
    expect(summary.realizedProfit).toBe(300);
    expect(summary.boughtPlannedRatio).toBeCloseTo(10 / 30, 6);
    expect(summary.soldBoughtRatio).toBe(1);
  });
});
