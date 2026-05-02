import { describe, expect, it } from "vitest";
import { buildRadiusDecisionQueue } from "@/lib/radiusDecisionQueue";
import { makeFlipResult } from "@/lib/testFixtures";

const row = (o = {}) => makeFlipResult({ TypeID: 1, TypeName: "A", BuyPrice: 100, SellPrice: 140, ExpectedBuyPrice: 100, ExpectedSellPrice: 140, ProfitPerUnit: 40, UnitsToBuy: 10, Volume: 1, TotalJumps: 4, ...o });

describe("radiusDecisionQueue", () => {
  it("uses package-level metrics and preserves ranking against single-row heuristics", () => {
    const strongRouteRow = row({ TypeID: 20, RealProfit: 50_000_000, ExpectedBuyPrice: 200_000_000, UnitsToBuy: 1 });
    const flashySingle = row({ TypeID: 99, RealProfit: 2_000_000, ExpectedBuyPrice: 1_000_000, UnitsToBuy: 1 });
    const out = buildRadiusDecisionQueue({
      routeRowsByKey: { r1: [strongRouteRow] },
      routeBatchMetadataByRoute: { r1: { routeTotalProfit: 50_000_000, routeTotalCapital: 200_000_000, routeTotalVolume: 200, routeCapacityUsedPercent: 80, routeRemainingCargoM3: 50, routeRealIskPerJump: 12_500_000 } as never },
      cargoCapacityM3: 250,
      singleRowCandidates: [flashySingle],
    });
    const routeItem = out.queue.find((q) => q.id.includes("route:r1"));
    const singleItem = out.queue.find((q) => q.id.includes("row:99"));
    expect(routeItem).toBeTruthy();
    expect(singleItem).toBeTruthy();
    expect((routeItem?.score ?? 0)).toBeGreaterThan(singleItem?.score ?? 0);
    expect(out.queue[0].totalVolumeM3).toBe(200);
    expect(out.queue[0].batchProfitIsk).toBe(50_000_000);
  });

  it("maps rejected near-miss actions away from buy", () => {
    const out = buildRadiusDecisionQueue({ rejectedCargoBuilds: [{ routeKey: "r", rows: [row()], lines: [{ row: row({TypeID:7}), units: 2 }], totalProfitIsk: 1000, totalCapitalIsk: 1000, totalVolumeM3: 1, totalGrossSellIsk: 2000, blockers: [{ kind: "cargo", message: "trim" }] } as never] });
    expect(out.queue[0].action).not.toBe("buy");
    expect(out.queue[0].lines).toHaveLength(1);
  });
});
