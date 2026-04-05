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

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: overrides.TypeID ?? 1,
    TypeName: overrides.TypeName ?? `Type ${overrides.TypeID ?? 1}`,
    Volume: overrides.Volume ?? 2,
    BuyPrice: overrides.BuyPrice ?? 100,
    BuyStation: overrides.BuyStation ?? "Buy",
    BuySystemName: overrides.BuySystemName ?? "BuySys",
    BuySystemID: overrides.BuySystemID ?? 300001,
    BuyLocationID: overrides.BuyLocationID ?? 600001,
    SellPrice: overrides.SellPrice ?? 130,
    SellStation: overrides.SellStation ?? "Sell",
    SellSystemName: overrides.SellSystemName ?? "SellSys",
    SellSystemID: overrides.SellSystemID ?? 300002,
    SellLocationID: overrides.SellLocationID ?? 600002,
    ProfitPerUnit: overrides.ProfitPerUnit ?? 20,
    MarginPercent: overrides.MarginPercent ?? 20,
    UnitsToBuy: overrides.UnitsToBuy ?? 10,
    BuyOrderRemain: overrides.BuyOrderRemain ?? 10,
    SellOrderRemain: overrides.SellOrderRemain ?? 10,
    TotalProfit: overrides.TotalProfit ?? 200,
    ProfitPerJump: overrides.ProfitPerJump ?? 50,
    BuyJumps: overrides.BuyJumps ?? 1,
    SellJumps: overrides.SellJumps ?? 1,
    TotalJumps: overrides.TotalJumps ?? 2,
    DailyVolume: overrides.DailyVolume ?? 100,
    Velocity: overrides.Velocity ?? 1,
    PriceTrend: overrides.PriceTrend ?? 1,
    BuyCompetitors: overrides.BuyCompetitors ?? 1,
    SellCompetitors: overrides.SellCompetitors ?? 1,
    DailyProfit: overrides.DailyProfit ?? 10,
    ...overrides,
  };
}

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
    expect(byRoute[routeAKey].routeRiskNoHistoryCount).toBeGreaterThanOrEqual(0);
    expect(byRoute[routeBKey].routeItemCount).toBe(1);
  });
});
