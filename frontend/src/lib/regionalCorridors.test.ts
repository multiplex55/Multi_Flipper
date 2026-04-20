import { describe, expect, it } from "vitest";
import { aggregateRegionalTradeCorridors } from "@/lib/regionalCorridors";
import type { RegionalDayTradeHub } from "@/lib/types";

function makeHubs(): RegionalDayTradeHub[] {
  return [
    {
      source_system_id: 1,
      source_system_name: "Jita",
      source_region_id: 10000002,
      source_region_name: "The Forge",
      security: 0.9,
      purchase_units: 30,
      source_units: 100,
      target_demand_per_day: 10,
      target_supply_units: 20,
      target_dos: 2,
      assets: 0,
      active_orders: 0,
      target_now_profit: 250,
      target_period_profit: 300,
      capital_required: 800,
      shipping_cost: 10,
      item_count: 2,
      items: [
        {
          type_id: 34,
          type_name: "Tritanium",
          source_system_id: 1,
          source_system_name: "Jita",
          source_station_name: "Jita IV",
          source_location_id: 11,
          source_region_id: 10000002,
          source_region_name: "The Forge",
          target_system_id: 2,
          target_system_name: "Amarr",
          target_station_name: "Amarr VIII",
          target_location_id: 22,
          target_region_id: 10000043,
          target_region_name: "Domain",
          purchase_units: 10,
          source_units: 10,
          target_demand_per_day: 1,
          target_supply_units: 1,
          target_dos: 1,
          assets: 0,
          active_orders: 0,
          source_avg_price: 1,
          target_now_price: 2,
          target_period_price: 2.1,
          target_now_profit: 100,
          target_period_profit: 110,
          roi_now: 10,
          roi_period: 11,
          capital_required: 300,
          item_volume: 1,
          shipping_cost: 1,
          jumps: 2,
          margin_now: 5,
          margin_period: 5,
        },
        {
          type_id: 35,
          type_name: "Pyerite",
          source_system_id: 1,
          source_system_name: "Jita",
          source_station_name: "Jita IV",
          source_location_id: 11,
          source_region_id: 10000002,
          source_region_name: "The Forge",
          target_system_id: 2,
          target_system_name: "Amarr",
          target_station_name: "Amarr VIII",
          target_location_id: 22,
          target_region_id: 10000043,
          target_region_name: "Domain",
          purchase_units: 20,
          source_units: 20,
          target_demand_per_day: 1,
          target_supply_units: 1,
          target_dos: 1,
          assets: 0,
          active_orders: 0,
          source_avg_price: 1,
          target_now_price: 2,
          target_period_price: 2.1,
          target_now_profit: 150,
          target_period_profit: 190,
          roi_now: 10,
          roi_period: 11,
          capital_required: 500,
          item_volume: 1,
          shipping_cost: 1,
          jumps: 4,
          margin_now: 5,
          margin_period: 5,
        },
      ],
    },
    {
      source_system_id: 1,
      source_system_name: "Jita",
      source_region_id: 10000002,
      source_region_name: "The Forge",
      security: 0.9,
      purchase_units: 5,
      source_units: 100,
      target_demand_per_day: 10,
      target_supply_units: 20,
      target_dos: 2,
      assets: 0,
      active_orders: 0,
      target_now_profit: 40,
      target_period_profit: 50,
      capital_required: 100,
      shipping_cost: 2,
      item_count: 1,
      items: [
        {
          type_id: 36,
          type_name: "Mexallon",
          source_system_id: 1,
          source_system_name: "Jita",
          source_station_name: "Jita IV",
          source_location_id: 11,
          source_region_id: 10000002,
          source_region_name: "The Forge",
          target_system_id: 3,
          target_system_name: "Dodixie",
          target_station_name: "Dodixie IX",
          target_location_id: 33,
          target_region_id: 10000032,
          target_region_name: "Sinq Laison",
          purchase_units: 5,
          source_units: 5,
          target_demand_per_day: 1,
          target_supply_units: 1,
          target_dos: 1,
          assets: 0,
          active_orders: 0,
          source_avg_price: 1,
          target_now_price: 2,
          target_period_price: 2,
          target_now_profit: 40,
          target_period_profit: 50,
          roi_now: 10,
          roi_period: 11,
          capital_required: 100,
          item_volume: 1,
          shipping_cost: 1,
          jumps: 8,
          margin_now: 5,
          margin_period: 5,
        },
      ],
    },
  ];
}

describe("aggregateRegionalTradeCorridors", () => {
  it("groups rows by source + target and aggregates totals", () => {
    const corridors = aggregateRegionalTradeCorridors(makeHubs());

    expect(corridors).toHaveLength(2);
    const jitaAmarr = corridors.find((corridor) => corridor.key === "1:2");
    expect(jitaAmarr).toBeDefined();
    expect(jitaAmarr?.item_count).toBe(2);
    expect(jitaAmarr?.purchase_units).toBe(30);
    expect(jitaAmarr?.capital_required).toBe(800);
    expect(jitaAmarr?.target_now_profit).toBe(250);
    expect(jitaAmarr?.target_period_profit).toBe(300);
  });

  it("computes weighted jumps and chooses best item by period profit", () => {
    const corridors = aggregateRegionalTradeCorridors(makeHubs());
    const jitaAmarr = corridors.find((corridor) => corridor.key === "1:2");

    expect(jitaAmarr).toBeDefined();
    expect(jitaAmarr?.weighted_jumps).toBeCloseTo((10 * 2 + 20 * 4) / 30, 6);
    expect(jitaAmarr?.best_item_name).toBe("Pyerite");
    expect(jitaAmarr?.best_item_period_profit).toBe(190);
  });
});
