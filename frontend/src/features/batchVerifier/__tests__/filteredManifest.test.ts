import { describe, expect, it } from "vitest";

import { buildFilteredBuyManifest } from "@/features/batchVerifier/filteredManifest";
import type { ComparisonResult } from "@/features/batchVerifier/compare";
import type { ManifestItem } from "@/features/batchVerifier/parsing";

function manifestItem(overrides: Partial<ManifestItem> = {}): ManifestItem {
  return {
    rawName: "Tritanium",
    name: "Tritanium",
    qty: 10,
    buyPer: 5,
    buyTotal: 50,
    sellPer: 7,
    sellTotal: 70,
    vol: 1,
    profit: 20,
    ...overrides,
  };
}

function comparisonResult(rows: ComparisonResult["rows"]): ComparisonResult {
  return {
    rows,
    buyThese: [],
    doNotBuy: [],
    missing: [],
    unexpected: [],
    review: [],
    summary: {
      counts: { safe: 0, do_not_buy: 0, quantity_mismatch: 0, missing_from_export: 0, unexpected_in_export: 0 },
      extraIskRequiredVsPlan: 0,
      estimatedProfitLost: 0,
      alertingRowsCount: 0,
    },
    aggregate: {
      lineCount: 0,
      matchedLineCount: 0,
      missingBuyLines: 0,
      reducedEdgeLineCount: 0,
      totalPlannedBuy: 0,
      totalMatchedBuy: 0,
      totalPlannedSell: 0,
      verdict: "good",
    },
  };
}

describe("buildFilteredBuyManifest", () => {
  it("filters out do_not_buy/quantity_mismatch/missing_from_export, preserves order, and excludes rejects from multibuy", () => {
    const safeFirst = manifestItem({ name: "B", rawName: "B", qty: 5, buyTotal: 50, sellTotal: 75, profit: 25, vol: 2 });
    const blocked = manifestItem({ name: "A", rawName: "A", qty: 2 });
    const safeSecond = manifestItem({ name: "C", rawName: "C", qty: 3, buyTotal: 60, sellTotal: 90, profit: 30, vol: 0.5 });
    const mismatch = manifestItem({ name: "D", rawName: "D", qty: 1 });
    const missing = manifestItem({ name: "E", rawName: "E", qty: 8 });

    const manifestItems = [safeFirst, blocked, safeSecond, mismatch, missing];
    const comparison = comparisonResult([
      { name: "A", state: "do_not_buy", reason: "blocked", manifestItem: blocked, exportItem: { rawName: "A", name: "A", qty: 2, buyPer: 99, buyTotal: 198 } },
      { name: "B", state: "safe", reason: "", manifestItem: safeFirst, exportItem: { rawName: "B", name: "B", qty: 5, buyPer: 11, buyTotal: 55 } },
      { name: "C", state: "safe", reason: "", manifestItem: safeSecond, exportItem: { rawName: "C", name: "C", qty: 3, buyPer: 20, buyTotal: 60 } },
      { name: "D", state: "quantity_mismatch", reason: "mismatch", manifestItem: mismatch, exportItem: { rawName: "D", name: "D", qty: 2, buyPer: 5, buyTotal: 10 } },
      { name: "E", state: "missing_from_export", reason: "missing", manifestItem: missing },
    ]);

    const result = buildFilteredBuyManifest({
      manifestText: "Jumps to buy station: 2\nJumps buy -> sell: 3\nCargo m3: 1,000",
      manifestItems,
      comparison,
    });

    expect(result.lines.map((line) => line.name)).toEqual(["B", "C"]);
    expect(result.summary.keptLineCount).toBe(2);
    expect(result.summary.excludedManifestLineCount).toBe(3);
    expect(result.text).toContain("\n\nB 5\nC 3");
    expect(result.text).not.toContain("A 2");
    expect(result.text).not.toContain("D 1");
    expect(result.text).not.toContain("E 8");
  });

  it("recomputes totals, uses export buy values (Option B), and applies adjusted profit formula", () => {
    const row = manifestItem({ name: "A", rawName: "A", qty: 10, buyPer: 5, buyTotal: 50, sellPer: 9, sellTotal: 90, profit: 40, vol: 2.25 });
    const result = buildFilteredBuyManifest({
      manifestText: "Jumps to buy station: 4\nJumps buy -> sell: 6",
      manifestItems: [row],
      comparison: comparisonResult([
        { name: "A", state: "safe", reason: "", manifestItem: row, exportItem: { rawName: "A", name: "A", qty: 7, buyPer: 6, buyTotal: 42 } },
      ]),
    });

    expect(result.lines[0]).toMatchObject({ qty: 7, buyPer: 6, buyTotal: 42, sellTotal: 90 });
    expect(result.lines[0]?.profit).toBe(48);
    expect(result.summary.totalBuyCost).toBe(42);
    expect(result.summary.totalPlannedSell).toBe(90);
    expect(result.summary.totalVolume).toBe(2.25);
    expect(result.summary.totalJumps).toBe(10);
    expect(result.summary.iskPerJump).toBe(4.8);
  });

  it("validates output formatting rules for Cargo m3, Total volume, and quantity comma behavior", () => {
    const row = manifestItem({ name: "A", rawName: "A", qty: 1200, buyPer: 10, buyTotal: 12000, sellPer: 13, sellTotal: 15600, vol: 2.34, profit: 3600 });
    const result = buildFilteredBuyManifest({
      manifestText: "Cargo m3: 12,345.6",
      manifestItems: [row],
      comparison: comparisonResult([
        { name: "A", state: "safe", reason: "", manifestItem: row, exportItem: { rawName: "A", name: "A", qty: 1200, buyPer: 11, buyTotal: 13200 } },
      ]),
    });

    expect(result.text).toContain("Cargo m3: 12,345.6");
    expect(result.text).toContain("Total volume: 2.3 m3");
    expect(result.text).toContain("A | qty 1,200");
    expect(result.text).toContain("\n\nA 1200");
  });
});
