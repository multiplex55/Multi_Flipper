import { describe, expect, it } from "vitest";
import { buildBuyHubSummaries, buildSellSinkSummaries } from "@/lib/regionalConcentration";
import type { RegionalDayTradeHub } from "@/lib/types";

const hubs: RegionalDayTradeHub[] = [
  {
    source_system_id: 30000142,
    source_system_name: "Jita",
    source_region_id: 10000002,
    source_region_name: "The Forge",
    security: 0.9,
    purchase_units: 30,
    source_units: 100,
    target_demand_per_day: 12,
    target_supply_units: 6,
    target_dos: 2,
    assets: 0,
    active_orders: 0,
    target_now_profit: 0,
    target_period_profit: 700,
    capital_required: 3_000,
    shipping_cost: 20,
    item_count: 2,
    items: [
      {
        type_id: 34,
        type_name: "Tritanium",
        source_system_id: 30000142,
        source_system_name: "Jita",
        source_station_name: "4-4",
        source_location_id: 60003760,
        source_region_id: 10000002,
        source_region_name: "The Forge",
        target_system_id: 30002187,
        target_system_name: "Amarr",
        target_station_name: "VIII",
        target_location_id: 60008494,
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
        target_period_price: 2,
        target_now_profit: 100,
        target_period_profit: 200,
        roi_now: 0,
        roi_period: 0,
        capital_required: 1_000,
        item_volume: 1,
        shipping_cost: 0,
        jumps: 4,
        margin_now: 0,
        margin_period: 0,
      },
      {
        type_id: 35,
        type_name: "Pyerite",
        source_system_id: 30000142,
        source_system_name: "Jita",
        source_station_name: "4-4",
        source_location_id: 60003760,
        source_region_id: 10000002,
        source_region_name: "The Forge",
        target_system_id: 30002659,
        target_system_name: "Dodixie",
        target_station_name: "IX",
        target_location_id: 60011866,
        target_region_id: 10000032,
        target_region_name: "Sinq Laison",
        purchase_units: 20,
        source_units: 20,
        target_demand_per_day: 1,
        target_supply_units: 1,
        target_dos: 1,
        assets: 0,
        active_orders: 0,
        source_avg_price: 1,
        target_now_price: 2,
        target_period_price: 2,
        target_now_profit: 150,
        target_period_profit: 500,
        roi_now: 0,
        roi_period: 0,
        capital_required: 2_000,
        item_volume: 1,
        shipping_cost: 0,
        jumps: 8,
        margin_now: 0,
        margin_period: 0,
      },
    ],
  },
];

describe("regionalConcentration", () => {
  it("builds buy-side summaries with weighted jumps and top destinations", () => {
    const summaries = buildBuyHubSummaries(hubs);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].item_count).toBe(2);
    expect(summaries[0].capital_required).toBe(3_000);
    expect(summaries[0].target_period_profit).toBe(700);
    expect(summaries[0].avg_jumps).toBeCloseTo((10 * 4 + 20 * 8) / 30, 6);
    expect(summaries[0].top_destinations[0].target_system_name).toBe("Dodixie");
  });

  it("builds sell-side sink summaries with top sources", () => {
    const summaries = buildSellSinkSummaries(hubs);
    expect(summaries).toHaveLength(2);
    const amarr = summaries.find((row) => row.target_system_name === "Amarr");
    expect(amarr).toBeDefined();
    expect(amarr?.item_count).toBe(1);
    expect(amarr?.capital_required).toBe(1_000);
    expect(amarr?.target_period_profit).toBe(200);
    expect(amarr?.top_sources[0].source_system_name).toBe("Jita");
  });
});
