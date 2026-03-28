import { describe, expect, it } from "vitest";
import { adaptRouteResultToOrderedRouteManifest } from "@/lib/routeManifestAdapter";
import type { RouteResult } from "@/lib/types";

describe("adaptRouteResultToOrderedRouteManifest", () => {
  it("prefers normalized hop items and derives totals from item rows", () => {
    const route: RouteResult = {
      Hops: [
        {
          SystemName: "Jita",
          StationName: "Jita IV - Moon 4",
          SystemID: 30000142,
          DestSystemName: "Perimeter",
          DestStationName: "Perimeter - Tranquility",
          DestSystemID: 30000144,
          TypeName: "Legacy Wrong Name",
          TypeID: 999,
          BuyPrice: 1,
          SellPrice: 2,
          Units: 1,
          Profit: 1,
          Jumps: 3,
          Items: [
            {
              TypeID: 34,
              TypeName: "Tritanium",
              Units: 100,
              BuyPrice: 10,
              SellPrice: 12,
              BuyCost: 1_000,
              SellValue: 1_200,
              Profit: 200,
            },
            {
              TypeID: 35,
              TypeName: "Pyerite",
              Units: 20,
              BuyPrice: 30,
              SellPrice: 35,
              BuyCost: 600,
              SellValue: 700,
              Profit: 100,
            },
          ],
        },
      ],
      TotalProfit: 300,
      TotalJumps: 3,
      ProfitPerJump: 100,
      HopCount: 1,
    };

    const adapted = adaptRouteResultToOrderedRouteManifest(route, {
      originLabel: "Jita Origin",
      cargoM3: 9_000,
    });

    expect(adapted.summary.origin_label).toBe("Jita Origin");
    expect(adapted.summary.route_hops_count).toBe(1);
    expect(adapted.summary.cargo_m3).toBe(9_000);
    expect(adapted.manifest.stations[0]?.item_count).toBe(2);
    expect(adapted.manifest.stations[0]?.total_buy_isk).toBe(1_600);
    expect(adapted.manifest.stations[0]?.total_sell_isk).toBe(1_900);
    expect(adapted.manifest.stations[0]?.total_profit_isk).toBe(300);
    expect(adapted.manifest.stations[0]?.lines.map((line) => line.type_name)).toEqual([
      "Tritanium",
      "Pyerite",
    ]);
  });

  it("builds cumulative jumps with N/A-compatible null fallbacks for unknown segments", () => {
    const route = {
      Hops: [
        {
          SystemName: "Jita",
          StationName: "Jita IV - Moon 4",
          SystemID: 1,
          DestSystemName: "Perimeter",
          DestSystemID: 2,
          TypeName: "Tritanium",
          TypeID: 34,
          BuyPrice: 10,
          SellPrice: 11,
          Units: 10,
          Profit: 10,
          Jumps: 4,
        },
        {
          SystemName: "Perimeter",
          StationName: "Perimeter - Tranquility",
          SystemID: 2,
          DestSystemName: "New Caldari",
          DestSystemID: 3,
          TypeName: "Pyerite",
          TypeID: 35,
          BuyPrice: 20,
          SellPrice: 22,
          Units: 10,
          Profit: 20,
          Jumps: Number.NaN,
        },
        {
          SystemName: "New Caldari",
          StationName: "Navy Testing",
          SystemID: 3,
          DestSystemName: "Muvolailen",
          DestSystemID: 4,
          TypeName: "Mexallon",
          TypeID: 36,
          BuyPrice: 30,
          SellPrice: 35,
          Units: 5,
          Profit: 25,
          Jumps: 2,
        },
      ],
      TotalProfit: 55,
      TotalJumps: Number.NaN,
      ProfitPerJump: 999,
      HopCount: 3,
    } as RouteResult;

    const adapted = adaptRouteResultToOrderedRouteManifest(route);

    expect(adapted.manifest.stations[0]?.jumps_to_buy_station).toBe(0);
    expect(adapted.manifest.stations[0]?.jumps_buy_to_sell).toBe(4);
    expect(adapted.manifest.stations[1]?.jumps_to_buy_station).toBe(4);
    expect(adapted.manifest.stations[1]?.jumps_buy_to_sell).toBeNull();
    expect(adapted.manifest.stations[2]?.jumps_to_buy_station).toBeNull();
    expect(adapted.manifest.stations[2]?.jumps_buy_to_sell).toBe(2);
    expect(adapted.summary.total_isk_per_jump).toBe(999);
    expect(adapted.manifest.summary?.total_jumps).toBeUndefined();
  });

  it("falls back to legacy scalar hop fields when hop items are missing", () => {
    const route: RouteResult = {
      Hops: [
        {
          SystemName: "Hek",
          StationName: "Boundless Creation Factory",
          SystemID: 10,
          DestSystemName: "Rens",
          DestSystemID: 11,
          TypeName: "Isogen",
          TypeID: 37,
          BuyPrice: 100,
          SellPrice: 120,
          Units: 5,
          Profit: 100,
          Jumps: 1,
          Items: [],
        },
      ],
      TotalProfit: 100,
      TotalJumps: 1,
      ProfitPerJump: 100,
      HopCount: 1,
      TargetSystemName: "Rens",
    };

    const adapted = adaptRouteResultToOrderedRouteManifest(route);
    const station = adapted.manifest.stations[0];

    expect(station?.buy_station_name).toBe("Boundless Creation Factory");
    expect(station?.sell_station_name).toBe("Rens");
    expect(station?.lines).toHaveLength(1);
    expect(station?.lines[0]).toMatchObject({
      type_name: "Isogen",
      units: 5,
      buy_total_isk: 500,
      sell_total_isk: 600,
      profit_isk: 100,
    });
    expect(adapted.summary.items).toBe(1);
    expect(adapted.summary.total_buy_isk).toBe(500);
    expect(adapted.summary.total_sell_isk).toBe(600);
    expect(adapted.summary.total_profit_isk).toBe(100);
    expect(adapted.summary.total_isk_per_jump).toBe(100);
    expect(adapted.summary.average_hop_isk_per_jump).toBe(100);
  });
});
