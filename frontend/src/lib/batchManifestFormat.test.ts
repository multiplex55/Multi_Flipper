import { describe, expect, it } from "vitest";
import {
  buildOrderedRouteManifestFromRouteResult,
  buildRadiusRecommendationBuyChecklistText,
  buildRadiusRecommendationMultibuyText,
  buildRadiusRecommendationSellChecklistText,
  formatBatchLinesToMultibuyLines,
  formatRadiusBuyRecommendationManifestText,
  formatBatchLinesToMultibuyText,
  formatOrderedRouteManifestText,
  formatRouteMetadataHeader,
  parseDetailedBatchLine,
} from "@/lib/batchManifestFormat";
import type { RadiusBuyRecommendation } from "@/lib/radiusBuyRecommendation";
import type { OrderedRouteManifest, RouteResult } from "@/lib/types";

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

describe("radius recommendation manifest formatter", () => {
  const recommendation: RadiusBuyRecommendation = {
    id: "rec-1",
    kind: "cargo_build",
    action: "buy",
    title: "Test",
    lines: [
      {
        typeId: 1,
        typeName: "Tritanium",
        qty: 1500,
        unitVolumeM3: 0,
        volumeM3: 0,
        buyUnitIsk: 7,
        sellUnitIsk: 10,
        profitUnitIsk: 3,
        buyTotalIsk: 10500,
        sellTotalIsk: 15000,
        profitTotalIsk: 4500,
        routeKey: "r1",
        row: { BuyJumps: 2, SellJumps: 1, BuyStation: "Jita", SellStation: "Amarr" } as never,
      },
    ],
    reasons: [],
    warnings: [],
    blockers: [],
  };

  it("formats recommendation manifest with header, detail rows, and multibuy block", () => {
    const text = formatRadiusBuyRecommendationManifestText(recommendation);
    expect(text).toContain("Buy Station: Jita");
    expect(text).toContain("Jumps to Buy Station: 2");
    expect(text).toContain("Sell Station: Amarr");
    expect(text).toContain("Jumps Buy -> Sell: 1");
    expect(text).toContain("Total isk/jump: 1,500 ISK");
    expect(text).toContain("Tritanium | qty 1,500");
    expect(text).toContain("vol 0 m3");
    expect(text).toContain("Tritanium 1500");
  });

  it("builds checklist and multibuy text", () => {
    expect(buildRadiusRecommendationMultibuyText(recommendation)).toBe("Tritanium 1500");
    expect(buildRadiusRecommendationBuyChecklistText(recommendation)).toContain("buy total 10,500 ISK");
    expect(buildRadiusRecommendationSellChecklistText(recommendation)).toContain("sell total 15,000 ISK");
  });
});

describe("batch route manifest formatter", () => {
  it("keeps same item name in separate station blocks", () => {
    const manifest: OrderedRouteManifest = {
      summary: {
        station_count: 2,
        item_count: 2,
        total_units: 1_500,
        total_volume_m3: 15,
        total_buy_isk: 14_200,
        total_sell_isk: 18_600,
        total_profit_isk: 4_400,
        total_jumps: 8,
        isk_per_jump: 550,
      },
      stations: [
        {
          station_key: "id:60003760",
          buy_station_name: "Jita IV - Moon 4",
          jumps_to_buy_station: 0,
          jumps_buy_to_sell: 4,
          item_count: 1,
          total_volume_m3: 10,
          total_buy_isk: 8_000,
          total_sell_isk: 10_500,
          total_profit_isk: 2_500,
          isk_per_jump: 625,
          lines: [
            {
              type_id: 34,
              type_name: "Tritanium",
              units: 1_000,
              unit_volume_m3: 0.01,
              volume_m3: 10,
              buy_total_isk: 8_000,
              buy_per_isk: 8,
              sell_total_isk: 10_500,
              sell_per_isk: 10.5,
              profit_isk: 2_500,
            },
          ],
        },
        {
          station_key: "id:60008494",
          buy_station_name: "Amarr VIII (Oris) - Emperor Family Academy",
          jumps_to_buy_station: 2,
          jumps_buy_to_sell: 2,
          item_count: 1,
          total_volume_m3: 5,
          total_buy_isk: 6_200,
          total_sell_isk: 8_100,
          total_profit_isk: 1_900,
          isk_per_jump: 475,
          lines: [
            {
              type_id: 34,
              type_name: "Tritanium",
              units: 500,
              unit_volume_m3: 0.01,
              volume_m3: 5,
              buy_total_isk: 6_200,
              buy_per_isk: 12.4,
              sell_total_isk: 8_100,
              sell_per_isk: 16.2,
              profit_isk: 1_900,
            },
          ],
        },
      ],
    };

    const text = formatOrderedRouteManifestText({ manifest });
    expect(text).toContain("Buy Station: Jita IV - Moon 4");
    expect(text).toContain("Buy Station: Amarr VIII (Oris) - Emperor Family Academy");
    expect(text).toContain("------------------------");
    expect(text).toContain("Items: 1");
    expect(text).toContain("Cargo m3:");
    expect(text).toContain("Tritanium 1000");
    expect(text).toContain("Tritanium 500");
    expect(text).not.toMatch(/^Station:/m);
    expect(text).not.toContain("Item list:");
    expect(text).not.toContain("----- ROUTE SUMMARY -----");
    expect(text).not.toContain("----- MERGED SUMMARY -----");
  });

  it("renders station blocks in route visit order and supports station-name fallback keys", () => {
    const text = formatOrderedRouteManifestText({
      manifest: {
        summary: {
          station_count: 2,
          item_count: 2,
          total_units: 60,
          total_volume_m3: 120,
          total_buy_isk: 450_000,
          total_sell_isk: 600_000,
          total_profit_isk: 150_000,
          total_jumps: 9,
          isk_per_jump: 16_666.67,
        },
        stations: [
          {
            station_key: "name:perimeter-tranquility",
            buy_station_name: "Perimeter - Tranquility",
            jumps_to_buy_station: 1,
            jumps_buy_to_sell: 5,
            item_count: 1,
            total_volume_m3: 80,
            total_buy_isk: 300_000,
            total_sell_isk: 420_000,
            total_profit_isk: 120_000,
            isk_per_jump: 20_000,
            lines: [
              {
                type_id: 9002,
                type_name: "Megacyte",
                units: 40,
                unit_volume_m3: 2,
                volume_m3: 80,
                buy_total_isk: 300_000,
                buy_per_isk: 7_500,
                sell_total_isk: 420_000,
                sell_per_isk: 10_500,
                profit_isk: 120_000,
              },
            ],
          },
          {
            station_key: "name:jita-iv-moon-4",
            buy_station_name: "Jita IV - Moon 4",
            jumps_to_buy_station: 0,
            jumps_buy_to_sell: 3,
            item_count: 1,
            total_volume_m3: 40,
            total_buy_isk: 150_000,
            total_sell_isk: 180_000,
            total_profit_isk: 30_000,
            isk_per_jump: 10_000,
            lines: [
              {
                type_id: 34,
                type_name: "Tritanium",
                units: 20,
                unit_volume_m3: 2,
                volume_m3: 40,
                buy_total_isk: 150_000,
                buy_per_isk: 7_500,
                sell_total_isk: 180_000,
                sell_per_isk: 9_000,
                profit_isk: 30_000,
              },
            ],
          },
        ],
      },
    });

    const perimeterIndex = text.indexOf("Buy Station: Perimeter - Tranquility");
    const jitaIndex = text.indexOf("Buy Station: Jita IV - Moon 4");
    expect(perimeterIndex).toBeGreaterThan(-1);
    expect(jitaIndex).toBeGreaterThan(-1);
    expect(perimeterIndex).toBeLessThan(jitaIndex);
    expect(text).not.toMatch(/^Station:\s*Perimeter - Tranquility$/m);
    expect(text).not.toMatch(/^Station:\s*Jita IV - Moon 4$/m);
  });

  it("renders station autobuy lines after detailed rows in deterministic line order", () => {
    const text = formatOrderedRouteManifestText({
      manifest: {
        stations: [
          {
            station_key: "id:60003760",
            buy_station_name: "Jita IV - Moon 4",
            jumps_to_buy_station: 0,
            jumps_buy_to_sell: 3,
            item_count: 2,
            total_volume_m3: 6,
            total_buy_isk: 33_000,
            total_sell_isk: 46_500,
            total_profit_isk: 13_500,
            isk_per_jump: 4_500,
            lines: [
              {
                type_id: 35,
                type_name: "Pyerite",
                units: 3000,
                unit_volume_m3: 0.01,
                volume_m3: 30,
                buy_total_isk: 18_000,
                buy_per_isk: 6,
                sell_total_isk: 27_000,
                sell_per_isk: 9,
                profit_isk: 9_000,
              },
              {
                type_id: 36,
                type_name: "Mexallon",
                units: 750,
                unit_volume_m3: 0.01,
                volume_m3: 7.5,
                buy_total_isk: 15_000,
                buy_per_isk: 20,
                sell_total_isk: 19_500,
                sell_per_isk: 26,
                profit_isk: 4_500,
              },
            ],
          },
        ],
      },
    });

    expect(text).toContain(
      "Pyerite | qty 3,000 | buy total 18,000 ISK | buy per 6 ISK | sell total 27,000 ISK | sell per 9 ISK | vol 30 m3 | profit 9,000 ISK",
    );
    expect(text).toContain(
      "Mexallon | qty 750 | buy total 15,000 ISK | buy per 20 ISK | sell total 19,500 ISK | sell per 26 ISK | vol 7.5 m3 | profit 4,500 ISK",
    );
    expect(text).toContain("\n\nPyerite 3000\nMexallon 750");
    expect(text).not.toContain("Item list:");
  });

  it("enforces required station field labels exactly and rejects legacy debug headings", () => {
    const text = formatOrderedRouteManifestText({
      originLabel: "Jita (Jita IV - Moon 4)",
      metadataHeader: { corridor: "Jita -> Amarr", jumps: 4, iskPerJump: 3_750 },
      manifest: {
        stations: [
          {
            station_key: "id:60003760",
            buy_station_name: "Jita IV - Moon 4",
            jumps_to_buy_station: 0,
            jumps_buy_to_sell: 4,
            item_count: 1,
            total_volume_m3: 20,
            total_buy_isk: 40_000,
            total_sell_isk: 55_000,
            total_profit_isk: 15_000,
            isk_per_jump: 3_750,
            lines: [],
          },
        ],
      },
    });

    const requiredLabels = [
      "Buy Station:",
      "Jumps to Buy Station:",
      "Sell Station:",
      "Jumps Buy -> Sell:",
      "Cargo m3:",
      "Items:",
      "Total volume:",
      "Total capital:",
      "Total gross sell:",
      "Total profit:",
      "Total isk/jump:",
    ];

    for (const label of requiredLabels) {
      const matches = text.match(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gm"));
      expect(matches?.length ?? 0).toBe(1);
    }

    expect(text).not.toMatch(/^Station:/m);
    expect(text).not.toContain("Item list:");
    expect(text).not.toContain("----- ROUTE SUMMARY -----");
    expect(text).not.toContain("----- MERGED SUMMARY -----");
    expect(text).not.toContain("Route: jumps");
  });

  it("does not include raw station ID labels when station names are provided", () => {
    const text = formatOrderedRouteManifestText({
      manifest: {
        summary: {
          station_count: 1,
          item_count: 1,
          total_units: 10,
          total_volume_m3: 20,
          total_buy_isk: 100_000,
          total_sell_isk: 130_000,
          total_profit_isk: 30_000,
          total_jumps: 3,
          isk_per_jump: 10_000,
        },
        stations: [
          {
            station_key: "id:60003760",
            buy_station_name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
            jumps_to_buy_station: 0,
            jumps_buy_to_sell: 3,
            item_count: 1,
            total_volume_m3: 20,
            total_buy_isk: 100_000,
            total_sell_isk: 130_000,
            total_profit_isk: 30_000,
            isk_per_jump: 10_000,
            lines: [
              {
                type_id: 34,
                type_name: "Tritanium",
                units: 10,
                unit_volume_m3: 2,
                volume_m3: 20,
                buy_total_isk: 100_000,
                buy_per_isk: 10_000,
                sell_total_isk: 130_000,
                sell_per_isk: 13_000,
                profit_isk: 30_000,
              },
            ],
          },
        ],
      },
    });

    expect(text).toContain("Buy Station: Jita IV - Moon 4 - Caldari Navy Assembly Plant");
    expect(text).not.toContain("Buy Station: Station 60003760");
  });

  it("renders numeric totals and rounded per-unit values in station details", () => {
    const text = formatOrderedRouteManifestText({
      originLabel: "Jita (Jita IV - Moon 4)",
      metadataHeader: {
        corridor: "Jita -> Amarr",
        jumps: 7,
        iskPerJump: 12_345.49,
      },
      manifest: {
        summary: {
          station_count: 1,
          item_count: 1,
          total_units: 33,
          total_volume_m3: 66,
          total_buy_isk: 100_001,
          total_sell_isk: 150_002,
          total_profit_isk: 50_001,
          total_jumps: 7,
          isk_per_jump: 7_143,
        },
        stations: [
          {
            station_key: "id:60003760",
            buy_station_name: "Jita IV - Moon 4",
            jumps_to_buy_station: 0,
            jumps_buy_to_sell: 7,
            item_count: 1,
            total_volume_m3: 66,
            total_buy_isk: 100_001,
            total_sell_isk: 150_002,
            total_profit_isk: 50_001,
            isk_per_jump: 7_143,
            lines: [
              {
                type_id: 9003,
                type_name: "Isogen",
                units: 33,
                unit_volume_m3: 2,
                volume_m3: 66,
                buy_total_isk: 100_001,
                buy_per_isk: 3_030.33,
                sell_total_isk: 150_002,
                sell_per_isk: 4_545.51,
                profit_isk: 50_001,
              },
            ],
          },
        ],
      },
    });

    expect(text).toContain("Origin: Jita (Jita IV - Moon 4)");
    expect(text).toContain("Sell Station: Amarr");
    expect(text).toContain("Cargo m3: 66 m3");
    expect(text).toContain("Stations: 1");
    expect(text).toContain("Items: 1");
    expect(text).toContain("Total volume: 66 m3");
    expect(text).toContain("Total capital: 100,001 ISK");
    expect(text).toContain("Total gross sell: 150,002 ISK");
    expect(text).toContain("Total profit: 50,001 ISK");
    expect(text).toContain("Total isk/jump: 7,143 ISK");
    expect(text).not.toContain("----- ROUTE SUMMARY -----");
    expect(text).not.toContain("Route: jumps");
    expect(text).toContain(
      "Isogen | qty 33 | buy total 100,001 ISK | buy per 3,030 ISK | sell total 150,002 ISK | sell per 4,546 ISK | vol 66 m3 | profit 50,001 ISK",
    );
  });

  it("renders every required station field label in each station block", () => {
    const text = formatOrderedRouteManifestText({
      manifest: {
        stations: [
          {
            station_key: "id:1",
            buy_station_name: "Jita IV - Moon 4",
            sell_station_name: "Amarr VIII (Oris) - Emperor Family Academy",
            cargo_m3: 12_000,
            jumps_to_buy_station: 1,
            jumps_buy_to_sell: 5,
            item_count: 1,
            total_volume_m3: 80,
            total_buy_isk: 300_000,
            total_sell_isk: 420_000,
            total_profit_isk: 120_000,
            isk_per_jump: 20_000,
            lines: [],
          },
        ],
      },
    });

    expect(text).toContain("Buy Station:");
    expect(text).toContain("Jumps to Buy Station:");
    expect(text).toContain("Sell Station:");
    expect(text).toContain("Jumps Buy -> Sell:");
    expect(text).toContain("Cargo m3:");
    expect(text).toContain("Items:");
    expect(text).toContain("Total volume:");
    expect(text).toContain("Total capital:");
    expect(text).toContain("Total gross sell:");
    expect(text).toContain("Total profit:");
    expect(text).toContain("Total isk/jump:");
  });

  it("renders a canonical two-station layout with strict ordering", () => {
    const text = formatOrderedRouteManifestText({
      originLabel: "Jita (Jita IV - Moon 4)",
      metadataHeader: { corridor: "Jita -> Amarr", jumps: 7, iskPerJump: 9_286 },
      manifest: {
        summary: {
          station_count: 2,
          item_count: 2,
          total_units: 150,
          total_volume_m3: 100,
          total_buy_isk: 300_000,
          total_sell_isk: 430_000,
          total_profit_isk: 130_000,
          total_jumps: 7,
          isk_per_jump: 18_571,
        },
        stations: [
          {
            station_key: "id:60003760",
            buy_station_name: "Jita IV - Moon 4",
            sell_station_name: "Amarr VIII (Oris) - Emperor Family Academy",
            jumps_to_buy_station: 0,
            jumps_buy_to_sell: 4,
            cargo_m3: 100,
            item_count: 1,
            total_volume_m3: 40,
            total_buy_isk: 120_000,
            total_sell_isk: 180_000,
            total_profit_isk: 60_000,
            isk_per_jump: 15_000,
            lines: [
              {
                type_id: 34,
                type_name: "Tritanium",
                units: 100,
                unit_volume_m3: 0.4,
                volume_m3: 40,
                buy_total_isk: 120_000,
                buy_per_isk: 1_200,
                sell_total_isk: 180_000,
                sell_per_isk: 1_800,
                profit_isk: 60_000,
              },
            ],
          },
          {
            station_key: "id:60008494",
            buy_station_name: "Amarr VIII (Oris) - Emperor Family Academy",
            sell_station_name: "Dodixie IX - Moon 20",
            jumps_to_buy_station: 3,
            jumps_buy_to_sell: 0,
            cargo_m3: 100,
            item_count: 1,
            total_volume_m3: 60,
            total_buy_isk: 180_000,
            total_sell_isk: 250_000,
            total_profit_isk: 70_000,
            isk_per_jump: 23_333,
            lines: [
              {
                type_id: 35,
                type_name: "Pyerite",
                units: 50,
                unit_volume_m3: 1.2,
                volume_m3: 60,
                buy_total_isk: 180_000,
                buy_per_isk: 3_600,
                sell_total_isk: 250_000,
                sell_per_isk: 5_000,
                profit_isk: 70_000,
              },
            ],
          },
        ],
      },
    });

    expect(text).toBe(
      [
        "Origin: Jita (Jita IV - Moon 4)",
        "Sell Station: Amarr",
        "Cargo m3: 100 m3",
        "Stations: 2",
        "Items: 2",
        "Total volume: 100 m3",
        "Total capital: 300,000 ISK",
        "Total gross sell: 430,000 ISK",
        "Total profit: 130,000 ISK",
        "Total isk/jump: 18,571 ISK",
        "",
        "Buy Station: Jita IV - Moon 4",
        "Jumps to Buy Station: 0",
        "Sell Station: Amarr VIII (Oris) - Emperor Family Academy",
        "Jumps Buy -> Sell: 4",
        "Cargo m3: 100 m3",
        "Items: 1",
        "Total volume: 40 m3",
        "Total capital: 120,000 ISK",
        "Total gross sell: 180,000 ISK",
        "Total profit: 60,000 ISK",
        "Total isk/jump: 15,000 ISK",
        "Tritanium | qty 100 | buy total 120,000 ISK | buy per 1,200 ISK | sell total 180,000 ISK | sell per 1,800 ISK | vol 40 m3 | profit 60,000 ISK",
        "",
        "Tritanium 100",
        "",
        "------------------------",
        "Buy Station: Amarr VIII (Oris) - Emperor Family Academy",
        "Jumps to Buy Station: 3",
        "Sell Station: Dodixie IX - Moon 20",
        "Jumps Buy -> Sell: 0",
        "Cargo m3: 100 m3",
        "Items: 1",
        "Total volume: 60 m3",
        "Total capital: 180,000 ISK",
        "Total gross sell: 250,000 ISK",
        "Total profit: 70,000 ISK",
        "Total isk/jump: 23,333 ISK",
        "Pyerite | qty 50 | buy total 180,000 ISK | buy per 3,600 ISK | sell total 250,000 ISK | sell per 5,000 ISK | vol 60 m3 | profit 70,000 ISK",
        "",
        "Pyerite 50",
      ].join("\n"),
    );
  });

  it("omits top-level summary fields when manifest summary is absent and still renders stations", () => {
    const text = formatOrderedRouteManifestText({
      originLabel: "Jita",
      metadataHeader: { corridor: "Jita -> Dodixie", jumps: 4, iskPerJump: 3_200 },
      manifest: {
        stations: [
          {
            station_key: "id:60003760",
            buy_station_name: "Jita IV - Moon 4",
            jumps_to_buy_station: 0,
            jumps_buy_to_sell: 4,
            item_count: 1,
            total_volume_m3: 20,
            total_buy_isk: 40_000,
            total_sell_isk: 55_000,
            total_profit_isk: 15_000,
            isk_per_jump: 3_750,
            lines: [
              {
                type_id: 34,
                type_name: "Tritanium",
                units: 10,
                unit_volume_m3: 2,
                volume_m3: 20,
                buy_total_isk: 40_000,
                buy_per_isk: 4_000,
                sell_total_isk: 55_000,
                sell_per_isk: 5_500,
                profit_isk: 15_000,
              },
            ],
          },
        ],
      },
    });

    expect(text).toContain("Origin: Jita");
    expect(text).toContain("Buy Station: Jita IV - Moon 4");
    expect(text).toContain("Sell Station: Dodixie");
    expect(text).toContain("Cargo m3: 0 m3");
    expect(text).toContain("Total capital: 40,000 ISK");
    expect(text).not.toContain("----- ROUTE SUMMARY -----");
    expect(text).not.toContain("Route: jumps");
  });

  it("still formats metadata header independently", () => {
    expect(formatRouteMetadataHeader({ jumps: 9, iskPerJump: 10_500.99 })).toEqual([
      "Route jumps: 9",
      "ISK/jump: 10,501 ISK",
    ]);
  });

  it("renders unknown jump metadata as N/A instead of coercing to zero", () => {
    const text = formatOrderedRouteManifestText({
      manifest: {
        summary: {
          station_count: 1,
          item_count: 1,
          total_units: 10,
          total_volume_m3: 20,
          total_buy_isk: 40_000,
          total_sell_isk: 55_000,
          total_profit_isk: 15_000,
          total_jumps: 0,
          isk_per_jump: undefined,
        },
        stations: [
          {
            station_key: "id:60003760",
            buy_station_name: "Jita IV - Moon 4",
            jumps_to_buy_station: null,
            jumps_buy_to_sell: null,
            item_count: 1,
            total_volume_m3: 20,
            total_buy_isk: 40_000,
            total_sell_isk: 55_000,
            total_profit_isk: 15_000,
            isk_per_jump: null,
            lines: [],
          },
        ],
      },
    });

    expect(text).toContain("Jumps to Buy Station: N/A");
    expect(text).toContain("Jumps Buy -> Sell: N/A");
    expect(text).toContain("Total isk/jump: N/A ISK");
    expect(text).not.toContain("Jumps to Buy Station: 0");
    expect(text).not.toContain("Jumps Buy -> Sell: 0");
  });

  it("keeps true zero jump values renderable", () => {
    const text = formatOrderedRouteManifestText({
      manifest: {
        stations: [
          {
            station_key: "id:60003760",
            buy_station_name: "Jita IV - Moon 4",
            jumps_to_buy_station: 0,
            jumps_buy_to_sell: 0,
            item_count: 0,
            total_volume_m3: 0,
            total_buy_isk: 0,
            total_sell_isk: 0,
            total_profit_isk: 0,
            isk_per_jump: 0,
            lines: [],
          },
        ],
      },
    });

    expect(text).toContain("Jumps to Buy Station: 0");
    expect(text).toContain("Jumps Buy -> Sell: 0");
    expect(text).toContain("Total isk/jump: 0 ISK");
  });
});

describe("route copy formatter parity", () => {
  it("uses the same manifest formatter output for route copy single-hop", () => {
    const route: RouteResult = {
      Hops: [
        {
          SystemName: "Jita",
          StationName: "Jita IV - Moon 4",
          SystemID: 30000142,
          DestSystemName: "Perimeter",
          DestStationName: "Tranquility Trading Tower",
          DestSystemID: 30000144,
          TypeName: "Tritanium",
          TypeID: 34,
          BuyPrice: 4,
          SellPrice: 6.5,
          Units: 1_000,
          Profit: 2_500,
          Jumps: 1,
        },
      ],
      TotalProfit: 2_500,
      TotalJumps: 1,
      ProfitPerJump: 2_500,
      HopCount: 1,
    };

    const manifestFromRoute = buildOrderedRouteManifestFromRouteResult(route);
    const routeText = formatOrderedRouteManifestText({ manifest: manifestFromRoute });
    const expected = [
      "Cargo m3: 0 m3",
      "Stations: 1",
      "Items: 1",
      "Total volume: 0 m3",
      "Total capital: 4,000 ISK",
      "Total gross sell: 6,500 ISK",
      "Total profit: 2,500 ISK",
      "Total isk/jump: 2,500 ISK",
      "",
      "Buy Station: Jita IV - Moon 4 (Jita)",
      "Jumps to Buy Station: 0",
      "Sell Station: Tranquility Trading Tower (Perimeter)",
      "Jumps Buy -> Sell: 1",
      "Cargo m3: 0 m3",
      "Items: 1",
      "Total volume: 0 m3",
      "Total capital: 4,000 ISK",
      "Total gross sell: 6,500 ISK",
      "Total profit: 2,500 ISK",
      "Total isk/jump: 2,500 ISK",
      "Tritanium | qty 1,000 | buy total 4,000 ISK | buy per 4 ISK | sell total 6,500 ISK | sell per 7 ISK | vol 0 m3 | profit 2,500 ISK",
      "",
      "Tritanium 1000",
    ].join("\n");

    expect(routeText).toBe(expected);
    expect(routeText).toContain("Buy Station: Jita IV - Moon 4 (Jita)");
    expect(routeText).toContain("Sell Station: Tranquility Trading Tower (Perimeter)");
  });

  it("formats multi-hop routes and preserves buy/sell station labels per hop", () => {
    const route: RouteResult = {
      Hops: [
        {
          SystemName: "Jita",
          StationName: "Jita IV - Moon 4",
          SystemID: 30000142,
          DestSystemName: "Perimeter",
          DestStationName: "TTT",
          DestSystemID: 30000144,
          TypeName: "Tritanium",
          TypeID: 34,
          BuyPrice: 5,
          SellPrice: 8,
          Units: 500,
          Profit: 1_500,
          Jumps: 1,
        },
        {
          SystemName: "Amarr",
          StationName: "Amarr VIII (Oris) - Emperor Family Academy",
          SystemID: 30002187,
          EmptyJumps: 2,
          DestSystemName: "Dodixie",
          DestStationName: "Dodixie IX - Moon 20",
          DestSystemID: 30002659,
          TypeName: "Pyerite",
          TypeID: 35,
          BuyPrice: 12,
          SellPrice: 16,
          Units: 700,
          Profit: 2_800,
          Jumps: 9,
        },
      ],
      TotalProfit: 4_300,
      TotalJumps: 12,
      ProfitPerJump: 358.33,
      HopCount: 2,
    };

    const text = formatOrderedRouteManifestText({
      manifest: buildOrderedRouteManifestFromRouteResult(route),
    });

    expect(text).toContain("Buy Station: Jita IV - Moon 4 (Jita)");
    expect(text).toContain("Sell Station: TTT (Perimeter)");
    expect(text).toContain("Buy Station: Amarr VIII (Oris) - Emperor Family Academy (Amarr)");
    expect(text).toContain("Sell Station: Dodixie IX - Moon 20 (Dodixie)");
    expect(text).toContain("Jumps Buy -> Sell: 11");
    expect(text).toContain("------------------------");
  });

  it("falls back for missing station metadata while preserving manifest structure", () => {
    const route: RouteResult = {
      Hops: [
        {
          SystemName: "",
          StationName: "",
          SystemID: 10,
          DestSystemName: "Rens",
          DestStationName: "",
          DestSystemID: 20,
          TypeName: "Mexallon",
          TypeID: 36,
          BuyPrice: 10,
          SellPrice: 11,
          Units: 10,
          Profit: 10,
          Jumps: 3,
        },
      ],
      TotalProfit: 10,
      TotalJumps: 3,
      ProfitPerJump: 3.33,
      HopCount: 1,
    };

    const text = formatOrderedRouteManifestText({
      manifest: buildOrderedRouteManifestFromRouteResult(route),
    });

    expect(text).toContain("Buy Station: Unknown Station (Unknown System)");
    expect(text).toContain("Sell Station: Unknown Station (Rens)");
    expect(text).toContain("Mexallon 10");
  });

  it("returns an empty manifest for empty routes and can be rejected by route copy UX", () => {
    const route: RouteResult = {
      Hops: [],
      TotalProfit: 0,
      TotalJumps: 0,
      ProfitPerJump: 0,
      HopCount: 0,
    };
    const manifest = buildOrderedRouteManifestFromRouteResult(route);
    const text = formatOrderedRouteManifestText({ manifest });

    expect(manifest.stations).toEqual([]);
    expect(text).toContain("Stations: 0");
    expect(text).toContain("Items: 0");
  });

  it("guards against formatter drift by asserting route-copy output equals shared manifest output", () => {
    const route: RouteResult = {
      Hops: [
        {
          SystemName: "Hek",
          StationName: "Boundless Creation Factory",
          SystemID: 1,
          DestSystemName: "Rens",
          DestStationName: "Brutor Tribe Treasury",
          DestSystemID: 2,
          TypeName: "Nocxium",
          TypeID: 38,
          BuyPrice: 900,
          SellPrice: 1_200,
          Units: 80,
          Profit: 24_000,
          Jumps: 4,
        },
      ],
      TotalProfit: 24_000,
      TotalJumps: 4,
      ProfitPerJump: 6_000,
      HopCount: 1,
    };

    const sharedManifest = buildOrderedRouteManifestFromRouteResult(route);
    const manifestOutput = formatOrderedRouteManifestText({ manifest: sharedManifest });
    const routeCopyOutput = formatOrderedRouteManifestText({
      manifest: buildOrderedRouteManifestFromRouteResult(route),
    });

    expect(routeCopyOutput).toBe(manifestOutput);
  });
});
