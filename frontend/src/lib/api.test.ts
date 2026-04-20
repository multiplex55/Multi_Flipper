import { beforeEach, describe, expect, it, vi } from "vitest";
import { batchCreateRoute, getConfig, normalizeRouteResults, scanRegionalDayTrader, updateConfig } from "@/lib/api";
import type { AppConfig, BatchCreateRouteRequest, BatchCreateRouteResponse, RouteResult } from "@/lib/types";

function makeRequest(overrides: Partial<BatchCreateRouteRequest> = {}): BatchCreateRouteRequest {
  return {
    origin_system_id: 30000142,
    origin_system_name: "Jita",
    origin_location_id: 60003760,
    origin_location_name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
    base_batch: {
      origin_system_id: 30000142,
      origin_system_name: "Jita",
      origin_location_id: 60003760,
      origin_location_name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
      base_buy_system_id: 30000142,
      base_buy_location_id: 60003760,
      base_sell_system_id: 30002187,
      base_sell_location_id: 60008494,
      base_lines: [],
      base_line_count: 0,
      total_units: 0,
      total_volume_m3: 0,
      total_buy_isk: 0,
      total_sell_isk: 0,
      total_profit_isk: 0,
      cargo_limit_m3: 5000,
      remaining_capacity_m3: 3000,
    },
    cargo_limit_m3: 5000,
    remaining_capacity_m3: 3000,
    min_route_security: 0.5,
    include_structures: true,
    allow_lowsec: false,
    allow_nullsec: false,
    allow_wormhole: false,
    route_max_jumps: 12,
    sales_tax_percent: 3.6,
    buy_broker_fee_percent: 2,
    sell_broker_fee_percent: 2,
    deterministic_sort: {
      primary: "total_profit_isk",
      secondary: "total_jumps",
      tie_break_order: ["profit_total_isk", "type_id"],
    },
    ...overrides,
  };
}

function makeResponse(request: BatchCreateRouteRequest): BatchCreateRouteResponse {
  return {
    request,
    merged_manifest: {
      origin_system_id: request.origin_system_id,
      origin_location_id: request.origin_location_id,
      final_sell_system_id: request.base_batch.base_sell_system_id,
      final_sell_location_id: request.base_batch.base_sell_location_id,
      base_lines: [],
      added_lines: [],
      total_line_count: 0,
      total_units: 0,
      total_volume_m3: 0,
      cargo_limit_m3: request.cargo_limit_m3,
      remaining_capacity_m3: request.remaining_capacity_m3,
      utilization_pct: 0,
      total_buy_isk: 0,
      total_sell_isk: 0,
      total_profit_isk: 0,
    },
    ranked_options: [],
    selected_option_id: "",
    selected_rank: 0,
    deterministic_sort_applied: true,
    sort_signature: "total_profit_isk|total_jumps|profit_total_isk,type_id",
  };
}

describe("batchCreateRoute", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
  });

  it("serializes and posts the batch create route request body shape", async () => {
    const request = makeRequest();
    const response = makeResponse(request);
    const controller = new AbortController();

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    } satisfies Partial<Response>);

    await batchCreateRoute(request, controller.signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/batch/create-route");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.signal).toBe(controller.signal);
    expect(init.headers).toBeInstanceOf(Headers);
    expect(JSON.parse(String(init.body))).toEqual(request);
  });

  it("propagates backend errors for non-2xx responses", async () => {
    const request = makeRequest();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: "invalid route request" }),
    } satisfies Partial<Response>);

    await expect(batchCreateRoute(request)).rejects.toThrow("invalid route request");
  });

  it("maps successful responses to BatchCreateRouteResponse", async () => {
    const request = makeRequest();
    const response = makeResponse(request);
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    } satisfies Partial<Response>);

    const result = await batchCreateRoute(request);

    expect(result).toEqual(response);
    expect(result.request.origin_system_name).toBe("Jita");
    expect(result.deterministic_sort_applied).toBe(true);
  });
});

describe("config API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("getConfig returns strategy_score when present", async () => {
    const response: Partial<AppConfig> = {
      system_name: "Jita",
      cargo_capacity: 5000,
      buy_radius: 5,
      sell_radius: 10,
      min_margin: 5,
      sales_tax_percent: 8,
      broker_fee_percent: 0,
      alert_telegram: false,
      alert_discord: false,
      alert_desktop: true,
      alert_telegram_token: "",
      alert_telegram_chat_id: "",
      alert_discord_webhook: "",
      opacity: 100,
      window_x: 0,
      window_y: 0,
      window_w: 800,
      window_h: 600,
      strategy_score: {
        profit_weight: 35,
        risk_weight: 25,
        velocity_weight: 20,
        jump_weight: 10,
        capital_weight: 10,
      },
    };
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    } satisfies Partial<Response>);

    const got = await getConfig();
    expect(got.strategy_score?.profit_weight).toBe(35);
    expect(got.strategy_score?.risk_weight).toBe(25);
  });

  it("updateConfig sends strategy_score inside patch payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } satisfies Partial<Response>);

    await updateConfig({
      strategy_score: {
        profit_weight: 40,
        risk_weight: 20,
        velocity_weight: 20,
        jump_weight: 10,
        capital_weight: 10,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      strategy_score: {
        profit_weight: 40,
        risk_weight: 20,
        velocity_weight: 20,
        jump_weight: 10,
        capital_weight: 10,
      },
    });
  });
});

describe("normalizeRouteResults", () => {
  it("maps enriched hop fields with safe defaults for stale payloads", () => {
    const legacyRoute: RouteResult = {
      Hops: [
        {
          SystemName: "Jita",
          StationName: "Jita",
          SystemID: 30000142,
          DestSystemName: "Amarr",
          DestStationName: "Amarr",
          DestSystemID: 30002187,
          TypeName: "Tritanium",
          TypeID: 34,
          BuyPrice: 5,
          SellPrice: 6,
          Units: 100,
          Profit: 100,
          Jumps: 8,
        },
      ],
      TotalProfit: 100,
      TotalJumps: 8,
      ProfitPerJump: 12.5,
      HopCount: 1,
    };

    const [route] = normalizeRouteResults([legacyRoute]);
    const hop = route.Hops[0];
    expect(hop.buy_location_id).toBe(0);
    expect(hop.sell_location_id).toBe(0);
    expect(hop.modeled_qty).toBe(100);
    expect(hop.effective_buy).toBe(5);
    expect(hop.effective_sell).toBe(6);
    expect(hop.buy_station_name).toBe("Jita");
    expect(hop.sell_station_name).toBe("Amarr");
  });
});

describe("scanRegionalDayTrader", () => {
  it("parses result payload with data and hubs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const payload = [
      JSON.stringify({ type: "progress", message: "loading" }),
      JSON.stringify({
        type: "result",
        data: [{ TypeID: 34, TypeName: "Tritanium" }],
        hubs: [{ source_system_id: 30000142, source_system_name: "Jita", items: [] }],
        count: 1,
        target_region_name: "The Forge",
        period_days: 14,
      }),
    ].join("\n");
    fetchMock.mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(payload));
          controller.close();
        },
      }),
    } satisfies Partial<Response>);

    const result = await scanRegionalDayTrader({ system_name: "Jita" } as never, vi.fn());

    expect(result.rows).toHaveLength(1);
    expect(result.hubs).toHaveLength(1);
    expect(result.summary).toEqual({
      count: 1,
      targetRegionName: "The Forge",
      periodDays: 14,
    });
  });

  it("defaults hubs to [] for backward-compatible payloads", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const payload = JSON.stringify({
      type: "result",
      data: [{ TypeID: 34, TypeName: "Tritanium" }],
      count: 1,
      target_region_name: "The Forge",
      period_days: 7,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(payload));
          controller.close();
        },
      }),
    } satisfies Partial<Response>);

    const result = await scanRegionalDayTrader({ system_name: "Jita" } as never, vi.fn());
    expect(result.rows).toHaveLength(1);
    expect(result.hubs).toEqual([]);
    expect(result.summary.periodDays).toBe(7);
  });

  it("keeps parsing hubs when new optional hub fields are present or missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const payload = JSON.stringify({
      type: "result",
      data: [{ TypeID: 34, TypeName: "Tritanium" }],
      hubs: [
        {
          source_system_id: 30000142,
          source_system_name: "Jita",
          source_region_id: 10000002,
          source_region_name: "The Forge",
          security: 0.9,
          purchase_units: 10,
          source_units: 10,
          target_demand_per_day: 5,
          target_supply_units: 20,
          target_dos: 4,
          assets: 0,
          active_orders: 0,
          target_now_profit: 100,
          target_period_profit: 120,
          capital_required: 1000,
          shipping_cost: 20,
          item_count: 1,
          items: [],
          source_jumps_from_current: 2,
          staging_score: 88.2,
          destinations_count: 3,
          best_destination_system_name: "Amarr",
          best_destination_profit: 90,
        },
        {
          source_system_id: 30002187,
          source_system_name: "Amarr",
          source_region_id: 10000043,
          source_region_name: "Domain",
          security: 0.8,
          purchase_units: 5,
          source_units: 5,
          target_demand_per_day: 2,
          target_supply_units: 10,
          target_dos: 5,
          assets: 0,
          active_orders: 0,
          target_now_profit: 80,
          target_period_profit: 95,
          capital_required: 800,
          shipping_cost: 10,
          item_count: 1,
          items: [],
        },
      ],
      count: 2,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(payload));
          controller.close();
        },
      }),
    } satisfies Partial<Response>);

    const result = await scanRegionalDayTrader({ system_name: "Jita" } as never, vi.fn());
    expect(result.hubs).toHaveLength(2);
    expect(result.hubs[0].staging_score).toBe(88.2);
    expect(result.hubs[1].staging_score).toBeUndefined();
  });
});
