import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";
import type { RadiusHubSummary } from "@/lib/radiusHubSummaries";

vi.mock("@/lib/api", () => ({
  addToWatchlist: vi.fn(async () => undefined),
  addPinnedOpportunity: vi.fn(async () => []),
  clearStationTradeStates: vi.fn(async () => undefined),
  deleteStationTradeStates: vi.fn(async () => undefined),
  getStationTradeStates: vi.fn(async () => []),
  getGankCheck: vi.fn(async () => ({ route: [] })),
  getGankCheckBatch: vi.fn(async () => []),
  getWatchlist: vi.fn(async () => []),
  openMarketInGame: vi.fn(async () => undefined),
  listPinnedOpportunities: vi.fn(async () => []),
  rebootStationCache: vi.fn(async () => undefined),
  removeFromWatchlist: vi.fn(async () => undefined),
  removePinnedOpportunity: vi.fn(async () => ({ status: "deleted" })),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
  setStationTradeState: vi.fn(async () => undefined),
  setWaypointInGame: vi.fn(async () => undefined),
}));

const RADIUS_ROUTE_INSIGHTS_HIDDEN_STORAGE_KEY =
  "eve-radius-route-insights-hidden:v1";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 101,
    TypeName: "Item 101",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 125,
    SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 25,
    MarginPercent: 25,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 250,
    ProfitPerJump: 20,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 0,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 50,
    ...overrides,
  };
}

function renderTable(results: FlipResult[]) {
  const buyHubs: RadiusHubSummary[] = [
    {
      location_id: 60003760,
      station_name: "Jita IV - Moon 4",
      system_id: 30000142,
      system_name: "Jita",
      row_count: 2,
      item_count: 2,
      units: 50,
      capital_required: 400_000,
      period_profit: 150_000,
      avg_jumps: 1,
    },
  ];
  const sellHubs: RadiusHubSummary[] = [
    {
      location_id: 60008494,
      station_name: "Amarr VIII (Oris)",
      system_id: 30002187,
      system_name: "Amarr",
      row_count: 1,
      item_count: 1,
      units: 30,
      capital_required: 250_000,
      period_profit: 70_000,
      avg_jumps: 1,
    },
  ];
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable
          results={results}
          scanning={false}
          progress=""
          tradeStateTab="radius"
          buyHubs={buyHubs}
          sellHubs={sellHubs}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ScanResultsTable radius insights visibility", () => {
  it("shows compact insights by default, hides them, and restores with show toggle", () => {
    renderTable([makeRow()]);

    expect(
      screen.getByRole("heading", { name: /radius route insights/i }),
    ).toBeInTheDocument();
    const hideButton = screen.getByRole("button", {
      name: /hide radius route insights/i,
    });

    fireEvent.click(hideButton);

    expect(
      screen.queryByRole("heading", { name: /radius route insights/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show radius route insights/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /show radius route insights/i }),
    );

    expect(
      screen.getByRole("heading", { name: /radius route insights/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /hide radius route insights/i }),
    ).toBeInTheDocument();
  });

  it("persists hidden state in localStorage and restores it on rerender", () => {
    const firstRender = renderTable([makeRow()]);

    fireEvent.click(
      screen.getByRole("button", { name: /hide radius route insights/i }),
    );
    expect(localStorage.getItem(RADIUS_ROUTE_INSIGHTS_HIDDEN_STORAGE_KEY)).toBe(
      "1",
    );

    firstRender.unmount();
    renderTable([makeRow()]);

    expect(
      screen.queryByRole("heading", { name: /radius route insights/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show radius route insights/i }),
    ).toBeInTheDocument();
  });

  it("shows hub data in insights path without standalone duplicate panel", () => {
    renderTable([makeRow()]);

    fireEvent.click(screen.getByRole("button", { name: "Hub Activity" }));
    const headings = screen.getAllByText("Top Buy Hubs");
    expect(headings).toHaveLength(1);
    expect(screen.getAllByText("Jita IV - Moon 4").length).toBeGreaterThan(0);
  });
});
