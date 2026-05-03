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
    vol: 0.01,
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
  it("keeps only safe rows with export item in original manifest order", () => {
    const manifestItems = [manifestItem({ name: "B", rawName: "B", qty: 2 }), manifestItem({ name: "A", rawName: "A", qty: 1 })];
    const comparison = comparisonResult([
      { name: "A", state: "safe", reason: "", manifestItem: manifestItems[1], exportItem: { rawName: "A", name: "A", qty: 1, buyPer: 6, buyTotal: 6 } },
      { name: "B", state: "do_not_buy", reason: "", manifestItem: manifestItems[0], exportItem: { rawName: "B", name: "B", qty: 2, buyPer: 10, buyTotal: 20 } },
    ]);

    const result = buildFilteredBuyManifest({ manifestText: "jumps to buy station: 3\njumps buy to sell: 2", manifestItems, comparison });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.name).toBe("A");
    expect(result.summary.totalJumps).toBe(5);
    expect(result.summary.doNotBuyLineCount).toBe(1);
  });

  it("flags duplicate normalized names", () => {
    const m1 = manifestItem({ name: "Heavy  Water", rawName: "Heavy  Water" });
    const m2 = manifestItem({ name: "Heavy Water", rawName: "Heavy Water" });
    const result = buildFilteredBuyManifest({ manifestText: "", manifestItems: [m1, m2], comparison: comparisonResult([]) });
    expect(result.hasDuplicateNormalizedManifestNames).toBe(true);
    expect(result.duplicateNormalizedManifestNames).toEqual(["Heavy Water"]);
  });
});
