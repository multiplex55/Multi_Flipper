import { describe, expect, it } from "vitest";
import {
  buildBatch,
  buildRouteBatchMetadata,
  buildRouteBatchMetadataByRow,
  routeGroupKey,
  routeLineKey,
  sameRoute,
  type RouteBatchMetadata,
} from "@/lib/batchMetrics";
import type { FlipResult } from "@/lib/types";
import { makeFlipResult as makeRow } from "@/lib/testFixtures";

function metadataFor(row: FlipResult, metadataByRow: Record<string, RouteBatchMetadata>) {
  return metadataByRow[
    [
      row.TypeID,
      Number(row.BuyLocationID ?? 0),
      Number(row.SellLocationID ?? 0),
      row.BuySystemID,
      row.SellSystemID,
    ].join(":")
  ];
}

describe("batchMetrics", () => {
  it("groups same-route by location IDs and falls back to system IDs", () => {
    const anchor = makeRow({ TypeID: 10, BuyLocationID: 11, SellLocationID: 22 });
    const sameLocation = makeRow({ TypeID: 20, BuyLocationID: 11, SellLocationID: 22 });
    const sameSystemFallback = makeRow({
      TypeID: 30,
      BuyLocationID: 0,
      SellLocationID: 0,
      BuySystemID: anchor.BuySystemID,
      SellSystemID: anchor.SellSystemID,
    });
    const differentRoute = makeRow({ TypeID: 40, BuyLocationID: 999, SellLocationID: 888 });

    expect(sameRoute(anchor, sameLocation)).toBe(true);
    expect(sameRoute(anchor, sameSystemFallback)).toBe(true);
    expect(sameRoute(anchor, differentRoute)).toBe(false);

    const batch = buildBatch(anchor, [anchor, sameLocation, sameSystemFallback, differentRoute], 1_000);
    const lineKeys = batch.lines.map((line) => routeLineKey(line.row));
    expect(lineKeys).not.toContain(routeLineKey(differentRoute));
  });

  it("prioritizes anchor inclusion before higher-density candidates", () => {
    const anchor = makeRow({ TypeID: 1, Volume: 5, ProfitPerUnit: 10, UnitsToBuy: 3 });
    const higherDensity = makeRow({ TypeID: 2, Volume: 1, ProfitPerUnit: 100, UnitsToBuy: 100 });

    const batch = buildBatch(anchor, [anchor, higherDensity], 10);
    expect(batch.lines[0].row.TypeID).toBe(anchor.TypeID);
    expect(batch.lines[0].units).toBe(2);
    expect(batch.lines).toHaveLength(1);
    expect(batch.totalVolume).toBe(10);
  });

  it("respects cargo-constrained selection", () => {
    const anchor = makeRow({ TypeID: 1, Volume: 5, ProfitPerUnit: 10, UnitsToBuy: 4 });
    const dense = makeRow({ TypeID: 2, Volume: 2, ProfitPerUnit: 30, UnitsToBuy: 10 });
    const medium = makeRow({ TypeID: 3, Volume: 3, ProfitPerUnit: 15, UnitsToBuy: 10 });

    const batch = buildBatch(anchor, [anchor, dense, medium], 14);
    expect(batch.totalVolume).toBeLessThanOrEqual(14);
    expect(batch.lines[0].row.TypeID).toBe(anchor.TypeID);
    expect(batch.lines.map((line) => line.row.TypeID)).toContain(dense.TypeID);
    expect(batch.remainingM3).toBe(0);
  });

  it("builds route metadata correctly across normal and edge rows, excluding invalid candidates", () => {
    const normal = makeRow({ TypeID: 1, Volume: 2, ProfitPerUnit: 20, UnitsToBuy: 10, ExpectedBuyPrice: 100 });
    const fallbackProfit = makeRow({
      TypeID: 2,
      RealProfit: 100,
      FilledQty: 0,
      ProfitPerUnit: 5,
      Volume: 1,
      UnitsToBuy: 4,
      ExpectedBuyPrice: 90,
    });
    const invalidVolume = makeRow({ TypeID: 3, Volume: 0, ProfitPerUnit: 200, UnitsToBuy: 3 });
    const nonPositiveProfit = makeRow({ TypeID: 4, Volume: 3, ProfitPerUnit: 0, UnitsToBuy: 3 });
    const duplicateLowDensity = makeRow({ TypeID: 5, Volume: 2, ProfitPerUnit: 10, UnitsToBuy: 3 });
    const duplicateHighDensity = makeRow({ TypeID: 5, Volume: 2, ProfitPerUnit: 40, UnitsToBuy: 3 });

    const rows = [
      normal,
      fallbackProfit,
      invalidVolume,
      nonPositiveProfit,
      duplicateLowDensity,
      duplicateHighDensity,
    ];
    const metadataByRow = buildRouteBatchMetadataByRow(rows, 1_000);
    const normalMeta = metadataFor(normal, metadataByRow);

    expect(normalMeta.batchNumber).toBe(3);
    expect(normalMeta.batchProfit).toBe(340);
    expect(normalMeta.batchTotalCapital).toBe(1_660);
    expect(normalMeta.batchIskPerJump).toBe(170);

    const invalidMeta = metadataFor(invalidVolume, metadataByRow);
    const nonPositiveMeta = metadataFor(nonPositiveProfit, metadataByRow);
    expect(invalidMeta.batchNumber).toBe(3);
    expect(nonPositiveMeta.batchNumber).toBe(3);
    expect(invalidMeta.batchIskPerJump).toBe(normalMeta.batchIskPerJump);
    expect(nonPositiveMeta.batchIskPerJump).toBe(normalMeta.batchIskPerJump);

    const batchFromNormal = buildBatch(normal, rows, 1_000);
    expect(batchFromNormal.lines.map((line) => line.row.TypeID)).toEqual([1, 5, 2]);
    const duplicateLine = batchFromNormal.lines.find((line) => line.row.TypeID === 5);
    expect(duplicateLine?.profit).toBe(120);
  });

  it("populates batchIskPerJump using stable route jumps fallback", () => {
    const routeAnchor = makeRow({ TypeID: 10, TotalJumps: 8, ProfitPerUnit: 40, UnitsToBuy: 5 });
    const sameRouteMissingJumps = makeRow({
      TypeID: 11,
      BuyLocationID: routeAnchor.BuyLocationID,
      SellLocationID: routeAnchor.SellLocationID,
      TotalJumps: undefined,
      ProfitPerUnit: 20,
      UnitsToBuy: 5,
    });
    const sameRouteZeroJumps = makeRow({
      TypeID: 12,
      BuyLocationID: routeAnchor.BuyLocationID,
      SellLocationID: routeAnchor.SellLocationID,
      TotalJumps: 0,
      ProfitPerUnit: 10,
      UnitsToBuy: 5,
    });

    const metadataByRow = buildRouteBatchMetadataByRow(
      [routeAnchor, sameRouteMissingJumps, sameRouteZeroJumps],
      1_000,
    );

    const anchorMeta = metadataFor(routeAnchor, metadataByRow);
    const missingMeta = metadataFor(sameRouteMissingJumps, metadataByRow);
    const zeroMeta = metadataFor(sameRouteZeroJumps, metadataByRow);
    expect(anchorMeta.batchIskPerJump).toBe(43.75);
    expect(missingMeta.batchIskPerJump).toBe(anchorMeta.batchIskPerJump);
    expect(zeroMeta.batchIskPerJump).toBe(anchorMeta.batchIskPerJump);
  });

  it("aggregates route-pack metrics for mixed routes with location->system fallback keys", () => {
    const routeA1 = makeRow({
      TypeID: 2001,
      BuyLocationID: 0,
      SellLocationID: 0,
      BuySystemID: 30001001,
      SellSystemID: 30001002,
      RealProfit: 120,
      TotalJumps: 3,
      SlippageBuyPct: 2,
      SlippageSellPct: 1,
      UnitsToBuy: 10,
    });
    const routeA2 = makeRow({
      TypeID: 2002,
      BuyLocationID: 0,
      SellLocationID: 0,
      BuySystemID: routeA1.BuySystemID,
      SellSystemID: routeA1.SellSystemID,
      RealProfit: 150,
      DailyProfit: 90,
      SlippageBuyPct: 4,
      SlippageSellPct: 2,
      UnitsToBuy: 5,
      HistoryAvailable: false,
    });
    const routeB = makeRow({
      TypeID: 3001,
      BuyLocationID: 900001,
      SellLocationID: 900002,
      BuySystemID: routeA1.BuySystemID,
      SellSystemID: routeA1.SellSystemID,
      RealProfit: 999,
    });
    const { byRoute } = buildRouteBatchMetadata([routeA1, routeA2, routeB], 1_000);

    const routeAKey = routeGroupKey(routeA1);
    const routeBKey = routeGroupKey(routeB);
    expect(routeAKey).toBe("sys:30001001->sys:30001002");
    expect(routeBKey).toBe("loc:900001->loc:900002");
    expect(routeAKey).not.toBe(routeBKey);

    expect(byRoute[routeAKey].routeItemCount).toBe(2);
    expect(byRoute[routeAKey].routeWeightedSlippagePct).toBeCloseTo(4, 6);
    expect(byRoute[routeAKey].routeRealIskPerJump).toBeCloseTo(115, 6);
    expect(byRoute[routeAKey].routeDailyIskPerJump).toBeCloseTo(33.3333333, 5);
    expect(byRoute[routeAKey].routeRealIskPerM3PerJump).toBeGreaterThan(0);
    expect(byRoute[routeAKey].routeDailyProfit).toBeGreaterThan(0);
    expect(byRoute[routeAKey].routeDailyProfitOverCapital).toBeGreaterThanOrEqual(0);
    expect(byRoute[routeAKey].routeExitOverhangDays).toBeGreaterThanOrEqual(0);
    expect(byRoute[routeAKey].routeBreakevenBuffer).toBeGreaterThanOrEqual(0);
    expect(byRoute[routeAKey].routeRiskNoHistoryCount).toBeGreaterThanOrEqual(0);
    expect(byRoute[routeBKey].routeItemCount).toBe(1);
  });

  it("regresses route-pack ranking when weakest execution quality uses requested pre-execution units", () => {
    const routeTrimmedLooksPerfect = makeRow({
      TypeID: 4001,
      BuyLocationID: 1001,
      SellLocationID: 2001,
      BuySystemID: 31000001,
      SellSystemID: 31000002,
      PreExecutionUnits: 100,
      UnitsToBuy: 60,
      FilledQty: 60,
      BuyOrderRemain: 60,
      SellOrderRemain: 60,
      SlippageBuyPct: 0,
      SlippageSellPct: 0,
      DayTargetPeriodPrice: 120,
    });
    const routeActuallyPerfect = makeRow({
      TypeID: 4002,
      BuyLocationID: 1002,
      SellLocationID: 2002,
      BuySystemID: 32000001,
      SellSystemID: 32000002,
      PreExecutionUnits: 60,
      UnitsToBuy: 60,
      FilledQty: 60,
      BuyOrderRemain: 60,
      SellOrderRemain: 60,
      SlippageBuyPct: 0,
      SlippageSellPct: 0,
      DayTargetPeriodPrice: 120,
    });

    const { byRoute } = buildRouteBatchMetadata([routeTrimmedLooksPerfect, routeActuallyPerfect], 1_000);
    const rankedRouteKeys = Object.entries(byRoute)
      .sort((a, b) => b[1].routeWeakestExecutionQuality - a[1].routeWeakestExecutionQuality)
      .map(([key]) => key);

    expect(byRoute[routeGroupKey(routeTrimmedLooksPerfect)].routeWeakestExecutionQuality).toBeLessThan(100);
    expect(byRoute[routeGroupKey(routeActuallyPerfect)].routeWeakestExecutionQuality).toBe(100);
    expect(rankedRouteKeys[0]).toBe(routeGroupKey(routeActuallyPerfect));
  });

  it("computes primary route-pack summary from selected pack lines only and keeps route-universe context separate", () => {
    const selectedAnchor = makeRow({
      TypeID: 5101,
      BuyLocationID: 1501,
      SellLocationID: 2501,
      BuySystemID: 35000001,
      SellSystemID: 35000002,
      Volume: 30,
      UnitsToBuy: 1,
      ProfitPerUnit: 100,
      ExpectedBuyPrice: 120,
      SlippageBuyPct: 2,
      SlippageSellPct: 1,
      DayTargetPeriodPrice: 130,
      DayTargetNowPrice: 132,
      FilledQty: 1,
      PreExecutionUnits: 1,
      DailyProfit: 40,
      DailyVolume: 100,
      TotalJumps: 2,
    });
    const excludedStable = makeRow({
      TypeID: 5102,
      BuyLocationID: selectedAnchor.BuyLocationID,
      SellLocationID: selectedAnchor.SellLocationID,
      BuySystemID: selectedAnchor.BuySystemID,
      SellSystemID: selectedAnchor.SellSystemID,
      Volume: 25,
      UnitsToBuy: 1,
      ProfitPerUnit: 80,
      ExpectedBuyPrice: 90,
      SlippageBuyPct: 11,
      SlippageSellPct: 8,
      DayTargetPeriodPrice: 125,
      DayTargetNowPrice: 126,
      FilledQty: 1,
      PreExecutionUnits: 1,
      DailyProfit: 15,
      DailyVolume: 20,
      TotalJumps: 2,
    });
    const excludedRisky = makeRow({
      TypeID: 5103,
      BuyLocationID: selectedAnchor.BuyLocationID,
      SellLocationID: selectedAnchor.SellLocationID,
      BuySystemID: selectedAnchor.BuySystemID,
      SellSystemID: selectedAnchor.SellSystemID,
      Volume: 25,
      UnitsToBuy: 1,
      ProfitPerUnit: 30,
      ExpectedBuyPrice: 70,
      SlippageBuyPct: 20,
      SlippageSellPct: 15,
      DayNowProfit: 30,
      DayPeriodProfit: -10,
      DayPriceHistory: [],
      DayTargetPeriodPrice: 0,
      HistoryAvailable: false,
      FilledQty: 0,
      PreExecutionUnits: 1,
      DailyProfit: 8,
      DailyVolume: 5,
      TotalJumps: 2,
    });

    const { byRoute } = buildRouteBatchMetadata(
      [selectedAnchor, excludedStable, excludedRisky],
      40,
    );
    const meta = byRoute[routeGroupKey(selectedAnchor)];

    // Primary summary must only use selected pack lines (selectedAnchor only under 40 m3).
    expect(meta.routeItemCount).toBe(1);
    expect(meta.routeTotalProfit).toBe(100);
    expect(meta.routeTotalCapital).toBe(120);
    expect(meta.routeTotalVolume).toBe(30);
    expect(meta.routeWeightedSlippagePct).toBe(3);
    expect(meta.routeWeakestExecutionQuality).toBeGreaterThan(95);
    expect(meta.routeDailyProfit).toBe(40);
    expect(meta.routeDailyProfitOverCapital).toBeCloseTo((40 / 120) * 100, 6);

    // Risk counts in primary summary ignore excluded rows.
    expect(meta.routeRiskSpikeCount).toBe(0);
    expect(meta.routeRiskNoHistoryCount).toBe(0);
    expect(meta.routeRiskUnstableHistoryCount).toBe(0);
    expect(meta.routeRiskThinFillCount).toBe(0);

    // Optional route-universe context is separated and does not change primary numbers.
    expect(meta.routeUniverseCandidateItemCount).toBe(3);
    expect(meta.routeUniverseExcludedItemCount).toBe(2);
    expect(meta.routeUniverseWarningCount).toBeGreaterThan(0);
    expect(meta.routeTotalProfit).toBe(100);
    expect(meta.routeWeightedSlippagePct).toBe(3);
  });

  it("regression: best-route-pack quality ranking must not be penalized by excluded universe lines", () => {
    const routeASelected = makeRow({
      TypeID: 5201,
      BuyLocationID: 1601,
      SellLocationID: 2601,
      BuySystemID: 36000001,
      SellSystemID: 36000002,
      Volume: 30,
      UnitsToBuy: 1,
      ProfitPerUnit: 80,
      FilledQty: 1,
      PreExecutionUnits: 1,
      DayTargetPeriodPrice: 100,
      DayTargetNowPrice: 100,
    });
    const routeAExcludedBad = makeRow({
      TypeID: 5202,
      BuyLocationID: routeASelected.BuyLocationID,
      SellLocationID: routeASelected.SellLocationID,
      BuySystemID: routeASelected.BuySystemID,
      SellSystemID: routeASelected.SellSystemID,
      Volume: 25,
      UnitsToBuy: 1,
      ProfitPerUnit: 20,
      FilledQty: 0,
      PreExecutionUnits: 1,
      SlippageBuyPct: 25,
      SlippageSellPct: 25,
      DayNowProfit: 10,
      DayPeriodProfit: -10,
      DayTargetPeriodPrice: 0,
      DayPriceHistory: [],
      HistoryAvailable: false,
    });
    const routeBSelected = makeRow({
      TypeID: 5301,
      BuyLocationID: 1602,
      SellLocationID: 2602,
      BuySystemID: 36000003,
      SellSystemID: 36000004,
      Volume: 30,
      UnitsToBuy: 1,
      ProfitPerUnit: 70,
      FilledQty: 1,
      PreExecutionUnits: 1,
      DayTargetPeriodPrice: 100,
      DayTargetNowPrice: 130, // stable=false but still selected
    });

    const { byRoute } = buildRouteBatchMetadata(
      [routeASelected, routeAExcludedBad, routeBSelected],
      40,
    );
    const rankedRouteKeys = Object.entries(byRoute)
      .sort((a, b) => b[1].routeWeakestExecutionQuality - a[1].routeWeakestExecutionQuality)
      .map(([key]) => key);

    expect(byRoute[routeGroupKey(routeASelected)].routeItemCount).toBe(1);
    expect(byRoute[routeGroupKey(routeASelected)].routeWeakestExecutionQuality).toBeGreaterThan(
      byRoute[routeGroupKey(routeBSelected)].routeWeakestExecutionQuality,
    );
    expect(rankedRouteKeys[0]).toBe(routeGroupKey(routeASelected));
  });

  it("sets route aggregate derived metrics to null when required inputs are missing", () => {
    const noJumpsNoCapital = makeRow({
      TypeID: 9001,
      TotalJumps: 0,
      DailyProfit: 10,
      UnitsToBuy: 0,
      FilledQty: 0,
      ProfitPerUnit: 5,
      ExpectedBuyPrice: 0,
      BuyPrice: 0,
      Volume: 0,
      DayCapitalRequired: 0,
      DayTargetPeriodPrice: 0,
      DayPriceHistory: [],
      HistoryAvailable: false,
    });

    const meta = buildRouteBatchMetadata([noJumpsNoCapital], 1_000).byRoute[
      routeGroupKey(noJumpsNoCapital)
    ];
    expect(meta.routeDailyProfit).toBe(0);
    expect(meta.routeDailyProfitOverCapital).toBeNull();
    expect(meta.routeTurnoverDays).toBeNull();
    expect(meta.routeExitOverhangDays).toBeNull();
    expect(meta.routeBreakevenBuffer).toBeNull();
  });

  it("computes route profit concentration for dominant/even lines and nulls on zero-or-negative totals", () => {
    const concentratedA = makeRow({
      TypeID: 8001,
      BuyLocationID: 880001,
      SellLocationID: 880002,
      ProfitPerUnit: 40,
      UnitsToBuy: 10,
      Volume: 1,
    });
    const concentratedB = makeRow({
      TypeID: 8002,
      BuyLocationID: concentratedA.BuyLocationID,
      SellLocationID: concentratedA.SellLocationID,
      ProfitPerUnit: 20,
      UnitsToBuy: 10,
      Volume: 1,
    });
    const positiveMeta = buildRouteBatchMetadataByRow([concentratedA, concentratedB], 1_000);
    const concentration = metadataFor(concentratedA, positiveMeta).routeProfitConcentrationPct;
    expect(concentration).toBeCloseTo((400 / 600) * 100, 6);

    const equalA = makeRow({
      TypeID: 8003,
      BuyLocationID: 881001,
      SellLocationID: 881002,
      ProfitPerUnit: 30,
      UnitsToBuy: 10,
      Volume: 1,
    });
    const equalB = makeRow({
      TypeID: 8004,
      BuyLocationID: equalA.BuyLocationID,
      SellLocationID: equalA.SellLocationID,
      ProfitPerUnit: 30,
      UnitsToBuy: 10,
      Volume: 1,
    });
    const equalMeta = buildRouteBatchMetadataByRow([equalA, equalB], 1_000);
    expect(metadataFor(equalA, equalMeta).routeProfitConcentrationPct).toBeCloseTo(50, 6);

    const zero = makeRow({
      TypeID: 8100,
      BuyLocationID: 889001,
      SellLocationID: 889002,
      ProfitPerUnit: 0,
      UnitsToBuy: 10,
    });
    const negative = makeRow({
      TypeID: 8101,
      BuyLocationID: 890001,
      SellLocationID: 890002,
      ProfitPerUnit: -10,
      UnitsToBuy: 10,
    });
    const zeroMeta = buildRouteBatchMetadataByRow([zero], 1_000);
    const negativeMeta = buildRouteBatchMetadataByRow([negative], 1_000);
    expect(metadataFor(zero, zeroMeta).routeProfitConcentrationPct).toBeNull();
    expect(metadataFor(negative, negativeMeta).routeProfitConcentrationPct).toBeNull();
  });

  it("keeps zero-volume rows from breaking fill percent and divide-by-zero aggregates", () => {
    const zero = makeRow({ TypeID: 9001, Volume: 0, UnitsToBuy: 50, ProfitPerUnit: 100, ExpectedBuyPrice: 10, TotalJumps: 4 });
    const { byRoute } = buildRouteBatchMetadata([zero], 1_000);
    const meta = byRoute[routeGroupKey(zero)];
    expect(meta.routeCapacityUsedPercent).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(meta.routeRealIskPerM3PerJump)).toBe(true);
    expect(Number.isFinite(meta.routeDailyIskPerJump)).toBe(true);
  });

});
