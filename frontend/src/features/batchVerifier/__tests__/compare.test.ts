import { describe, expect, it } from "vitest";

import {
  buildReasonText,
  classifyRow,
  computeAggregateStats,
  compareManifestToExport,
  getFinalVerdict,
} from "@/features/batchVerifier/compare";
import type { ExportItem, ManifestItem } from "@/features/batchVerifier/parsing";

function manifest(overrides: Partial<ManifestItem> = {}): ManifestItem {
  return {
    rawName: overrides.rawName ?? "Item A",
    name: overrides.name ?? "Item A",
    qty: overrides.qty ?? 10,
    buyPer: overrides.buyPer ?? 100,
    buyTotal: overrides.buyTotal ?? 1000,
    sellTotal: overrides.sellTotal,
    sellPer: overrides.sellPer,
    vol: overrides.vol,
    profit: overrides.profit,
  };
}

function exportRow(overrides: Partial<ExportItem> = {}): ExportItem {
  return {
    rawName: overrides.rawName ?? "Item A",
    name: overrides.name ?? "Item A",
    qty: overrides.qty ?? 10,
    buyPer: overrides.buyPer ?? 100,
    buyTotal: overrides.buyTotal ?? 1000,
  };
}

describe("compareManifestToExport", () => {
  it("applies core overpriced do-not-buy rule", () => {
    const result = compareManifestToExport(
      [manifest({ name: "Heavy Water", buyPer: 100, buyTotal: 1000, qty: 10 })],
      [exportRow({ name: "Heavy Water", buyPer: 125, buyTotal: 1250, qty: 10 })],
      { thresholdMode: "strict" },
    );

    expect(result.doNotBuy).toHaveLength(1);
    expect(result.doNotBuy[0]).toMatchObject({
      state: "do_not_buy",
      buyPerDelta: 25,
      buyTotalDelta: 250,
      qtyDelta: 0,
    });
    expect(result.buyThese).toHaveLength(0);
  });

  it("supports strict, isk tolerance, and percent tolerance threshold modes", () => {
    const manifestItem = manifest({ name: "Tritanium", buyPer: 100, buyTotal: 1000, qty: 10 });
    const exportItem = exportRow({ name: "Tritanium", buyPer: 106, buyTotal: 1060, qty: 10 });

    const strict = compareManifestToExport([manifestItem], [exportItem], { thresholdMode: "strict" });
    expect(strict.rows[0]?.state).toBe("do_not_buy");

    const iskTolerance = compareManifestToExport([manifestItem], [exportItem], {
      thresholdMode: "isk_tolerance",
      iskTolerance: 10,
    });
    expect(iskTolerance.rows[0]?.state).toBe("safe");

    const percentTolerance = compareManifestToExport([manifestItem], [exportItem], {
      thresholdMode: "percent_tolerance",
      percentTolerance: 5,
    });
    expect(percentTolerance.rows[0]?.state).toBe("do_not_buy");

    const percentTolerancePass = compareManifestToExport([manifestItem], [exportItem], {
      thresholdMode: "percent_tolerance",
      percentTolerance: 6,
    });
    expect(percentTolerancePass.rows[0]?.state).toBe("safe");
  });

  it("supports sell-value evaluation mode thresholds", () => {
    const manifestItem = manifest({ name: "Megacyte", qty: 10, buyPer: 100, buyTotal: 1000, sellPer: 120 });

    const allowed = compareManifestToExport(
      [manifestItem],
      [exportRow({ name: "Megacyte", qty: 10, buyPer: 110, buyTotal: 1100 })],
      { thresholdMode: "sell_value_evaluate" },
    );
    expect(allowed.rows[0]?.state).toBe("safe");

    const blocked = compareManifestToExport(
      [manifestItem],
      [exportRow({ name: "Megacyte", qty: 10, buyPer: 121, buyTotal: 1210 })],
      { thresholdMode: "sell_value_evaluate" },
    );
    expect(blocked.rows[0]?.state).toBe("do_not_buy");
    expect(blocked.rows[0]?.reason).toContain("sell-per target");

    const boundary = compareManifestToExport(
      [manifestItem],
      [exportRow({ name: "Megacyte", qty: 10, buyPer: 120, buyTotal: 1200 })],
      { thresholdMode: "sell_value_evaluate" },
    );
    expect(boundary.rows[0]?.state).toBe("safe");
  });

  it("fails closed in sell-value mode when manifest sellPer is missing", () => {
    const result = compareManifestToExport(
      [manifest({ name: "Zydrine", qty: 5, buyPer: 200, buyTotal: 1000, sellPer: undefined })],
      [exportRow({ name: "Zydrine", qty: 5, buyPer: 190, buyTotal: 950 })],
      { thresholdMode: "sell_value_evaluate" },
    );

    expect(result.rows[0]?.state).toBe("do_not_buy");
    expect(result.rows[0]?.reason).toContain("missing sell-per");
  });

  it("handles quantity mismatch toggle behavior", () => {
    const m = manifest({ qty: 10, buyPer: 100, buyTotal: 1000 });
    const e = exportRow({ qty: 11, buyPer: 100, buyTotal: 1100 });

    const enabled = compareManifestToExport([m], [e], { enableQuantityMismatch: true });
    expect(enabled.rows[0]?.state).toBe("quantity_mismatch");
    expect(enabled.review).toHaveLength(1);

    const disabled = compareManifestToExport([m], [e], { enableQuantityMismatch: false });
    expect(disabled.rows[0]?.state).toBe("safe");
    expect(disabled.review).toBeUndefined();
  });

  it("detects missing and unexpected items", () => {
    const result = compareManifestToExport(
      [manifest({ name: "A" }), manifest({ name: "B" })],
      [exportRow({ name: "A" }), exportRow({ name: "C" })],
      {},
    );

    expect(result.missing.map((row) => row.name)).toEqual(["B"]);
    expect(result.unexpected.map((row) => row.name)).toEqual(["C"]);
    expect(result.summary.counts.missing_from_export).toBe(1);
    expect(result.summary.counts.unexpected_in_export).toBe(1);
  });

  it("calculates summary metrics deterministically", () => {
    const result = compareManifestToExport(
      [
        manifest({ name: "Overpriced", qty: 10, buyPer: 100, buyTotal: 1000, profit: 400 }),
        manifest({ name: "Missing", qty: 5, buyPer: 200, buyTotal: 1000, sellTotal: 1300 }),
        manifest({ name: "Safe", qty: 2, buyPer: 50, buyTotal: 100 }),
      ],
      [
        exportRow({ name: "Overpriced", qty: 10, buyPer: 130, buyTotal: 1300 }),
        exportRow({ name: "Safe", qty: 2, buyPer: 50, buyTotal: 100 }),
      ],
      { thresholdMode: "strict" },
    );

    expect(result.summary.counts).toMatchObject({
      safe: 1,
      do_not_buy: 1,
      missing_from_export: 1,
      unexpected_in_export: 0,
      quantity_mismatch: 0,
    });
    expect(result.summary.extraIskRequiredVsPlan).toBe(300);
    expect(result.summary.estimatedProfitLost).toBe(700);
    expect(result.summary.alertingRowsCount).toBe(0);
  });

  it("computes aggregate totals and counts for mixed rows", () => {
    const result = compareManifestToExport(
      [
        manifest({ name: "Safe", qty: 10, buyPer: 100, buyTotal: 1000, sellPer: 130 }),
        manifest({ name: "Reduced", qty: 5, buyPer: 50, buyTotal: 250, sellPer: 70 }),
        manifest({ name: "Missing", qty: 3, buyPer: 30, buyTotal: 90, sellPer: 40 }),
      ],
      [
        exportRow({ name: "Safe", qty: 10, buyPer: 100, buyTotal: 1000 }),
        exportRow({ name: "Reduced", qty: 5, buyPer: 55, buyTotal: 275 }),
      ],
      { thresholdMode: "sell_value_evaluate" },
    );

    expect(result.aggregate).toMatchObject({
      lineCount: 3,
      matchedLineCount: 2,
      missingBuyLines: 1,
      reducedEdgeLineCount: 1,
      totalPlannedBuy: 1340,
      totalMatchedBuy: 1275,
      totalPlannedSell: 1770,
      verdict: "abort",
    });
  });

  it("handles verdict threshold boundaries", () => {
    expect(getFinalVerdict({ missingBuyLines: 0, reducedEdgeLineCount: 0 })).toBe("good");
    expect(getFinalVerdict({ missingBuyLines: 0, reducedEdgeLineCount: 1 })).toBe("reduced_edge");
    expect(getFinalVerdict({ missingBuyLines: 1, reducedEdgeLineCount: 0 })).toBe("abort");
    expect(getFinalVerdict({ missingBuyLines: 1, reducedEdgeLineCount: 5 })).toBe("abort");
  });

  it("marks reduced edge when buy-per increases but stays within threshold", () => {
    const rows = compareManifestToExport(
      [manifest({ name: "Edge", qty: 2, buyPer: 100, buyTotal: 200, sellPer: 130 })],
      [exportRow({ name: "Edge", qty: 2, buyPer: 101, buyTotal: 202 })],
      { thresholdMode: "sell_value_evaluate" },
    ).rows;

    const aggregate = computeAggregateStats(rows);
    expect(aggregate.reducedEdgeLineCount).toBe(1);
    expect(aggregate.missingBuyLines).toBe(0);
    expect(aggregate.verdict).toBe("reduced_edge");
  });

  it("marks row alert metadata when threshold is crossed", () => {
    const result = compareManifestToExport(
      [manifest({ name: "Cross", qty: 10, buyPer: 100, buyTotal: 1000 })],
      [exportRow({ name: "Cross", qty: 10, buyPer: 120, buyTotal: 1200 })],
      { thresholdMode: "strict", priceDiffAlertPercent: 10 },
    );

    expect(result.rows[0]?.priceDiffPercent).toBe(20);
    expect(result.rows[0]?.crossesPriceDiffAlert).toBe(true);
    expect(result.summary.alertingRowsCount).toBe(1);
    expect(result.summary.maxPriceDiffPercent).toBe(20);
    expect(result.rows[0]?.reason).toContain("exceeds configured % difference");
  });

  it("does not mark alert metadata when threshold is not crossed", () => {
    const result = compareManifestToExport(
      [manifest({ name: "Within", qty: 10, buyPer: 100, buyTotal: 1000 })],
      [exportRow({ name: "Within", qty: 10, buyPer: 105, buyTotal: 1050 })],
      { thresholdMode: "strict", priceDiffAlertPercent: 10 },
    );

    expect(result.rows[0]?.priceDiffPercent).toBe(5);
    expect(result.rows[0]?.crossesPriceDiffAlert).toBe(false);
    expect(result.summary.alertingRowsCount).toBe(0);
    expect(result.summary.maxPriceDiffPercent).toBe(5);
  });

  it("handles zero baseline and missing values for price-diff metadata", () => {
    const zeroBaseline = compareManifestToExport(
      [manifest({ name: "Zero", qty: 10, buyPer: 0, buyTotal: 0 })],
      [exportRow({ name: "Zero", qty: 10, buyPer: 10, buyTotal: 100 })],
      { thresholdMode: "strict", priceDiffAlertPercent: 1 },
    );
    expect(zeroBaseline.rows[0]?.priceDiffPercent).toBeUndefined();
    expect(zeroBaseline.rows[0]?.crossesPriceDiffAlert).toBe(false);

    const missingValues = compareManifestToExport(
      [manifest({ name: "Missing", qty: 10, buyPer: Number.NaN, buyTotal: 0 })],
      [exportRow({ name: "Missing", qty: 10, buyPer: 10, buyTotal: 100 })],
      { thresholdMode: "strict", priceDiffAlertPercent: 1 },
    );
    expect(missingValues.rows[0]?.priceDiffPercent).toBeUndefined();
    expect(missingValues.rows[0]?.crossesPriceDiffAlert).toBe(false);
    expect(missingValues.summary.maxPriceDiffPercent).toBeUndefined();
  });

  it("generates explanation text for each non-safe state", () => {
    const m = manifest({ name: "Item X", qty: 10, buyPer: 100, buyTotal: 1000, profit: 100 });
    const e = exportRow({ name: "Item X", qty: 12, buyPer: 140, buyTotal: 1680 });

    const doNotBuy = classifyRow(m, e, { thresholdMode: "strict", enableQuantityMismatch: true });
    expect(doNotBuy.state).toBe("do_not_buy");
    expect(doNotBuy.reason).toContain("exceeds allowed");

    const qtyMismatch = classifyRow(m, exportRow({ name: "Item X", qty: 12, buyPer: 100, buyTotal: 1200 }), {
      enableQuantityMismatch: true,
    });
    expect(qtyMismatch.state).toBe("quantity_mismatch");
    expect(qtyMismatch.reason).toContain("Quantity mismatch");

    const missing = classifyRow(m, undefined, {});
    expect(missing.state).toBe("missing_from_export");
    expect(missing.reason).toContain("missing from export");

    const unexpected = classifyRow(undefined, e, {});
    expect(unexpected.state).toBe("unexpected_in_export");
    expect(unexpected.reason).toContain("not listed in manifest");

    expect(
      buildReasonText({
        name: "Safe",
        state: "safe",
      }),
    ).toContain("Within configured");
  });
});
