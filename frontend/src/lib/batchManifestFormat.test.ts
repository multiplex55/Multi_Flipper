import { describe, expect, it } from "vitest";
import {
  formatBatchLinesToMultibuyLines,
  formatBatchLinesToMultibuyText,
  parseDetailedBatchLine,
} from "@/lib/batchManifestFormat";

describe("batchManifestFormat", () => {
  it("parses a detailed line and removes grouping commas from quantity", () => {
    const parsed = parseDetailedBatchLine("Zydrine | qty 15,000 | vol 150.5 m3 | profit 123 ISK");

    expect(parsed).toEqual({ typeName: "Zydrine", units: "15000" });
    expect(formatBatchLinesToMultibuyText(parsed ? [parsed] : [])).toBe("Zydrine 15000");
  });

  it("transforms a multi-line detailed sample line-for-line", () => {
    const input = [
      "Route: Jita -> Amarr",
      "Cargo m3: 72,000",
      "Items: 2",
      "Total volume: 4,200 m3",
      "Total profit: 9,999,999 ISK",
      "Total capital: 5,555,555 ISK",
      "",
      "Pyerite | qty 1,500 | vol 15 m3 | profit 450,000 ISK",
      "Heavy Water (Isotope-Grade) | qty 1 | vol 0.4 m3 | profit 1,000 ISK",
    ];

    const parsed = input.map((line) => parseDetailedBatchLine(line)).filter((line) => line != null);

    expect(formatBatchLinesToMultibuyText(parsed)).toBe(
      ["Pyerite 1500", "Heavy Water (Isotope-Grade) 1"].join("\n"),
    );
  });

  it("preserves punctuation, hyphens, and multi-word names", () => {
    const lines = [
      { typeName: "Heavy Water (Isotope-Grade)", units: "2,500" },
      { typeName: "Navy Cap Booster-400", units: 12 },
      { typeName: "Armor EM Hardener II", units: "35" },
    ];

    expect(formatBatchLinesToMultibuyLines(lines)).toEqual([
      "Heavy Water (Isotope-Grade) 2500",
      "Navy Cap Booster-400 12",
      "Armor EM Hardener II 35",
    ]);
  });

  it("keeps quantity 1 exactly as 1", () => {
    expect(formatBatchLinesToMultibuyText([{ typeName: "Tritanium", units: 1 }])).toBe(
      "Tritanium 1",
    );
  });

  it("output only contains item name and quantity from detailed input", () => {
    const detailedInput = [
      "Route: Jita -> Dodixie",
      "Cargo m3: 10,000",
      "Total volume: 1,200 m3",
      "Total profit: 3,000,000 ISK",
      "Scordite | qty 10,000 | vol 500 m3 | profit 200,000 ISK",
    ];

    const output = formatBatchLinesToMultibuyText(
      detailedInput
        .map((line) => parseDetailedBatchLine(line))
        .filter((line): line is { typeName: string; units: string } => line != null),
    );

    expect(output).toBe("Scordite 10000");
    expect(output).not.toContain("vol");
    expect(output).not.toContain("profit");
    expect(output).not.toContain("Route:");
    expect(output).not.toContain("Cargo");
    expect(output).not.toContain("Total");
  });

  it("returns empty output for empty input", () => {
    expect(formatBatchLinesToMultibuyText([])).toBe("");
    expect(formatBatchLinesToMultibuyLines([])).toEqual([]);
  });
});
