import { describe, expect, it } from "vitest";
import { buildBatch, buildRouteBatchMetadataByRow, rowBatchIdentityKey } from "@/lib/batchMetrics";
import {
  compareBatchSyntheticValues,
  formatBatchSyntheticCell,
  getBatchSyntheticValue,
  passesBatchNumericFilter,
} from "@/lib/scanTableBatchColumns";
import { makeFlipResult as makeRow } from "@/lib/testFixtures";

describe("scan-table batch synthetic helpers", () => {
  it("returns synthetic values and fallback rendering for ineligible rows", () => {
    const eligible = makeRow({ TypeID: 1 });
    const ineligibleOnly = makeRow({ TypeID: 2, ProfitPerUnit: 0, BuyLocationID: 900001, SellLocationID: 900002 });
    const rows = [eligible, ineligibleOnly];
    const metadata = buildRouteBatchMetadataByRow(rows, 1_000);

    const eligibleBatchNum = getBatchSyntheticValue(eligible, "BatchNumber", metadata);
    expect(eligibleBatchNum).toBe(1);
    expect(formatBatchSyntheticCell("BatchNumber", eligibleBatchNum)).toBe("1");

    const ineligibleVal = getBatchSyntheticValue(ineligibleOnly, "BatchProfit", metadata);
    expect(ineligibleVal).toBeNull();
    expect(formatBatchSyntheticCell("BatchProfit", ineligibleVal)).toBe("—");
  });

  it("supports sorting asc/desc for each batch synthetic column", () => {
    const values: Array<number | null> = [5, null, 12, 1];
    const asc = values.slice().sort((a, b) => compareBatchSyntheticValues(a, b, "asc"));
    const desc = values.slice().sort((a, b) => compareBatchSyntheticValues(a, b, "desc"));

    expect(asc).toEqual([1, 5, 12, null]);
    expect(desc).toEqual([12, 5, 1, null]);
  });

  it("applies numeric filters for BatchNumber and ISK columns", () => {
    expect(passesBatchNumericFilter(3, "2")).toBe(true);
    expect(passesBatchNumericFilter(1, "2")).toBe(false);
    expect(passesBatchNumericFilter(null, "1")).toBe(false);

    expect(passesBatchNumericFilter(150_000, "100000")).toBe(true);
    expect(passesBatchNumericFilter(50_000, "100000")).toBe(false);
    expect(passesBatchNumericFilter(80_000, "75000")).toBe(true);
  });

  it("computes and formats batch ISK/jump from row jumps", () => {
    const row = makeRow({
      TypeID: 101,
      ProfitPerUnit: 40,
      UnitsToBuy: 5,
      TotalJumps: 4,
    });
    const metadata = buildRouteBatchMetadataByRow([row], 1_000);

    const value = getBatchSyntheticValue(row, "BatchIskPerJump", metadata);
    expect(value).toBe(50);
    expect(formatBatchSyntheticCell("BatchIskPerJump", value)).toBe("50");
  });

  it("returns null batch ISK/jump when jumps are zero or missing", () => {
    const zeroJumpsRow = makeRow({
      TypeID: 201,
      BuyLocationID: 920001,
      SellLocationID: 920002,
      TotalJumps: 0,
    });
    const missingJumpsRow = makeRow({
      TypeID: 202,
      BuyLocationID: 930001,
      SellLocationID: 930002,
      TotalJumps: undefined,
    });
    const metadata = buildRouteBatchMetadataByRow([zeroJumpsRow, missingJumpsRow], 1_000);

    const zeroJumpsValue = getBatchSyntheticValue(zeroJumpsRow, "BatchIskPerJump", metadata);
    const missingJumpsValue = getBatchSyntheticValue(missingJumpsRow, "BatchIskPerJump", metadata);
    expect(zeroJumpsValue).toBeNull();
    expect(missingJumpsValue).toBeNull();
    expect(formatBatchSyntheticCell("BatchIskPerJump", zeroJumpsValue)).toBe("—");
    expect(formatBatchSyntheticCell("BatchIskPerJump", missingJumpsValue)).toBe("—");
  });

  it("keeps popup batch totals in parity with synthetic row metadata for the same anchor", () => {
    const anchor = makeRow({ TypeID: 11, Volume: 5, ProfitPerUnit: 10, UnitsToBuy: 3, ExpectedBuyPrice: 75 });
    const companion = makeRow({ TypeID: 12, Volume: 1, ProfitPerUnit: 30, UnitsToBuy: 10, ExpectedBuyPrice: 90 });
    const rows = [anchor, companion];

    const popupBatch = buildBatch(anchor, rows, 100);
    const metadata = buildRouteBatchMetadataByRow(rows, 100);
    const anchorMeta = metadata[rowBatchIdentityKey(anchor)];

    expect(anchorMeta.batchNumber).toBe(popupBatch.lines.length);
    expect(anchorMeta.batchProfit).toBe(popupBatch.totalProfit);
    expect(anchorMeta.batchTotalCapital).toBe(popupBatch.totalCapital);
  });

  it("exposes route-pack synthetic metrics and formatting", () => {
    const row = makeRow({
      TypeID: 301,
      ProfitPerUnit: 40,
      UnitsToBuy: 5,
      SlippageBuyPct: 3,
      SlippageSellPct: 2,
    });
    const metadata = buildRouteBatchMetadataByRow([row], 1_000);

    expect(getBatchSyntheticValue(row, "RoutePackItemCount", metadata)).toBe(1);
    expect(getBatchSyntheticValue(row, "RoutePackTotalVolume", metadata)).toBeGreaterThan(0);
    expect(getBatchSyntheticValue(row, "RoutePackWeightedSlippagePct", metadata)).toBe(5);
    expect(getBatchSyntheticValue(row, "RoutePackDailyProfit", metadata)).toBe(10);
    expect(formatBatchSyntheticCell("RoutePackWeightedSlippagePct", 5)).toBe("5.00%");
    expect(formatBatchSyntheticCell("RoutePackDailyProfitOverCapital", 12.5)).toBe("12.50%");
    expect(formatBatchSyntheticCell("RoutePackExitOverhangDays", 3.25)).toBe("3.3d");
    expect(formatBatchSyntheticCell("RoutePackRealIskPerM3PerJump", 1200)).toBe("1.2 K");
    expect(formatBatchSyntheticCell("RoutePackTotalVolume", 20)).toBe("20 m³");
  });

  it("computes ROI and profit-per-100M formulas from route-pack metadata", () => {
    const row = makeRow({
      TypeID: 401,
      ProfitPerUnit: 50,
      UnitsToBuy: 10,
      ExpectedBuyPrice: 100,
      DailyProfit: 80,
    });
    const metadata = buildRouteBatchMetadataByRow([row], 1_000);

    const roi = getBatchSyntheticValue(row, "RoutePackROI", metadata);
    const profitPer100M = getBatchSyntheticValue(row, "RoutePackProfitPer100M", metadata);
    const totalProfit = getBatchSyntheticValue(row, "RoutePackTotalProfit", metadata) ?? 0;
    const totalCapital = getBatchSyntheticValue(row, "RoutePackTotalCapital", metadata) ?? 0;

    expect(roi).toBe(8);
    expect(profitPer100M).toBe((totalProfit / totalCapital) * 100_000_000);
  });

  it("passes through confidence and remaining cargo route-pack values", () => {
    const row = makeRow({
      TypeID: 501,
      BuyLocationID: 970001,
      SellLocationID: 970002,
      UnitsToBuy: 100,
      FilledQty: 30,
      Volume: 3,
      ProfitPerUnit: 20,
    });
    const metadata = buildRouteBatchMetadataByRow([row], 200);
    const key = rowBatchIdentityKey(row);
    const meta = metadata[key];

    expect(getBatchSyntheticValue(row, "RoutePackWorstFillConfidencePct", metadata)).toBe(
      meta.routeWorstFillConfidencePct,
    );
    expect(getBatchSyntheticValue(row, "RoutePackAverageFillConfidencePct", metadata)).toBe(
      meta.routeAverageFillConfidencePct,
    );
    expect(getBatchSyntheticValue(row, "RoutePackRemainingCargoM3", metadata)).toBe(
      meta.routeRemainingCargoM3,
    );
  });

  it("passes through profit concentration and returns null when route totals are non-positive", () => {
    const dominant = makeRow({
      TypeID: 601,
      BuyLocationID: 980001,
      SellLocationID: 980002,
      ProfitPerUnit: 100,
      UnitsToBuy: 10,
      Volume: 1,
    });
    const tail = makeRow({
      TypeID: 602,
      BuyLocationID: dominant.BuyLocationID,
      SellLocationID: dominant.SellLocationID,
      ProfitPerUnit: 25,
      UnitsToBuy: 4,
      Volume: 1,
    });
    const concentrated = buildRouteBatchMetadataByRow([dominant, tail], 1_000);
    const concentration = getBatchSyntheticValue(
      dominant,
      "RoutePackProfitConcentrationPct",
      concentrated,
    );
    expect(concentration).toBeCloseTo((1_000 / 1_100) * 100, 6);

    const negativeOnly = makeRow({
      TypeID: 603,
      BuyLocationID: 980101,
      SellLocationID: 980102,
      ProfitPerUnit: -20,
      UnitsToBuy: 5,
      Volume: 1,
    });
    const nonPositive = buildRouteBatchMetadataByRow([negativeOnly], 1_000);
    expect(getBatchSyntheticValue(negativeOnly, "RoutePackProfitConcentrationPct", nonPositive)).toBeNull();
    expect(
      formatBatchSyntheticCell(
        "RoutePackProfitConcentrationPct",
        getBatchSyntheticValue(negativeOnly, "RoutePackProfitConcentrationPct", nonPositive),
      ),
    ).toBe("—");
  });

});
