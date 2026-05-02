import { describe, expect, it } from "vitest";
import { buildRadiusDecisionQueue } from "@/lib/radiusDecisionQueue";
import { makeFlipResult } from "@/lib/testFixtures";

const row = (o = {}) => makeFlipResult({ TypeID: 1, TypeName: "A", BuyPrice: 100, SellPrice: 140, ExpectedBuyPrice: 100, ExpectedSellPrice: 140, ProfitPerUnit: 40, UnitsToBuy: 10, Volume: 1, TotalJumps: 4, ...o });

describe("radiusDecisionQueue", () => {
  it("supports mode-specific ordering and long-haul competitiveness", () => {
    const longGood = row({ TypeID: 70, TotalJumps: 55, RealProfit: 600_000_000, ExpectedBuyPrice: 900_000_000, UnitsToBuy: 1, CargoPercent: 65, RealIskPerJump: 10_900_000 });
    const shortOkay = row({ TypeID: 71, TotalJumps: 8, RealProfit: 120_000_000, ExpectedBuyPrice: 300_000_000, UnitsToBuy: 1, CargoPercent: 40, RealIskPerJump: 6_000_000 });
    const out = buildRadiusDecisionQueue({
      mode: "long_haul_worth",
      routeRowsByKey: { long: [longGood], short: [shortOkay] },
      routeBatchMetadataByRoute: {
        long: { routeTotalProfit: 600_000_000, routeTotalCapital: 900_000_000, routeTotalVolume: 1_000, routeCapacityUsedPercent: 65, routeRemainingCargoM3: 500, routeRealIskPerJump: 10_900_000 } as never,
        short: { routeTotalProfit: 120_000_000, routeTotalCapital: 300_000_000, routeTotalVolume: 500, routeCapacityUsedPercent: 40, routeRemainingCargoM3: 400, routeRealIskPerJump: 6_000_000 } as never,
      },
      cargoCapacityM3: 1500,
    });
    expect(out.queue[0].id).toContain("route:long");
    expect(out.queue[0].haulWorthiness.label).toBe("long_worth_it");
    expect(out.queue[0].scoreBreakdown.positive.longHaulWorth).toBeGreaterThan(0.9);
  });
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
    expect(out.queue[0].scoreBreakdown.positive.profit).toBeGreaterThan(0);
  });

  it("maps rejected near-miss actions away from buy", () => {
    const out = buildRadiusDecisionQueue({ rejectedCargoBuilds: [{ routeKey: "r", rows: [row()], lines: [{ row: row({TypeID:7}), units: 2 }], totalProfitIsk: 1000, totalCapitalIsk: 1000, totalVolumeM3: 1, totalGrossSellIsk: 2000, blockers: [{ kind: "cargo", message: "trim" }] } as never] });
    expect(out.queue[0].action).not.toBe("buy");
    expect(out.queue[0].lines).toHaveLength(1);
  });

  it("scores mixed zero/non-zero volume package without NaN/Infinity cargo efficiency", () => {
    const out = buildRadiusDecisionQueue({
      cargoBuilds: [
        {
          id: "cb-1",
          routeKey: "r",
          routeLabel: "r",
          rowCount: 2,
          totalProfitIsk: 10_000,
          totalCapitalIsk: 50_000,
          totalCargoM3: 5,
          totalGrossSellIsk: 60_000,
          jumps: 5,
          iskPerJump: 2_000,
          jumpEfficiency: 0.5,
          capitalEfficiency: 0.2,
          cargoFillPercent: 10,
          confidencePercent: 80,
          executionQuality: 75,
          riskCount: 0,
          riskRate: 0,
          riskCue: "low",
          executionCue: "smooth",
          finalScore: 50,
          rows: [row({ TypeID: 501, Volume: 0 }), row({ TypeID: 502, Volume: 1 })],
          lines: [
            { row: row({ TypeID: 501, Volume: 0 }), units: 10, volumeM3: 0, capitalIsk: 10_000, profitIsk: 2_000, grossSellIsk: 12_000, partial: false },
            { row: row({ TypeID: 502, Volume: 1 }), units: 5, volumeM3: 5, capitalIsk: 40_000, profitIsk: 8_000, grossSellIsk: 48_000, partial: false },
          ],
        } as never,
      ],
    });
    expect(out.queue).toHaveLength(1);
    expect(Number.isFinite(out.queue[0].scoreBreakdown.positive.cargoEfficiency)).toBe(true);
  });

  it("prioritizes verified profitable recs over failed recs", () => {
    const base = {
      routeTotalProfit: 200_000_000,
      routeTotalCapital: 500_000_000,
      routeTotalVolume: 200,
      routeCapacityUsedPercent: 60,
      routeRemainingCargoM3: 100,
      routeRealIskPerJump: 8_000_000,
    };
    const out = buildRadiusDecisionQueue({
      routeRowsByKey: {
        verified: [row({ TypeID: 101, RealProfit: 200_000_000 })],
        failed: [row({ TypeID: 102, RealProfit: 200_000_000 })],
      },
      routeBatchMetadataByRoute: { verified: { ...base, verificationState: { status: "verified", checkedAt: new Date(Date.now() - 120_000).toISOString() } }, failed: { ...base, verificationState: { status: "failed", failedLineCount: 2, profitDeltaIsk: -10_000_000 } } } as never,
      cargoCapacityM3: 500,
    });
    const verifiedIdx = out.queue.findIndex((q) => q.id.includes("route:verified"));
    const failedIdx = out.queue.findIndex((q) => q.id.includes("route:failed"));
    expect(verifiedIdx).toBeGreaterThanOrEqual(0);
    expect(failedIdx).toBeGreaterThanOrEqual(0);
    expect(verifiedIdx).toBeLessThan(failedIdx);
  });
});
