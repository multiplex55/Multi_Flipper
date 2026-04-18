import { describe, expect, it } from "vitest";

import { computeAggregateStats, type ComparisonResult, type ComparisonRow } from "@/features/batchVerifier/compare";
import {
  formatDecisionReason,
  formatDoNotBuyList,
  formatSummaryReport,
} from "@/features/batchVerifier/formatting";

function row(overrides: Partial<ComparisonRow>): ComparisonRow {
  return {
    name: overrides.name ?? "Item",
    state: overrides.state ?? "safe",
    reason: overrides.reason ?? "",
    manifestItem: overrides.manifestItem,
    exportItem: overrides.exportItem,
    allowedBuyPer: overrides.allowedBuyPer,
    qtyDelta: overrides.qtyDelta,
    buyPerDelta: overrides.buyPerDelta,
    buyTotalDelta: overrides.buyTotalDelta,
    priceDiffPercent: overrides.priceDiffPercent,
    crossesPriceDiffAlert: overrides.crossesPriceDiffAlert,
    extraIskVsPlan: overrides.extraIskVsPlan,
    estimatedProfitLost: overrides.estimatedProfitLost,
  };
}

function result(rows: ComparisonRow[], summaryOverrides: Partial<ComparisonResult["summary"]> = {}): ComparisonResult {
  return {
    rows,
    buyThese: rows.filter((r) => r.state === "safe"),
    doNotBuy: rows.filter((r) => r.state === "do_not_buy"),
    missing: rows.filter((r) => r.state === "missing_from_export"),
    unexpected: rows.filter((r) => r.state === "unexpected_in_export"),
    review: rows.filter((r) => r.state === "quantity_mismatch"),
    summary: {
      counts: {
        safe: 1,
        do_not_buy: 1,
        quantity_mismatch: 1,
        missing_from_export: 1,
        unexpected_in_export: 1,
      },
      extraIskRequiredVsPlan: 1234567.891,
      estimatedProfitLost: 98765.432,
      alertThresholdPercent: 10,
      alertingRowsCount: 2,
      maxPriceDiffPercent: 18.75,
      ...summaryOverrides,
    },
    aggregate: computeAggregateStats(rows),
  };
}

describe("formatDecisionReason", () => {
  it("returns concise templates for each action state", () => {
    expect(
      formatDecisionReason(
        row({
          state: "do_not_buy",
          allowedBuyPer: 100,
          exportItem: { rawName: "A", name: "A", qty: 1, buyPer: 120, buyTotal: 120 },
        }),
      ),
    ).toBe("Overpriced: 120.00 ISK > allowed 100.00 ISK.");

    expect(
      formatDecisionReason(
        row({
          state: "quantity_mismatch",
          manifestItem: { rawName: "A", name: "A", qty: 10, buyPer: 100, buyTotal: 1000 },
          exportItem: { rawName: "A", name: "A", qty: 7, buyPer: 100, buyTotal: 700 },
        }),
      ),
    ).toBe("Quantity mismatch: manifest 10 vs export 7.");

    expect(formatDecisionReason(row({ state: "missing_from_export" }))).toBe("Missing from export order.");
    expect(formatDecisionReason(row({ state: "unexpected_in_export" }))).toBe("Unexpected item in export order.");
  });
});

describe("formatSummaryReport", () => {
  it("includes required fields with stable numeric formatting", () => {
    const summary = formatSummaryReport(result([row({ state: "safe" })]), {
      modeLabel: "Strict, quantity exact",
    });

    expect(summary).toContain("Mode: Strict, quantity exact");
    expect(summary).toContain("Safe: 1");
    expect(summary).toContain("Do not buy: 1");
    expect(summary).toContain("Quantity mismatch: 1");
    expect(summary).toContain("Missing from export: 1");
    expect(summary).toContain("Unexpected in export: 1");
    expect(summary).toContain("Price diff alert threshold (%): 10.00");
    expect(summary).toContain("Rows above alert threshold: 2");
    expect(summary).toContain("Max price diff (%): 18.75");
    expect(summary).toContain("Extra ISK vs plan: 1,234,567.89 ISK");
    expect(summary).toContain("Profit impact: 98,765.43 ISK");
  });
});

describe("formatDoNotBuyList", () => {
  it("exports only disallowed rows and excludes safe rows", () => {
    const rows = [
      row({ state: "safe", name: "Safe Item" }),
      row({
        state: "do_not_buy",
        name: "Overpriced Item",
        allowedBuyPer: 80,
        exportItem: { rawName: "O", name: "O", qty: 1, buyPer: 100, buyTotal: 100 },
      }),
      row({
        state: "quantity_mismatch",
        name: "Mismatch Item",
        manifestItem: { rawName: "M", name: "M", qty: 5, buyPer: 10, buyTotal: 50 },
        exportItem: { rawName: "M", name: "M", qty: 3, buyPer: 10, buyTotal: 30 },
      }),
      row({ state: "missing_from_export", name: "Missing Item" }),
      row({ state: "unexpected_in_export", name: "Unexpected Item" }),
    ];

    const output = formatDoNotBuyList(result(rows));

    expect(output).toContain("Overpriced Item — Overpriced:");
    expect(output).toContain("Mismatch Item — Quantity mismatch:");
    expect(output).toContain("Missing Item — Missing from export order.");
    expect(output).toContain("Unexpected Item — Unexpected item in export order.");
    expect(output).not.toContain("Safe Item");
  });
});
