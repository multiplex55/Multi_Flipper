import { describe, expect, it } from "vitest";
import type { BatchCreateRouteRequest } from "@/lib/types";
import {
  normalizeBatchCreateRouteRequest,
  validateBatchCreateRouteRequest,
} from "@/lib/batchRouteModels";

function makeRequest(overrides: Partial<BatchCreateRouteRequest> = {}): BatchCreateRouteRequest {
  const base: BatchCreateRouteRequest = {
    origin_system_id: 30000142,
    origin_system_name: "Jita",
    origin_location_id: 60003760,
    origin_location_name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
    cargo_limit_m3: 5000,
    remaining_capacity_m3: 2500,
    min_route_security: 0.45,
    include_structures: false,
    allow_lowsec: false,
    allow_nullsec: false,
    allow_wormhole: false,
    route_max_jumps: 12,
    max_detour_jumps_per_node: 2,
    sales_tax_percent: 2.25,
    buy_broker_fee_percent: 3,
    sell_broker_fee_percent: 3,
    deterministic_sort: {
      primary: "total_profit_isk",
      secondary: "isk_per_jump",
      tie_break_order: ["total_jumps", "option_id"],
    },
    base_batch: {
      origin_system_id: 30000142,
      origin_system_name: "Jita",
      origin_location_id: 60003760,
      origin_location_name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
      base_buy_system_id: 30000142,
      base_buy_location_id: 60003760,
      base_sell_system_id: 30002187,
      base_sell_location_id: 60008494,
      base_lines: [
        {
          type_id: 34,
          type_name: "Tritanium",
          units: 1000,
          unit_volume_m3: 0.01,
          buy_system_id: 30000142,
          buy_location_id: 60003760,
          sell_system_id: 30002187,
          sell_location_id: 60008494,
          buy_price_isk: 4,
          sell_price_isk: 5,
          buy_total_isk: 4000,
          sell_total_isk: 5000,
          profit_total_isk: 1000,
          jumps: 9,
        },
      ],
      base_line_count: 1,
      total_units: 1000,
      total_volume_m3: 10,
      total_buy_isk: 4000,
      total_sell_isk: 5000,
      total_profit_isk: 1000,
      cargo_limit_m3: 5000,
      remaining_capacity_m3: 2500,
    },
  };

  return {
    ...base,
    ...overrides,
    base_batch: {
      ...base.base_batch,
      ...(overrides.base_batch ?? {}),
    },
  };
}

describe("batchRouteModels", () => {
  it("reports missing origin", () => {
    const errors = validateBatchCreateRouteRequest(
      makeRequest({ origin_system_id: 0, origin_location_id: 0 }),
    );

    expect(errors).toContain("missing origin");
  });

  it("reports missing final sell location/system", () => {
    const errors = validateBatchCreateRouteRequest(
      makeRequest({
        base_batch: {
          ...makeRequest().base_batch,
          base_sell_system_id: 0,
          base_sell_location_id: 0,
        },
      }),
    );

    expect(errors).toContain("missing final sell location/system");
  });

  it("reports negative cargo values", () => {
    const errors = validateBatchCreateRouteRequest(
      makeRequest({ cargo_limit_m3: -1, remaining_capacity_m3: -1 }),
    );

    expect(errors).toContain("negative cargo/remaining cargo");
  });

  it("reports empty base lines", () => {
    const errors = validateBatchCreateRouteRequest(
      makeRequest({
        base_batch: {
          ...makeRequest().base_batch,
          base_lines: [],
        },
      }),
    );

    expect(errors).toContain("empty base lines");
  });


  it("preserves advanced routing and cache context fields during normalization", () => {
    const normalized = normalizeBatchCreateRouteRequest(
      makeRequest({
        current_system_id: 30002187,
        current_location_id: 60008494,
        min_route_security: 0.6,
        allow_lowsec: true,
        allow_nullsec: true,
        allow_wormhole: true,
        max_detour_jumps_per_node: 3,
        candidate_context: {
          source_tab: "radius",
          cache_revision: 42,
          cache_next_expiry: "2026-03-27T12:00:00Z",
          cache_stale: false,
        },
      }),
    );

    expect(normalized.current_system_id).toBe(30002187);
    expect(normalized.current_location_id).toBe(60008494);
    expect(normalized.min_route_security).toBe(0.6);
    expect(normalized.allow_lowsec).toBe(true);
    expect(normalized.allow_nullsec).toBe(true);
    expect(normalized.allow_wormhole).toBe(true);
    expect(normalized.max_detour_jumps_per_node).toBe(3);
    expect(normalized.candidate_context).toMatchObject({
      source_tab: "radius",
      cache_revision: 42,
      cache_next_expiry: "2026-03-27T12:00:00Z",
      cache_stale: false,
    });
  });


  it("keeps max_detour_jumps_per_node continuity for undefined, zero, and positive values", () => {
    const withoutDetour = normalizeBatchCreateRouteRequest(
      makeRequest({ max_detour_jumps_per_node: undefined }),
    );
    const zeroDetour = normalizeBatchCreateRouteRequest(
      makeRequest({ max_detour_jumps_per_node: 0 }),
    );
    const positiveDetour = normalizeBatchCreateRouteRequest(
      makeRequest({ max_detour_jumps_per_node: 4 }),
    );

    expect(withoutDetour.max_detour_jumps_per_node).toBeUndefined();
    expect(zeroDetour.max_detour_jumps_per_node).toBe(0);
    expect(positiveDetour.max_detour_jumps_per_node).toBe(4);

    expect(validateBatchCreateRouteRequest(withoutDetour)).toEqual([]);
    expect(validateBatchCreateRouteRequest(zeroDetour)).toEqual([]);
    expect(validateBatchCreateRouteRequest(positiveDetour)).toEqual([]);
  });

  it("defaults remaining capacity to cargo limit when omitted as zero", () => {
    const normalized = normalizeBatchCreateRouteRequest(
      makeRequest({ cargo_limit_m3: 12000, remaining_capacity_m3: 0 }),
    );

    expect(normalized.remaining_capacity_m3).toBe(12000);
  });
});
