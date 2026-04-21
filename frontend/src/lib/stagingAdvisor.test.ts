import { describe, expect, it } from "vitest";
import type { RegionalDayTradeHub, RegionalTradeCorridor } from "@/lib/types";
import { buildCharacterStagingRecommendations } from "@/lib/stagingAdvisor";

const baseHub: RegionalDayTradeHub = {
  source_system_id: 1,
  source_system_name: "Jita",
  source_region_id: 10,
  source_region_name: "The Forge",
  security: 0.9,
  purchase_units: 1,
  source_units: 1,
  target_demand_per_day: 1,
  target_supply_units: 1,
  target_dos: 1,
  assets: 0,
  active_orders: 0,
  target_now_profit: 100,
  target_period_profit: 150,
  capital_required: 100,
  shipping_cost: 5,
  item_count: 1,
  items: [],
};

const corridors: RegionalTradeCorridor[] = [
  {
    key: "1:2",
    source_system_id: 1,
    source_system_name: "Jita",
    target_system_id: 2,
    target_system_name: "Amarr",
    item_count: 1,
    purchase_units: 1,
    capital_required: 1,
    target_now_profit: 1,
    target_period_profit: 600,
    weighted_jumps: 1,
    best_item_type_id: 34,
    best_item_name: "Tritanium",
    best_item_period_profit: 1,
    best_item_now_profit: 1,
    items: [],
  },
];

describe("buildCharacterStagingRecommendations", () => {
  it("ranks hubs by score with deterministic tie-break", () => {
    const recommendations = buildCharacterStagingRecommendations({
      characterLocations: [{ character_id: 1, character_name: "Alpha", solar_system_id: 999, solar_system_name: "Dodixie" }],
      hubs: [
        { ...baseHub, source_system_id: 300, source_system_name: "Rens", staging_score: 80, source_jumps_from_current: 2 },
        { ...baseHub, source_system_id: 100, source_system_name: "Amarr", staging_score: 80, source_jumps_from_current: 2 },
      ],
      corridors: [],
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].recommended_system_name).toBe("Amarr");
    expect(recommendations[0].total_score).toBeGreaterThan(0);
  });

  it("applies role assignment constraints by jump profile and corridor presence", () => {
    const recommendations = buildCharacterStagingRecommendations({
      characterLocations: [{ character_id: 9, character_name: "Beta", solar_system_id: 1, solar_system_name: "Jita" }],
      hubs: [
        { ...baseHub, source_system_id: 1, source_system_name: "Jita", staging_score: 65, source_jumps_from_current: 0 },
        { ...baseHub, source_system_id: 8, source_system_name: "Hek", staging_score: 99, source_jumps_from_current: 9 },
      ],
      corridors,
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].recommended_role).toBe("hub_trader");
    expect(recommendations[0].top_metrics.corridor_count).toBe(1);
    expect(recommendations[0].jumps).toBe(0);
  });
});
