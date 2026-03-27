import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchCreateRouteResponse, FlipResult } from "@/lib/types";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { BatchBuilderPopup } from "@/components/BatchBuilderPopup";
import { batchCreateRoute } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    batchCreateRoute: vi.fn(),
  };
});

function makeRow(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyLocationID: 60003760,
    SellPrice: 120,
    SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    SellLocationID: 60008494,
    ProfitPerUnit: 20,
    MarginPercent: 20,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 200,
    ProfitPerJump: 20,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 0,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 100,
    ...overrides,
  };
}

function makeRouteResponse(): BatchCreateRouteResponse {
  return {
    request: {
      origin_system_id: 30000142,
      origin_system_name: "Jita",
      origin_location_id: 60003760,
      origin_location_name: "Jita IV - Moon 4",
      cargo_limit_m3: 20000,
      remaining_capacity_m3: 4500,
      min_route_security: 0.45,
      include_structures: false,
      allow_lowsec: false,
      allow_nullsec: false,
      allow_wormhole: false,
      route_max_jumps: 12,
      sales_tax_percent: 3,
      buy_broker_fee_percent: 1,
      sell_broker_fee_percent: 1,
      deterministic_sort: {
        primary: "isk_per_jump",
        secondary: "total_profit_isk",
        tie_break_order: ["utilization_pct", "type_id"],
      },
      base_batch: {
        origin_system_id: 30000142,
        origin_system_name: "Jita",
        origin_location_id: 60003760,
        origin_location_name: "Jita IV - Moon 4",
        base_buy_system_id: 30000142,
        base_buy_location_id: 60003760,
        base_sell_system_id: 30002187,
        base_sell_location_id: 60008494,
        base_lines: [],
        base_line_count: 0,
        total_units: 0,
        total_volume_m3: 15500,
        total_buy_isk: 630000,
        total_sell_isk: 2130000,
        total_profit_isk: 1500000,
        cargo_limit_m3: 20000,
        remaining_capacity_m3: 4500,
      },
    },
    merged_manifest: {
      origin_system_id: 30000142,
      origin_location_id: 60003760,
      final_sell_system_id: 30002187,
      final_sell_location_id: 60008494,
      base_lines: [],
      added_lines: [],
      total_line_count: 0,
      total_units: 0,
      total_volume_m3: 0,
      cargo_limit_m3: 20000,
      remaining_capacity_m3: 0,
      utilization_pct: 0,
      total_buy_isk: 0,
      total_sell_isk: 0,
      total_profit_isk: 0,
    },
    ranked_options: [
      {
        option_id: "rank-1",
        rank: 1,
        lines: [
          {
            type_id: 9001,
            type_name: "Zydrine",
            units: 100,
            unit_volume_m3: 1,
            buy_system_id: 30000142,
            buy_location_id: 60003760,
            sell_system_id: 30002187,
            sell_location_id: 60008494,
            buy_total_isk: 100000,
            sell_total_isk: 140000,
            profit_total_isk: 40000,
            route_jumps: 8,
          },
        ],
        line_count: 1,
        added_volume_m3: 100,
        utilization_pct: 76,
        total_buy_isk: 100000,
        total_sell_isk: 140000,
        total_profit_isk: 40000,
        total_jumps: 8,
        isk_per_jump: 5000,
        ranking_inputs: {
          total_profit_isk: 40000,
          total_jumps: 8,
          isk_per_jump: 5000,
          utilization_pct: 76,
        },
        ranking_tie_break_values: [76, 9001],
        ranking_sort_key: "A",
      },
      {
        option_id: "rank-2",
        rank: 2,
        lines: [
          {
            type_id: 9002,
            type_name: "Megacyte",
            units: 40,
            unit_volume_m3: 2,
            buy_system_id: 30000142,
            buy_location_id: 60003760,
            sell_system_id: 30002187,
            sell_location_id: 60008494,
            buy_total_isk: 200000,
            sell_total_isk: 290000,
            profit_total_isk: 90000,
            route_jumps: 10,
          },
        ],
        line_count: 1,
        added_volume_m3: 80,
        utilization_pct: 75.8,
        total_buy_isk: 200000,
        total_sell_isk: 290000,
        total_profit_isk: 90000,
        total_jumps: 10,
        isk_per_jump: 9000,
        ranking_inputs: {
          total_profit_isk: 90000,
          total_jumps: 10,
          isk_per_jump: 9000,
          utilization_pct: 75.8,
        },
        ranking_tie_break_values: [75.8, 9002],
        ranking_sort_key: "B",
      },
    ],
    selected_option_id: "rank-1",
    selected_rank: 1,
    deterministic_sort_applied: true,
    sort_signature: "isk_per_jump|total_profit_isk|utilization_pct,type_id",
  };
}

function makeDuplicateTotalsRouteResponse(): BatchCreateRouteResponse {
  const response = makeRouteResponse();
  response.ranked_options = [
    {
      option_id: "dup-opt",
      rank: 1,
      lines: [
        {
          type_id: 777,
          type_name: "Isogen",
          units: 100,
          unit_volume_m3: 2,
          buy_system_id: 30000142,
          buy_location_id: 60003760,
          sell_system_id: 30002187,
          sell_location_id: 60008494,
          buy_total_isk: 120000,
          sell_total_isk: 180000,
          profit_total_isk: 60000,
          route_jumps: 7,
        },
        {
          type_id: 777,
          type_name: "Isogen",
          units: 80,
          unit_volume_m3: 2,
          buy_system_id: 30000142,
          buy_location_id: 60003760,
          sell_system_id: 30002187,
          sell_location_id: 60008494,
          buy_total_isk: 96000,
          sell_total_isk: 140000,
          profit_total_isk: 44000,
          route_jumps: 7,
        },
      ],
      line_count: 2,
      added_volume_m3: 360,
      utilization_pct: 78.2,
      total_buy_isk: 216000,
      total_sell_isk: 320000,
      total_profit_isk: 104000,
      total_jumps: 7,
      isk_per_jump: 14857.14,
      ranking_inputs: {
        total_profit_isk: 104000,
        total_jumps: 7,
        isk_per_jump: 14857.14,
        utilization_pct: 78.2,
      },
      ranking_tie_break_values: [78.2, 777],
      ranking_sort_key: "A",
    },
  ];
  response.selected_option_id = "";
  response.selected_rank = 0;
  return response;
}

function renderPopup({ anchorRow, rows }: { anchorRow: FlipResult | null; rows: FlipResult[] }) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <BatchBuilderPopup
          open
          onClose={() => undefined}
          anchorRow={anchorRow}
          rows={rows}
          defaultCargoM3={20000}
          originSystemName="Jita"
          minRouteSecurity={0.45}
          includeStructures={false}
          routeMaxJumps={12}
          salesTaxPercent={3}
          buyBrokerFeePercent={1}
          sellBrokerFeePercent={1}
          cacheMeta={{
            current_revision: 99,
            next_expiry_at: "2026-03-27T00:30:00Z",
            stale: false,
            last_refresh_at: "2026-03-27T00:00:00Z",
            min_ttl_sec: 60,
            max_ttl_sec: 300,
            regions: 1,
            entries: 10,
          }}
          scanSourceTab="radius"
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("BatchBuilderPopup route creation", () => {
  const writeText = vi.fn<(_: string) => Promise<void>>(() => Promise.resolve());
  const batchCreateRouteMock = vi.mocked(batchCreateRoute);

  const anchorRow = makeRow({
    TypeID: 11,
    TypeName: "Anchor Paste",
    Volume: 1,
    ProfitPerUnit: 100,
    UnitsToBuy: 1500,
  });

  const rows = [
    anchorRow,
    makeRow({
      TypeID: 22,
      TypeName: "Dense Isogen",
      Volume: 2,
      ProfitPerUnit: 300,
      UnitsToBuy: 2000,
      ExpectedBuyPrice: 115,
      ExpectedSellPrice: 430,
    }),
    makeRow({
      TypeID: 33,
      TypeName: "Medium Mexallon",
      Volume: 4,
      ProfitPerUnit: 300,
      UnitsToBuy: 2500,
    }),
  ];

  beforeEach(() => {
    batchCreateRouteMock.mockReset();
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows searching spinner/progress while request is pending", async () => {
    const pending: { resolve?: (value: BatchCreateRouteResponse) => void } = {};
    batchCreateRouteMock.mockImplementation(
      () =>
        new Promise<BatchCreateRouteResponse>((resolve) => {
          pending.resolve = resolve;
        }),
    );

    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Searching route additions...");

    expect(pending.resolve).toBeDefined();
    pending.resolve!(makeRouteResponse());
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("renders option cards in returned sort order", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());

    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    const options = await screen.findAllByTestId(/route-option-/);
    expect(options.map((node) => node.getAttribute("data-testid"))).toEqual([
      "route-option-rank-1",
      "route-option-rank-2",
    ]);
  });

  it("includes radius cache context and candidate snapshot in request payload", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());
    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    await screen.findByTestId("route-option-rank-1");

    expect(batchCreateRouteMock).toHaveBeenCalledTimes(1);
    const [payload] = batchCreateRouteMock.mock.calls[0] ?? [];
    expect(payload?.candidate_context?.source_tab).toBe("radius");
    expect(payload?.candidate_context?.cache_revision).toBe(99);
    expect(payload?.candidate_snapshot?.length).toBeGreaterThan(0);
    expect(payload?.candidate_snapshot?.[0]).toMatchObject({
      type_id: expect.any(Number),
      buy_system_id: expect.any(Number),
      sell_system_id: expect.any(Number),
    });
  });

  it("surfaces fallback diagnostics from planner responses", async () => {
    const response = makeRouteResponse();
    response.diagnostics = ["radius cache unavailable or stale; falling back to market-only candidates"];
    batchCreateRouteMock.mockResolvedValue(response);

    renderPopup({ anchorRow, rows });
    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    const diagnostics = await screen.findByTestId("route-diagnostics");
    expect(diagnostics).toHaveTextContent(
      "radius cache unavailable or stale; falling back to market-only candidates",
    );
  });

  it("shows empty options UX when API returns no ranked options", async () => {
    const response = makeRouteResponse();
    response.ranked_options = [];
    response.selected_option_id = "";
    response.selected_rank = 0;
    batchCreateRouteMock.mockResolvedValue(response);

    renderPopup({ anchorRow, rows });
    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    expect(await screen.findByText("No route options returned for remaining cargo.")).toBeInTheDocument();
  });

  it("selecting a route updates merged totals", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());

    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    const secondOption = await screen.findByTestId("route-option-rank-2");
    expect(screen.getByRole("button", { name: "Copy merged manifest" })).toBeDisabled();
    fireEvent.click(secondOption);

    expect(secondOption).toHaveTextContent("Merged volume: 15,580");
    expect(secondOption).toHaveTextContent("Jump segments: 10");
    expect(screen.getByRole("button", { name: "Copy merged manifest" })).toBeEnabled();
  });

  it("uses option totals for duplicate added lines in merged display", async () => {
    batchCreateRouteMock.mockResolvedValue(makeDuplicateTotalsRouteResponse());

    renderPopup({ anchorRow, rows });
    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    const option = await screen.findByTestId("route-option-dup-opt");
    fireEvent.click(option);

    expect(option).toHaveTextContent("Added items: 2");
    expect(option).toHaveTextContent("Merged capital: 846 K");
    expect(option).toHaveTextContent("Merged gross: 1.66 M");
    expect(option).toHaveTextContent("Merged profit: 1.6 M");
  });

  it("copy merged manifest writes expected sections", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());

    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    fireEvent.click(await screen.findByTestId("route-option-rank-2"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy merged manifest" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const manifest = writeText.mock.calls[0][0];
    expect(manifest).toContain("Origin: Jita (Jita IV - Moon 4)");
    expect(manifest).toContain("Corridor: Jita -> Amarr");
    expect(manifest).toContain("Route jumps: 10");
    expect(manifest).toContain("ISK/jump: 9,000 ISK");
    expect(manifest).toContain("----- BASE ITEMS -----");
    expect(manifest).toContain("----- ROUTE ADDITIONS -----");
    expect(manifest).toContain("Megacyte x40");
    expect(manifest).toContain(
      "Totals: buy 830,000 ISK | sell 1,630,000 ISK | profit 1,590,000 ISK",
    );
  });

  it("copy manifest remains base-only and unchanged without route selection", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());

    renderPopup({ anchorRow, rows });
    fireEvent.click(await screen.findByRole("button", { name: "Copy manifest" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const baseManifest = writeText.mock.calls[0][0];
    expect(baseManifest).toContain("Buy Station: Jita IV - Moon 4");
    expect(baseManifest).toContain("Sell Station: Amarr VIII (Oris) - Emperor Family Academy");
    expect(baseManifest).toContain("Total profit: 1,500,000 ISK");
    expect(baseManifest).not.toContain("----- MERGED SUMMARY -----");

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    await screen.findByTestId("route-option-rank-1");

    expect(screen.getByRole("button", { name: "Copy merged manifest" })).toBeDisabled();
  });
});
