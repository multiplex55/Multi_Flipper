import { describe, expect, it } from "vitest";
import type { OrderedRouteManifest } from "@/lib/types";
import { validateOrderedRouteManifest } from "@/lib/routeManifestValidation";

function makeValidManifest(): OrderedRouteManifest {
  return {
    summary: {
      station_count: 2,
      item_count: 2,
      total_units: 30,
      total_volume_m3: 0,
      total_buy_isk: 3_000,
      total_sell_isk: 3_500,
      total_profit_isk: 500,
      total_jumps: 9,
      isk_per_jump: 55.55,
    },
    stations: [
      {
        station_key: "hop-1",
        buy_station_name: "A",
        sell_station_name: "B",
        jumps_to_buy_station: 0,
        jumps_buy_to_sell: 4,
        item_count: 1,
        total_volume_m3: 0,
        total_buy_isk: 1_000,
        total_sell_isk: 1_200,
        total_profit_isk: 200,
        lines: [
          {
            type_id: 34,
            type_name: "Tritanium",
            units: 10,
            unit_volume_m3: 0,
            volume_m3: 0,
            buy_total_isk: 1_000,
            buy_per_isk: 100,
            sell_total_isk: 1_200,
            sell_per_isk: 120,
            profit_isk: 200,
          },
        ],
      },
      {
        station_key: "hop-2",
        buy_station_name: "B",
        sell_station_name: "C",
        jumps_to_buy_station: 4,
        jumps_buy_to_sell: 5,
        item_count: 1,
        total_volume_m3: 0,
        total_buy_isk: 2_000,
        total_sell_isk: 2_300,
        total_profit_isk: 300,
        lines: [
          {
            type_id: 35,
            type_name: "Pyerite",
            units: 20,
            unit_volume_m3: 0,
            volume_m3: 0,
            buy_total_isk: 2_000,
            buy_per_isk: 100,
            sell_total_isk: 2_300,
            sell_per_isk: 115,
            profit_isk: 300,
          },
        ],
      },
    ],
  };
}

describe("validateOrderedRouteManifest", () => {
  it("passes when totals differ only within rounding tolerance", () => {
    const manifest = makeValidManifest();
    manifest.stations[0]!.total_buy_isk = 1_000.49;
    manifest.summary!.total_buy_isk = 3_000.49;

    const result = validateOrderedRouteManifest(manifest);

    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it("fails when hop/route totals are mismatched beyond tolerance", () => {
    const manifest = makeValidManifest();
    manifest.stations[1]!.total_profit_isk = 400;
    manifest.summary!.total_profit_isk = 700;

    const result = validateOrderedRouteManifest(manifest);

    expect(result.isValid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["RMV_HOP_TOTAL_PROFIT_MISMATCH", "RMV_ROUTE_TOTAL_PROFIT_MISMATCH"]),
    );
  });

  it("returns warning (not hard fail) when jump fields are missing", () => {
    const manifest = makeValidManifest();
    manifest.stations[1]!.jumps_buy_to_sell = null;

    const result = validateOrderedRouteManifest(manifest);

    expect(result.errors).toEqual([]);
    expect(result.warnings.map((issue) => issue.code)).toContain("RMV_HOP_MISSING_JUMPS_BUY_TO_SELL");
    expect(result.isUsable).toBe(true);
  });
});
