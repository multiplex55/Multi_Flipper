import { describe, expect, it } from "vitest";

import {
  normalizeItemName,
  parseBatchManifest,
  parseBatchManifestHeader,
  parseExportOrder,
  parseIskNumber,
} from "@/features/batchVerifier/parsing";

describe("batch verifier parsing utilities", () => {
  it("parses a valid manifest line", () => {
    const result = parseBatchManifest(
      "Heavy Water | qty 10 | buy total 120,000 ISK | buy per 12,000 ISK | sell total 130000 | sell per 13000 | vol 2.5 m3 | profit 10000 ISK",
    );

    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      name: "Heavy Water",
      qty: 10,
      buyTotal: 120000,
      buyPer: 12000,
      sellTotal: 130000,
      sellPer: 13000,
      vol: 2.5,
      profit: 10000,
    });
  });

  it("parses a valid export row", () => {
    const result = parseExportOrder("Heavy Water\t10\t12,100\t121000");

    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      name: "Heavy Water",
      qty: 10,
      buyPer: 12100,
      buyTotal: 121000,
    });
  });

  it("ignores Total: row", () => {
    const result = parseExportOrder("Total:\t30\t100000\t3000000\nHeavy Water\t10\t12100\t121000");

    expect(result.items).toHaveLength(1);
    expect(result.ignoredLines).toEqual([
      expect.objectContaining({ lineNumber: 1, reason: "total summary row" }),
    ]);
  });

  it("handles commas and decimals", () => {
    expect(parseIskNumber("1,234,567.89 ISK")).toBe(1234567.89);

    const manifest = parseBatchManifest("Tritanium | qty 1,000 | buy per 4.55 | vol 0.01 m3");
    expect(manifest.items[0]).toMatchObject({ qty: 1000, buyPer: 4.55, vol: 0.01 });

    const exportOrder = parseExportOrder("Tritanium\t1,000\t4.55\t4,550.00");
    expect(exportOrder.items[0]).toMatchObject({ qty: 1000, buyPer: 4.55, buyTotal: 4550 });
  });

  it("skips malformed rows but preserves diagnostics", () => {
    const manifest = parseBatchManifest([
      "Items: 2",
      "Bad Item | qty nope | buy per 10",
      "Good Item | qty 2 | buy per 10",
      "Wrong Segments",
      "",
    ].join("\n"));

    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0]?.name).toBe("Good Item");
    expect(manifest.errors).toEqual([
      expect.objectContaining({ lineNumber: 2 }),
    ]);
    expect(manifest.ignoredLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lineNumber: 1 }),
        expect.objectContaining({ lineNumber: 4 }),
        expect.objectContaining({ lineNumber: 5 }),
      ]),
    );

    const exportOrder = parseExportOrder("Good Item\t2\t10\t20\nBad\t1\t2\n");
    expect(exportOrder.items).toHaveLength(1);
    expect(exportOrder.errors).toEqual([
      expect.objectContaining({ lineNumber: 2, reason: "expected 4 tab-delimited columns, got 3" }),
    ]);
    expect(exportOrder.ignoredLines).toEqual([
      expect.objectContaining({ lineNumber: 3, reason: "blank line" }),
    ]);
  });



  it("header parser reads buy/sell stations, jumps, and cargo with comma formatting", () => {
    const header = parseBatchManifestHeader([
      "Buy station: Jita IV - Moon 4",
      "Jumps to buy station: 1,234",
      "Sell station: Amarr VIII",
      "Jumps buy -> sell: 2",
      "Cargo m3: 12,345.6 m3",
    ].join("\n"));

    expect(header).toEqual({
      buyStation: "Jita IV - Moon 4",
      jumpsToBuyStation: 1234,
      sellStation: "Amarr VIII",
      jumpsBuyToSell: 2,
      cargoM3: 12345.6,
    });
  });

  it("header parser tolerates missing header lines safely", () => {
    const header = parseBatchManifestHeader([
      "Buy station: Dodixie IX",
      "Tritanium | qty 10 | buy per 5 | buy total 50",
    ].join("\n"));

    expect(header.buyStation).toBe("Dodixie IX");
    expect(header.jumpsToBuyStation).toBeUndefined();
    expect(header.sellStation).toBeUndefined();
    expect(header.jumpsBuyToSell).toBeUndefined();
    expect(header.cargoM3).toBeUndefined();
  });
  it("normalizes names by trimming and collapsing internal whitespace", () => {
    const matrix: Array<[string, string]> = [
      ["  Republic   Fleet   EMP S  ", "Republic Fleet EMP S"],
      ["\tHeavy\t\tWater\n", "Heavy Water"],
      ["A   B    C", "A B C"],
    ];

    for (const [input, expected] of matrix) {
      expect(normalizeItemName(input)).toBe(expected);
    }
  });
});
