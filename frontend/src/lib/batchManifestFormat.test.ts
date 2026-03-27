import { describe, expect, it } from "vitest";
import {
  formatBaseSection,
  formatBatchLinesToMultibuyLines,
  formatBatchLinesToMultibuyText,
  formatFinalMergedSummarySection,
  formatMergedBatchManifestText,
  formatRouteAddedSection,
  formatRouteMetadataHeader,
  parseDetailedBatchLine,
} from "@/lib/batchManifestFormat";
import type { BaseBatchManifest, RouteAdditionOption } from "@/lib/types";

describe("batchManifestFormat", () => {
  it("parses a detailed line with extended columns and removes grouping commas from quantity", () => {
    const parsed = parseDetailedBatchLine(
      "Zydrine | qty 15,000 | buy total 1,500,000 ISK | buy per 100 ISK | sell total 1,800,000 ISK | sell per 120 ISK | vol 150.5 m3 | profit 123 ISK",
    );

    expect(parsed).toEqual({ typeName: "Zydrine", units: "15000" });
    expect(formatBatchLinesToMultibuyText(parsed ? [parsed] : [])).toBe("Zydrine 15000");
  });

  it("transforms mixed header and detailed lines into multibuy lines in order", () => {
    const input = [
      "Route: Jita -> Amarr",
      "Cargo m3: 72,000",
      "Buy Station: Jita IV - Moon 4",
      "Items: 2",
      "Total volume: 4,200 m3",
      "Total profit: 9,999,999 ISK",
      "Total capital: 5,555,555 ISK",
      "",
      "Pyerite | qty 1,500 | buy total 30,000 ISK | buy per 20 ISK | sell total 480,000 ISK | sell per 320 ISK | vol 15 m3 | profit 450,000 ISK",
      "Heavy Water (Isotope-Grade) | qty 1 | buy total 50 ISK | buy per 50 ISK | sell total 1,050 ISK | sell per 1,050 ISK | vol 0.4 m3 | profit 1,000 ISK",
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

describe("batch route manifest formatter", () => {
  const baseBatchManifest: BaseBatchManifest = {
    origin_system_id: 30000142,
    origin_system_name: "Jita",
    origin_location_id: 60003760,
    origin_location_name: "Jita IV - Moon 4",
    base_buy_system_id: 30000142,
    base_buy_location_id: 60003760,
    base_sell_system_id: 30002187,
    base_sell_location_id: 60008494,
    base_lines: [
      {
        type_id: 42,
        type_name: "Zydrine",
        units: 1050,
        unit_volume_m3: 0.01,
        buy_system_id: 30000142,
        buy_location_id: 60003760,
        sell_system_id: 30002187,
        sell_location_id: 60008494,
        buy_price_isk: 1000,
        sell_price_isk: 1500,
        buy_total_isk: 1_050_000,
        sell_total_isk: 1_575_000,
        profit_total_isk: 525_000,
        jumps: 9,
      },
      {
        type_id: 7,
        type_name: "Mexallon",
        units: 2000,
        unit_volume_m3: 0.01,
        buy_system_id: 30000142,
        buy_location_id: 60003760,
        sell_system_id: 30002187,
        sell_location_id: 60008494,
        buy_price_isk: 80,
        sell_price_isk: 120,
        buy_total_isk: 160_000,
        sell_total_isk: 240_000,
        profit_total_isk: 80_000,
        jumps: 9,
      },
    ],
    base_line_count: 2,
    total_units: 3050,
    total_volume_m3: 1250.2,
    total_buy_isk: 1_210_000,
    total_sell_isk: 1_815_000,
    total_profit_isk: 605_000,
    cargo_limit_m3: 5000,
    remaining_capacity_m3: 3749.8,
  };

  const selectedOption: RouteAdditionOption = {
    option_id: "opt-1",
    rank: 1,
    lines: [
      {
        type_id: 8,
        type_name: "Isogen",
        units: 500,
        unit_volume_m3: 0.01,
        buy_system_id: 30000142,
        buy_location_id: 60003760,
        sell_system_id: 30002187,
        sell_location_id: 60008494,
        buy_total_isk: 350_500,
        sell_total_isk: 500_900,
        profit_total_isk: 150_400,
        route_jumps: 11,
      },
      {
        type_id: 8,
        type_name: "Isogen",
        units: 120,
        unit_volume_m3: 0.01,
        buy_system_id: 30000142,
        buy_location_id: 60003760,
        sell_system_id: 30002187,
        sell_location_id: 60008494,
        buy_total_isk: 84_120,
        sell_total_isk: 120_360,
        profit_total_isk: 36_240,
        route_jumps: 11,
      },
    ],
    line_count: 2,
    added_volume_m3: 215.3,
    utilization_pct: 29.3,
    total_buy_isk: 434_620,
    total_sell_isk: 621_260,
    total_profit_isk: 186_640,
    total_jumps: 11,
    isk_per_jump: 16_967.27,
    ranking_inputs: {
      total_profit_isk: 186_640,
      total_jumps: 11,
      isk_per_jump: 16_967.27,
      utilization_pct: 29.3,
    },
    ranking_tie_break_values: [29.3, 8],
    ranking_sort_key: "A",
  };

  it("renders expected multiline layout with header, summary, base block and additions block", () => {
    const manifest = formatMergedBatchManifestText({
      baseBatchManifest,
      selectedOption,
      metadataHeader: {
        corridor: "Jita -> Amarr",
        jumps: selectedOption.total_jumps,
        iskPerJump: selectedOption.isk_per_jump,
      },
    });

    expect(manifest).toBe(
      [
        "Origin: Jita (Jita IV - Moon 4)",
        "Corridor: Jita -> Amarr",
        "Route jumps: 11",
        "ISK/jump: 16,967 ISK",
        "----- MERGED SUMMARY -----",
        "Lines: base 2 + added 2 = 4",
        "Units: 3,670 | Volume: 1,465.5 m3 / 5,000 m3 (remaining 3,534.5 m3)",
        "Totals: buy 1,644,620 ISK | sell 2,436,260 ISK | profit 791,640 ISK",
        "",
        "----- BASE ITEMS -----",
        "Mexallon x2,000 | buy 160,000 ISK | sell 240,000 ISK | profit 80,000 ISK",
        "Zydrine x1,050 | buy 1,050,000 ISK | sell 1,575,000 ISK | profit 525,000 ISK",
        "",
        "----- ROUTE ADDITIONS -----",
        "Isogen x500 | buy 350,500 ISK | sell 500,900 ISK | profit 150,400 ISK",
        "Isogen x120 | buy 84,120 ISK | sell 120,360 ISK | profit 36,240 ISK",
      ].join("\n"),
    );
  });

  it("computes merged ISK and jump summary math consistently", () => {
    expect(formatRouteMetadataHeader({ jumps: 9, iskPerJump: 10_500.99 })).toEqual([
      "Route jumps: 9",
      "ISK/jump: 10,501 ISK",
    ]);
    expect(
      formatFinalMergedSummarySection({
        baseBatchManifest,
        selectedOption,
      }),
    ).toContain("Totals: buy 1,644,620 ISK | sell 2,436,260 ISK | profit 791,640 ISK");
  });

  it("keeps duplicate item names as separate lines in deterministic order", () => {
    expect(formatRouteAddedSection(selectedOption.lines)).toEqual([
      "----- ROUTE ADDITIONS -----",
      "Isogen x500 | buy 350,500 ISK | sell 500,900 ISK | profit 150,400 ISK",
      "Isogen x120 | buy 84,120 ISK | sell 120,360 ISK | profit 36,240 ISK",
    ]);
    expect(formatBaseSection(baseBatchManifest)[1]).toContain("Mexallon");
  });

  it("shows a guard line when there are zero additions", () => {
    expect(formatRouteAddedSection([])).toEqual(["----- ROUTE ADDITIONS -----", "(none)"]);
  });
});
