import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { compareManifestToExport } from "@/features/batchVerifier/compare";
import { parseBatchManifest, parseExportOrder, parseIskNumber } from "@/features/batchVerifier/parsing";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

function readFixture(name: string): string {
  return readFileSync(resolve(fixtureDir, name), "utf8");
}

describe("batch verifier fixture regressions", () => {
  it("parses manifest/export fixtures into canonical records", () => {
    const manifest = parseBatchManifest(readFixture("normal-batch-manifest.txt"));
    const exportRows = parseExportOrder(readFixture("export-with-total-row.txt"));
    const whitespaceExport = parseExportOrder(readFixture("whitespace-variant-names-export.txt"));

    expect(manifest.errors).toEqual([]);
    expect(manifest.items).toEqual([
      expect.objectContaining({
        name: "Heavy Water",
        qty: 10,
        buyTotal: 120000,
        buyPer: 12000,
        sellTotal: 130000,
        sellPer: 13000,
        vol: 2.5,
        profit: 10000,
      }),
      expect.objectContaining({
        name: "Tritanium",
        qty: 1000,
        buyTotal: 4550,
        buyPer: 4.55,
        sellTotal: 5000,
        sellPer: 5,
        vol: 0.01,
      }),
      expect.objectContaining({
        name: "Republic Fleet EMP S",
        qty: 400,
        buyTotal: 1200000,
        buyPer: 3000,
        sellPer: 3500,
        vol: 0.01,
        profit: 200000,
      }),
    ]);

    expect(exportRows.errors).toEqual([]);
    expect(exportRows.ignoredLines).toEqual(
      expect.arrayContaining([expect.objectContaining({ lineNumber: 1, reason: "total summary row" })]),
    );
    expect(exportRows.items.map((row) => row.name)).toEqual([
      "Heavy Water",
      "Tritanium",
      "Republic Fleet EMP S",
    ]);

    expect(whitespaceExport.errors).toEqual([]);
    expect(whitespaceExport.items.map((row) => row.name)).toEqual([
      "Heavy Water",
      "Republic Fleet EMP S",
    ]);
  });

  it("parses decimal/comma fixture variants consistently", () => {
    const values = readFixture("decimal-comma-format-variants.txt")
      .trim()
      .split(/\r?\n/)
      .map((raw) => parseIskNumber(raw));

    expect(values).toEqual([1234567.89, 4550, 12000, 0.01, 3000]);
  });

  it("compares fixtures into expected grouped decisions and summary totals", () => {
    const manifest = parseBatchManifest(readFixture("normal-batch-manifest.txt"));
    const exportRows = parseExportOrder(readFixture("export-with-total-row.txt"));

    const comparison = compareManifestToExport(manifest.items, exportRows.items, {
      thresholdMode: "strict",
      enableQuantityMismatch: true,
      includeReview: true,
    });

    expect(comparison.buyThese.map((row) => row.name)).toEqual(["Republic Fleet EMP S", "Tritanium"]);
    expect(comparison.doNotBuy.map((row) => row.name)).toEqual(["Heavy Water"]);
    expect(comparison.missing).toEqual([]);
    expect(comparison.unexpected).toEqual([]);
    expect(comparison.review).toBeUndefined();

    expect(comparison.summary).toEqual({
      counts: {
        safe: 2,
        do_not_buy: 1,
        quantity_mismatch: 0,
        missing_from_export: 0,
        unexpected_in_export: 0,
      },
      extraIskRequiredVsPlan: 5000,
      estimatedProfitLost: 10000,
    });

    expect(comparison.doNotBuy[0]).toMatchObject({
      name: "Heavy Water",
      buyPerDelta: 500,
      buyTotalDelta: 5000,
      extraIskVsPlan: 5000,
      estimatedProfitLost: 10000,
    });
  });

  it("does not throw for malformed fixtures and preserves diagnostics", () => {
    const mixed = readFixture("mixed-valid-invalid-lines.txt");

    expect(() => parseBatchManifest(mixed)).not.toThrow();
    expect(() => parseExportOrder("Good\t2\t10\t20\nMalformed\t1\t2\n")).not.toThrow();
    expect(() => {
      const parsedManifest = parseBatchManifest(mixed);
      const parsedExport = parseExportOrder("Good Item\t2\t10\t20\n");
      compareManifestToExport(parsedManifest.items, parsedExport.items, {});
    }).not.toThrow();

    const manifestResult = parseBatchManifest(mixed);
    expect(manifestResult.items.map((item) => item.name)).toEqual(["Good Item", "Another Good"]);
    expect(manifestResult.errors).toEqual([
      expect.objectContaining({ lineNumber: 3, reason: "invalid numeric value for qty" }),
    ]);
    expect(manifestResult.ignoredLines).toEqual(
      expect.arrayContaining([expect.objectContaining({ lineNumber: 1 }), expect.objectContaining({ lineNumber: 4 })]),
    );
  });

  it("locks grouped report object contract shape", () => {
    const manifest = parseBatchManifest(readFixture("normal-batch-manifest.txt"));
    const exportRows = parseExportOrder(readFixture("export-with-total-row.txt"));
    const comparison = compareManifestToExport(manifest.items, exportRows.items, {
      thresholdMode: "strict",
      includeReview: true,
    });

    const contractSnapshot = {
      topLevelKeys: Object.keys(comparison).sort(),
      rowKeys: Object.keys(comparison.rows[0] ?? {}).sort(),
      summaryKeys: Object.keys(comparison.summary).sort(),
      countKeys: Object.keys(comparison.summary.counts).sort(),
      states: comparison.rows.map((row) => ({ name: row.name, state: row.state })),
    };

    expect(contractSnapshot).toEqual({
      topLevelKeys: ["buyThese", "doNotBuy", "missing", "review", "rows", "summary", "unexpected"],
      rowKeys: [
        "allowedBuyPer",
        "buyPerDelta",
        "buyTotalDelta",
        "estimatedProfitLost",
        "exportItem",
        "extraIskVsPlan",
        "manifestItem",
        "name",
        "qtyDelta",
        "reason",
        "state",
      ],
      summaryKeys: ["counts", "estimatedProfitLost", "extraIskRequiredVsPlan"],
      countKeys: ["do_not_buy", "missing_from_export", "quantity_mismatch", "safe", "unexpected_in_export"],
      states: [
        { name: "Heavy Water", state: "do_not_buy" },
        { name: "Republic Fleet EMP S", state: "safe" },
        { name: "Tritanium", state: "safe" },
      ],
    });
  });
});
