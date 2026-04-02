import { beforeEach, describe, expect, it, vi } from "vitest";
import { batchCreateRoute, getConfig, updateConfig } from "@/lib/api";
import type { AppConfig, BatchCreateRouteRequest, BatchCreateRouteResponse } from "@/lib/types";

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
