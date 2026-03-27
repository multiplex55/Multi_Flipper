import { describe, expect, it } from "vitest";
import {
  formatBatchLinesToMultibuyLines,
  formatBatchLinesToMultibuyText,
  formatOrderedRouteManifestText,
  formatRouteMetadataHeader,
  parseDetailedBatchLine,
} from "@/lib/batchManifestFormat";
import type { OrderedRouteManifest } from "@/lib/types";

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
  const manifest: OrderedRouteManifest = {
    summary: {
      station_count: 2,
      item_count: 3,
      total_units: 3_550,
      total_volume_m3: 45.5,
      total_buy_isk: 1_555_000,
      total_sell_isk: 2_200_000,
      total_profit_isk: 645_000,
      total_jumps: 11,
      isk_per_jump: 58_636.36,
    },
    stations: [
      {
        station_key: "id:60003760",
        buy_station_name: "Jita IV - Moon 4",
        jumps_to_buy_station: 0,
        jumps_buy_to_sell: 9,
        item_count: 2,
        total_units: 3_050,
        total_volume_m3: 30.5,
        total_buy_isk: 1_210_000,
        total_sell_isk: 1_815_000,
        total_profit_isk: 605_000,
        isk_per_jump: 67_222.22,
        lines: [
          {
            type_id: 7,
            type_name: "Mexallon",
            units: 2_000,
            unit_volume_m3: 0.01,
            volume_m3: 20,
            buy_total_isk: 160_000,
            buy_per_isk: 80,
            sell_total_isk: 240_000,
            sell_per_isk: 120,
            profit_isk: 80_000,
          },
          {
            type_id: 42,
            type_name: "Zydrine",
            units: 1_050,
            unit_volume_m3: 0.01,
            volume_m3: 10.5,
            buy_total_isk: 1_050_000,
            buy_per_isk: 1_000,
            sell_total_isk: 1_575_000,
            sell_per_isk: 1_500,
            profit_isk: 525_000,
          },
        ],
      },
      {
        station_key: "id:60008494",
        buy_station_name: "Perimeter - Tranquility",
        jumps_to_buy_station: 1,
        jumps_buy_to_sell: 10,
        item_count: 1,
        total_units: 500,
        total_volume_m3: 15,
        total_buy_isk: 345_000,
        total_sell_isk: 385_000,
        total_profit_isk: 40_000,
        isk_per_jump: 3_636.36,
        lines: [
          {
            type_id: 8,
            type_name: "Isogen",
            units: 500,
            unit_volume_m3: 0.03,
            volume_m3: 15,
            buy_total_isk: 345_000,
            buy_per_isk: 690,
            sell_total_isk: 385_000,
            sell_per_isk: 770,
            profit_isk: 40_000,
          },
        ],
      },
    ],
  };

  it("renders summary, station blocks, compact item list, and detailed rows", () => {
    const text = formatOrderedRouteManifestText({
      originLabel: "Jita (Jita IV - Moon 4)",
      metadataHeader: {
        corridor: "Jita -> Amarr",
        jumps: 11,
        iskPerJump: 58_636.36,
      },
      manifest,
    });

    expect(text).toBe(
      [
        "Origin: Jita (Jita IV - Moon 4)",
        "Corridor: Jita -> Amarr",
        "Route jumps: 11",
        "ISK/jump: 58,636 ISK",
        "----- ROUTE SUMMARY -----",
        "Stations: 2 | Items: 3 | Units: 3,550",
        "Totals: vol 45.5 m3 | buy 1,555,000 ISK | sell 2,200,000 ISK | profit 645,000 ISK",
        "Route: jumps 11 | ISK/jump 58,636 ISK",
        "",
        "----- STATION 1: Jita IV - Moon 4 -----",
        "Jumps to Buy Station: 0",
        "Jumps Buy -> Sell: 9",
        "Items: 2 | Units: 3,050 | Volume: 30.5 m3",
        "Capital: 1,210,000 ISK | Gross Sell: 1,815,000 ISK | Profit: 605,000 ISK | ISK/jump: 67,222 ISK",
        "Item list: Mexallon 2,000, Zydrine 1,050",
        "Mexallon | qty 2,000 | buy total 160,000 ISK | buy per 80 ISK | sell total 240,000 ISK | sell per 120 ISK | vol 20 m3 | profit 80,000 ISK",
        "Zydrine | qty 1,050 | buy total 1,050,000 ISK | buy per 1,000 ISK | sell total 1,575,000 ISK | sell per 1,500 ISK | vol 10.5 m3 | profit 525,000 ISK",
        "",
        "----- STATION 2: Perimeter - Tranquility -----",
        "Jumps to Buy Station: 1",
        "Jumps Buy -> Sell: 10",
        "Items: 1 | Units: 500 | Volume: 15 m3",
        "Capital: 345,000 ISK | Gross Sell: 385,000 ISK | Profit: 40,000 ISK | ISK/jump: 3,636 ISK",
        "Item list: Isogen 500",
        "Isogen | qty 500 | buy total 345,000 ISK | buy per 690 ISK | sell total 385,000 ISK | sell per 770 ISK | vol 15 m3 | profit 40,000 ISK",
      ].join("\n"),
    );
  });

  it("still formats metadata header independently", () => {
    expect(formatRouteMetadataHeader({ jumps: 9, iskPerJump: 10_500.99 })).toEqual([
      "Route jumps: 9",
      "ISK/jump: 10,501 ISK",
    ]);
  });
});
