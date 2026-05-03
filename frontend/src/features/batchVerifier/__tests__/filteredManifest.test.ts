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

  it("formats filtered manifest text with header, detail rows, and multibuy rows", () => {
    const manifestItems = [
      manifestItem({ name: "A", rawName: "A", qty: 1200, sellPer: 15, sellTotal: 18000, vol: 2.25 }),
      manifestItem({ name: "B", rawName: "B", qty: 2 }),
    ];
    const comparison = comparisonResult([
      { name: "A", state: "safe", reason: "", manifestItem: manifestItems[0], exportItem: { rawName: "A", name: "A", qty: 1200, buyPer: 10.4, buyTotal: 12480 } },
      { name: "B", state: "do_not_buy", reason: "", manifestItem: manifestItems[1], exportItem: { rawName: "B", name: "B", qty: 2, buyPer: 10, buyTotal: 20 } },
    ]);

    const manifestText = [
      "Buy station: Jita IV - Moon 4",
      "Jumps to buy station: 3",
      "Sell station: Amarr VIII",
      "Jumps buy -> sell: 4",
      "Cargo m3: 12,345 m3",
    ].join("\n");

    const result = buildFilteredBuyManifest({ manifestText, manifestItems, comparison });
    expect(result.text).toContain("Buy station: Jita IV - Moon 4");
    expect(result.text).toContain("Cargo m3: 12,345");
    expect(result.text).toContain("Items: 1");
    expect(result.text).toContain("Total volume: 2.3 m3");
    expect(result.text).toContain("Total capital: 12,480 ISK");
    expect(result.text).toContain("Total gross sell: 18,000 ISK");
    expect(result.text).toContain("A | qty 1,200 | buy total 12,480 ISK | buy per 10 ISK");
    expect(result.text).toContain("vol 2.3 m3");
    expect(result.text).toContain("\n\nA 1200");
    expect(result.text).not.toContain("B | qty");
    expect(result.text).not.toContain("B 2");
  });
});


it("uses export quantity for safe rows even when qty differs and flags fallback for missing sell/profit", () => {
  const item = manifestItem({ name: "A", rawName: "A", qty: 10, sellPer: undefined, sellTotal: undefined, profit: undefined });
  const comparison = comparisonResult([
    { name: "A", state: "safe", reason: "", manifestItem: item, exportItem: { rawName: "A", name: "A", qty: 7, buyPer: 5, buyTotal: 35 } },
  ]);
  const result = buildFilteredBuyManifest({ manifestText: "", manifestItems: [item], comparison });
  expect(result.lines[0]?.qty).toBe(7);
  expect(result.lines[0]?.sellPer).toBe(0);
  expect(result.lines[0]?.sellTotal).toBe(0);
  expect(result.summary.totalPlannedSell).toBe(0);
  expect(result.usedMissingSellOrProfitFallback).toBe(true);
});
