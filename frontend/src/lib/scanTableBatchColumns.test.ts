import { describe, expect, it } from "vitest";
import { buildBatch, buildRouteBatchMetadataByRow, rowBatchIdentityKey } from "@/lib/batchMetrics";
import {
  compareBatchSyntheticValues,
  formatBatchSyntheticCell,
  getBatchSyntheticValue,
  passesBatchNumericFilter,
} from "@/lib/scanTableBatchColumns";
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
});
