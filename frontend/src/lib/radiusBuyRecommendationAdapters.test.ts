import { describe, expect, it } from "vitest";
import { recommendationFromRejectedCargoBuild, recommendationFromRouteBatch, recommendationFromSingleRow } from "@/lib/radiusBuyRecommendationAdapters";
import { makeFlipResult } from "@/lib/testFixtures";

const rowA = makeFlipResult({ TypeID: 1, UnitsToBuy: 10, Volume: 2, TotalJumps: 4, ExpectedBuyPrice: 100, ExpectedSellPrice: 150, RealProfit: 500 });
const rowB = makeFlipResult({ TypeID: 2, UnitsToBuy: 5, Volume: 1, TotalJumps: 4, ExpectedBuyPrice: 200, ExpectedSellPrice: 260, RealProfit: 300 });

describe("radiusBuyRecommendationAdapters", () => {
  it("maps route batch with package-level metrics and exact rows", () => {
    const rec = recommendationFromRouteBatch("r", [rowA], {
      batchNumber: 1,
      batchProfit: 500,
      batchTotalCapital: 1000,
      batchIskPerJump: 125,
      routeItemCount: 1,
      routeTotalProfit: 500,
      routeTotalCapital: 1000,
      routeTotalVolume: 20,
      routeCapacityUsedPercent: 50,
      routeRealIskPerJump: 125,
      routeDailyIskPerJump: 0,
      routeRealIskPerM3PerJump: 0,
      routeDailyProfit: 0,
      routeDailyProfitOverCapital: null,
      routeWeightedSlippagePct: 0,
      routeWeakestExecutionQuality: 0,
      routeTurnoverDays: null,
      routeExitOverhangDays: null,
      routeBreakevenBuffer: null,
      routeRiskSpikeCount: 0,
      routeRiskNoHistoryCount: 0,
      routeRiskUnstableHistoryCount: 0,
      routeRiskThinFillCount: 0,
      routeUniverseCandidateItemCount: 1,
      routeUniverseExcludedItemCount: 0,
      routeUniverseWarningCount: 0,
      routeStopCount: 2,
      routeBuyStopCount: 1,
      routeSellStopCount: 1,
      routeWorstFillConfidencePct: 100,
      routeAverageFillConfidencePct: 100,
      routeProfitConcentrationPct: null,
      routeRemainingCargoM3: 20,
      routeComplexity: "Clean",
    }, 40, {});
    expect(rec.lines).toHaveLength(1);
    expect(rec.totalVolumeM3).toBe(20);
    expect(rec.cargoUsedPercent).toBe(50);
    expect(rec.batchProfitIsk).toBe(500);
  });

  it("keeps rejected cargo build near-miss lines only", () => {
    const rec = recommendationFromRejectedCargoBuild({ routeKey: "r", routeLabel: "r", rows: [rowA, rowB], lines: [{ row: rowB, units: 5 }], totalProfitIsk: 1, totalCapitalIsk: 1, totalVolumeM3: 1, totalGrossSellIsk: 1, blockers: [] } as never, {});
    expect(rec.lines).toHaveLength(1);
    expect(rec.lines[0].typeId).toBe(2);
  });

  it("single row recommendation has one line", () => {
    const rec = recommendationFromSingleRow(rowA, {});
    expect(rec.lines).toHaveLength(1);
  });
});
