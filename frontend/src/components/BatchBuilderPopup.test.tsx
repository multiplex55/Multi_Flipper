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
        execution_score: 82.5,
        ordered_buy_systems: [30000142],
        route_sequence: [30000142, 30002187],
        route_total_jumps: 8,
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
        execution_score: 88.1,
        ordered_buy_systems: [30000142],
        route_sequence: [30000142, 30002187],
        route_total_jumps: 10,
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
      execution_score: 91.2,
      ordered_buy_systems: [30000142],
      route_sequence: [30000142, 30002187],
      route_total_jumps: 7,
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

function renderPopup({
  anchorRow,
  rows,
  routeMaxJumps = 12,
  maxDetourJumpsPerNode = 3,
  onOpenPriceValidation,
  bannedTypeIDs,
  bannedStationIDs,
}: {
  anchorRow: FlipResult | null;
  rows: FlipResult[];
  routeMaxJumps?: number;
  maxDetourJumpsPerNode?: number;
  onOpenPriceValidation?: (manifestText: string) => void;
  bannedTypeIDs?: number[];
  bannedStationIDs?: number[];
}) {
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
          routeMaxJumps={routeMaxJumps}
          maxDetourJumpsPerNode={maxDetourJumpsPerNode}
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
          onOpenPriceValidation={onOpenPriceValidation}
          bannedTypeIDs={bannedTypeIDs}
          bannedStationIDs={bannedStationIDs}
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

  it("defaults to execution score sorting for route option cards", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());

    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    const options = await screen.findAllByTestId(/route-option-/);
    expect(options.map((node) => node.getAttribute("data-testid"))).toEqual([
      "route-option-rank-2",
      "route-option-rank-1",
    ]);
  });

  it("sort selector is stable for equal execution scores", async () => {
    const response = makeRouteResponse();
    response.ranked_options[0].execution_score = 80;
    response.ranked_options[1].execution_score = 80;
    batchCreateRouteMock.mockResolvedValue(response);

    renderPopup({ anchorRow, rows });
    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    const options = await screen.findAllByTestId(/route-option-/);
    expect(options.map((node) => node.getAttribute("data-testid"))).toEqual([
      "route-option-rank-1",
      "route-option-rank-2",
    ]);
  });

  it("switching sort updates displayed rank without losing selection", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());
    renderPopup({ anchorRow, rows });
    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    const selectedOption = await screen.findByTestId("route-option-rank-1");
    fireEvent.click(selectedOption);
    expect(screen.getByRole("button", { name: "Copy merged manifest" })).toBeEnabled();

    fireEvent.change(screen.getByDisplayValue("Execution Score"), { target: { value: "total_profit_isk" } });
    const reordered = await screen.findAllByTestId(/route-option-/);
    expect(reordered[0]).toHaveAttribute("data-testid", "route-option-rank-2");
    expect(screen.getByRole("button", { name: "Copy merged manifest" })).toBeEnabled();
  });

  it("includes scan params, routing limits, and candidate snapshot in request payload", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());
    renderPopup({ anchorRow, rows, routeMaxJumps: 17, maxDetourJumpsPerNode: 5 });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    await screen.findByTestId("route-option-rank-1");

    expect(batchCreateRouteMock).toHaveBeenCalledTimes(1);
    const [payload] = batchCreateRouteMock.mock.calls[0] ?? [];
    expect(payload?.min_route_security).toBe(0.45);
    expect(payload?.include_structures).toBe(false);
    expect(payload?.allow_lowsec).toBe(false);
    expect(payload?.allow_nullsec).toBe(false);
    expect(payload?.allow_wormhole).toBe(false);
    expect(payload?.route_max_jumps).toBe(17);
    expect(payload?.max_detour_jumps_per_node).toBe(5);
    expect(payload?.current_system_id).toBe(30000142);
    expect(payload?.current_location_id).toBe(60003760);
    expect(payload?.candidate_context?.source_tab).toBe("radius");
    expect(payload?.candidate_context?.cache_revision).toBe(99);
    expect(payload?.candidate_context?.cache_next_expiry).toBe("2026-03-27T00:30:00Z");
    expect(payload?.candidate_context?.cache_stale).toBe(false);
    expect(payload?.candidate_snapshot?.length).toBeGreaterThan(0);
    expect(payload?.candidate_snapshot?.[0]).toMatchObject({
      type_id: expect.any(Number),
      buy_system_id: expect.any(Number),
      sell_system_id: expect.any(Number),
    });
  });

  it("excludes banned types and stations from candidate snapshot payload", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());
    const stationBannedRow = makeRow({
      TypeID: 44,
      TypeName: "Banned Station Candidate",
      BuyLocationID: 60009999,
      BuyStation: "Dodixie IX",
      UnitsToBuy: 100,
      ProfitPerUnit: 20,
    });
    renderPopup({
      anchorRow,
      rows: [...rows, stationBannedRow],
      bannedTypeIDs: [22],
      bannedStationIDs: [60009999],
    });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    await screen.findByTestId("route-option-rank-1");

    const [payload] = batchCreateRouteMock.mock.calls[0] ?? [];
    const typeIDs = payload?.candidate_snapshot?.map((line) => line.type_id) ?? [];
    const buyStations = payload?.candidate_snapshot?.map((line) => line.buy_location_id) ?? [];
    expect(typeIDs).not.toContain(22);
    expect(buyStations).not.toContain(60009999);
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


  it("does not show empty-options message when API returns route options", async () => {
    const response = makeRouteResponse();
    response.diagnostics = ["diagnostic should not force empty state"]; 
    batchCreateRouteMock.mockResolvedValue(response);

    renderPopup({ anchorRow, rows });
    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    await screen.findByTestId("route-option-rank-1");
    expect(screen.queryByText("No route options returned for remaining cargo.")).not.toBeInTheDocument();
  });

  it("renders ranked route option details from multi-option planner output", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());

    renderPopup({ anchorRow, rows });
    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));

    const first = await screen.findByTestId("route-option-rank-1");
    const second = await screen.findByTestId("route-option-rank-2");

    expect(first).toHaveTextContent("#2");
    expect(first).toHaveTextContent("Added profit: 40 K");
    expect(first).toHaveTextContent("Jump segments: 8");
    expect(second).toHaveTextContent("#1");
    expect(second).toHaveTextContent("Added items: 1");
    expect(second).toHaveTextContent("Jump segments: 10");
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

  it("copy merged manifest writes route blocks and appends base-manifest-formatted item section", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());

    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Copy manifest" }));
    const baseManifest = writeText.mock.calls[0][0] as string;
    const baseDetailLines = baseManifest
      .split("\n")
      .filter((line) => line.includes(" | qty ") && line.includes(" | buy total "));

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    fireEvent.click(await screen.findByTestId("route-option-rank-2"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy merged manifest" }));

    expect(writeText).toHaveBeenCalledTimes(2);
    const manifest = writeText.mock.calls[1][0] as string;
    expect(manifest).toContain("Origin: Jita (Jita IV - Moon 4)");
    expect(manifest).toContain("Buy Station: Jita IV - Moon 4");
    expect(manifest).toContain("Jumps to Buy Station: 0");
    expect(manifest).toContain("Jumps Buy -> Sell: 0");
    expect(manifest).toContain("Sell Station: Amarr VIII (Oris) - Emperor Family Academy");
    expect(manifest).toContain("Cargo m3: 15,580 m3");
    expect(manifest).toContain("Items: 4");
    expect(manifest).toContain("Total volume: 15,580 m3");
    expect(manifest).toContain("Total capital: 830,000 ISK");
    expect(manifest).toContain("Total gross sell: 1,630,000 ISK");
    expect(manifest).toContain("Total profit: 1,590,000 ISK");
    expect(manifest).toContain("Total isk/jump: 9,000 ISK");
    expect(manifest).toContain("Base manifest items:");
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
      const matches = manifest.match(
        new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gm"),
      );
      expect(matches?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
    for (const baseLine of baseDetailLines) {
      expect(manifest).toContain(baseLine);
    }
    expect(manifest).toContain(
      "Anchor Paste | qty 1,500 | buy total 150,000 ISK | buy per 100 ISK | sell total 180,000 ISK | sell per 120 ISK | vol 1,500 m3 | profit 150,000 ISK",
    );
    expect(manifest).toContain(
      "Megacyte | qty 40 | buy total 200,000 ISK | buy per 5,000 ISK | sell total 290,000 ISK | sell per 7,250 ISK | vol 80 m3 | profit 90,000 ISK",
    );
    const detailRowIndex = manifest.indexOf("Megacyte | qty 40");
    const autobuyRowIndex = manifest.indexOf("\nMegacyte 40");
    expect(detailRowIndex).toBeGreaterThanOrEqual(0);
    expect(autobuyRowIndex).toBeGreaterThan(detailRowIndex);
    expect(manifest).not.toMatch(/^Station:/m);
    expect(manifest).not.toContain("Item list:");
    expect(manifest).not.toContain("----- ROUTE SUMMARY -----");
    expect(manifest).not.toContain("----- MERGED SUMMARY -----");
  });

  it("copy merged manifest includes mixed base+added item lines once each in base manifest items section", async () => {
    batchCreateRouteMock.mockResolvedValue(makeRouteResponse());

    renderPopup({ anchorRow, rows });
    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    fireEvent.click(await screen.findByTestId("route-option-rank-2"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy merged manifest" }));

    const manifest = writeText.mock.calls[writeText.mock.calls.length - 1][0] as string;
    const sectionStart = manifest.indexOf("\nBase manifest items:\n");
    expect(sectionStart).toBeGreaterThanOrEqual(0);
    const baseItemsSection = manifest.slice(sectionStart);
    const anchorLine =
      "Anchor Paste | qty 1,500 | buy total 150,000 ISK | buy per 100 ISK | sell total 180,000 ISK | sell per 120 ISK | vol 1,500 m3 | profit 150,000 ISK";
    const addedLine =
      "Megacyte | qty 40 | buy total 200,000 ISK | buy per 5,000 ISK | sell total 290,000 ISK | sell per 7,250 ISK | vol 80 m3 | profit 90,000 ISK";
    expect((baseItemsSection.match(new RegExp(anchorLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length).toBe(1);
    expect((baseItemsSection.match(new RegExp(addedLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length).toBe(1);
  });

  it("copy merged manifest does not print zero placeholders for unknown jump metadata", async () => {
    const response = makeRouteResponse();
    const rowsWithoutJumpMetadata = rows.map((row) => ({
      ...row,
      BuyJumps: Number.NaN,
      SellJumps: Number.NaN,
    }));
    response.ranked_options = [
      {
        ...response.ranked_options[0],
        option_id: "unknown-jumps",
        lines: [
          {
            ...response.ranked_options[0].lines[0],
            type_id: 1999,
            type_name: "Unknown Jump Item",
          },
        ],
      },
    ];
    response.selected_option_id = "";
    response.selected_rank = 0;
    batchCreateRouteMock.mockResolvedValue(response);

    renderPopup({ anchorRow: rowsWithoutJumpMetadata[0], rows: rowsWithoutJumpMetadata });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    fireEvent.click(await screen.findByTestId("route-option-unknown-jumps"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy merged manifest" }));

    const manifest = writeText.mock.calls[writeText.mock.calls.length - 1][0];
    expect(manifest).toContain("Jumps to Buy Station: N/A");
    expect(manifest).toContain("Jumps Buy -> Sell: N/A");
    expect(manifest).not.toContain("Jumps to Buy Station: 0");
    expect(manifest).not.toContain("Jumps Buy -> Sell: 0");
  });

  it("copy merged manifest orders station blocks by optimized route sequence", async () => {
    const response = makeRouteResponse();
    response.ranked_options = [
      {
        ...response.ranked_options[0],
        option_id: "route-order",
        lines: [
          {
            type_id: 8001,
            type_name: "First Hop Item",
            units: 10,
            unit_volume_m3: 1,
            buy_system_id: 30000142,
            buy_location_id: 60003760,
            sell_system_id: 30002187,
            sell_location_id: 60008494,
            buy_total_isk: 10000,
            sell_total_isk: 13000,
            profit_total_isk: 3000,
            route_jumps: 8,
          },
          {
            type_id: 8002,
            type_name: "Second Hop Item",
            units: 10,
            unit_volume_m3: 1,
            buy_system_id: 30005305,
            buy_location_id: 61000001,
            sell_system_id: 30002187,
            sell_location_id: 60008494,
            buy_total_isk: 12000,
            sell_total_isk: 17000,
            profit_total_isk: 5000,
            route_jumps: 8,
          },
        ],
        ordered_buy_systems: [30000142, 30005305],
        route_sequence: [30000142, 30005305, 30002187],
      },
    ];
    response.selected_option_id = "";
    response.selected_rank = 0;
    batchCreateRouteMock.mockResolvedValue(response);

    const altRows = [
      ...rows,
      makeRow({
        TypeID: 8002,
        TypeName: "Second Hop Item",
        BuySystemID: 30005305,
        BuyLocationID: 61000001,
        BuyStation: "Dodixie IX - Moon 20",
      }),
    ];
    renderPopup({ anchorRow, rows: altRows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    fireEvent.click(await screen.findByTestId("route-option-route-order"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy merged manifest" }));

    const manifest = writeText.mock.calls[writeText.mock.calls.length - 1][0];
    const jitaIndex = manifest.indexOf("Buy Station: Jita IV - Moon 4");
    const dodixieIndex = manifest.indexOf("Buy Station: Dodixie IX - Moon 20");
    expect(jitaIndex).toBeGreaterThanOrEqual(0);
    expect(dodixieIndex).toBeGreaterThanOrEqual(0);
    expect(jitaIndex).toBeLessThan(dodixieIndex);
  });

  it("copy merged manifest keeps true zero jump values when row metadata explicitly has zero jumps", async () => {
    const response = makeRouteResponse();
    response.ranked_options = [
      {
        ...response.ranked_options[0],
        option_id: "true-zero-jumps",
        lines: [
          {
            ...response.ranked_options[0].lines[0],
            type_id: anchorRow.TypeID,
            type_name: anchorRow.TypeName,
          },
        ],
      },
    ];
    response.selected_option_id = "";
    response.selected_rank = 0;
    batchCreateRouteMock.mockResolvedValue(response);

    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    fireEvent.click(await screen.findByTestId("route-option-true-zero-jumps"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy merged manifest" }));

    const manifest = writeText.mock.calls[writeText.mock.calls.length - 1][0];
    expect(manifest).toContain("Jumps to Buy Station: 0");
    expect(manifest).toContain("Jumps Buy -> Sell: 0");
  });

  it("resolves buy station via location map when exact row match is unavailable", async () => {
    const response = makeRouteResponse();
    response.ranked_options = [
      {
        ...response.ranked_options[0],
        option_id: "map-fallback",
        lines: [
          {
            ...response.ranked_options[0].lines[0],
            type_id: 999999,
            type_name: "Unmatched Item",
            buy_location_id: 60003760,
          },
        ],
      },
    ];
    response.selected_option_id = "";
    response.selected_rank = 0;
    batchCreateRouteMock.mockResolvedValue(response);

    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    fireEvent.click(await screen.findByTestId("route-option-map-fallback"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy merged manifest" }));

    const latestManifestCall = writeText.mock.calls[writeText.mock.calls.length - 1];
    const manifest = latestManifestCall?.[0] ?? "";
    expect(manifest).toContain("Buy Station: Jita IV - Moon 4");
    expect(manifest).not.toContain("Buy Station: Station 60003760");
  });

  it("falls back to Station <id> only when no station-name resolvers succeed", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = makeRouteResponse();
    response.ranked_options = [
      {
        ...response.ranked_options[0],
        option_id: "id-fallback",
        lines: [
          {
            ...response.ranked_options[0].lines[0],
            type_id: 888888,
            type_name: "Unknown Hub Item",
            buy_location_id: 70000001,
          },
        ],
      },
    ];
    response.selected_option_id = "";
    response.selected_rank = 0;
    batchCreateRouteMock.mockResolvedValue(response);

    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Batch Create Route" }));
    fireEvent.click(await screen.findByTestId("route-option-id-fallback"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy merged manifest" }));

    const latestManifestCall = writeText.mock.calls[writeText.mock.calls.length - 1];
    const manifest = latestManifestCall?.[0] ?? "";
    expect(manifest).toContain("Buy Station: Station 70000001");
    expect(warnSpy).toHaveBeenCalledWith(
      "[BatchBuilderPopup] copyMergedManifest used station ID fallback labels",
      { station_ids: [70000001] },
    );
    warnSpy.mockRestore();
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

  it("renders Open Price Validation button and emits deterministic manifest payload", async () => {
    const onOpenPriceValidation = vi.fn();
    renderPopup({ anchorRow, rows, onOpenPriceValidation });

    const trigger = await screen.findByRole("button", { name: "Open Price Validation" });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);

    expect(onOpenPriceValidation).toHaveBeenCalledTimes(1);
    const manifest = onOpenPriceValidation.mock.calls[0]?.[0] as string;
    expect(manifest).toContain("Buy Station: Jita IV - Moon 4");
    expect(manifest).toContain("Sell Station: Amarr VIII (Oris) - Emperor Family Academy");
    expect(manifest).not.toContain("Export Order");
    expect(manifest).toContain("Anchor Paste 1500");
  });
});
