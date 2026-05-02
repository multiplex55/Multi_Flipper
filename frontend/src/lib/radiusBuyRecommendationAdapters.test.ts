import { describe, expect, it } from "vitest";
import { recommendationFromRejectedCargoBuild, recommendationFromRouteBatch, recommendationFromSingleRow } from "@/lib/radiusBuyRecommendationAdapters";
import { buildBatch, routeLineKey } from "@/lib/batchMetrics";
import { makeFlipResult } from "@/lib/testFixtures";

const rowA = makeFlipResult({ TypeID: 1, UnitsToBuy: 10, Volume: 2, TotalJumps: 4, ExpectedBuyPrice: 100, ExpectedSellPrice: 150, RealProfit: 500 });
const rowB = makeFlipResult({ TypeID: 2, UnitsToBuy: 5, Volume: 1, TotalJumps: 4, ExpectedBuyPrice: 200, ExpectedSellPrice: 260, RealProfit: 300 });

describe("radiusBuyRecommendationAdapters", () => {
  it("maps route batch from batch builder lines and package totals", () => {
    const rows = [rowA, rowB];
    const rec = recommendationFromRouteBatch({ routeKey: "r", rows, metadata: {
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
    }, cargoCapacityM3: 10 }, {});
    const expected = buildBatch(rows[0], rows, 10);
    expect(rec.lines).toHaveLength(expected.lines.length);
    expect(rec.selectedLineKeys).toEqual(rec.lines.map((line) => routeLineKey(line.row!)));
    expect(rec.totalVolumeM3).toBe(expected.totalVolume);
    expect(rec.batchProfitIsk).toBe(expected.totalProfit);
    expect(rec.batchCapitalIsk).toBe(expected.totalCapital);
    expect(rec.batchGrossSellIsk).toBe(expected.totalGrossSell);
    expect(rec.totalVolumeM3).toBeLessThanOrEqual(10);
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


it("includes zero-volume lines with zero cargo impact", () => {
  const zero = makeFlipResult({ TypeID: 3, UnitsToBuy: 10, Volume: 0, ExpectedBuyPrice: 10, ExpectedSellPrice: 15, RealProfit: 50 });
  const rec = recommendationFromRouteBatch({ routeKey: "r", rows: [zero], cargoCapacityM3: 5 }, {});
  expect(rec.lines).toHaveLength(1);
  expect(rec.lines[0].volumeM3).toBe(0);
  expect(rec.lines[0].qty).toBeGreaterThan(0);
  expect(rec.totalVolumeM3).toBe(0);
  expect(rec.cargoUsedPercent).toBe(0);
  expect(rec.batchProfitIsk).toBeGreaterThan(0);
});
