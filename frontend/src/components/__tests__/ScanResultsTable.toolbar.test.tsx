import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";
import { createSessionStationFilters } from "@/lib/banlistFilters";

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

const ADVANCED_TOOLBAR_VISIBLE_STORAGE_KEY =
  "eve-radius-advanced-toolbar-visible:v1";

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
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable
          results={results}
          scanning={false}
          progress=""
          tradeStateTab="radius"
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ScanResultsTable advanced toolbar", () => {
  it("is hidden by default and keeps primary controls visible", () => {
    renderTable([makeRow()]);

    expect(screen.getByRole("button", { name: /advanced ▸/i })).toBeInTheDocument();
    expect(screen.queryByTitle("Quick profile preset")).not.toBeInTheDocument();
    expect(screen.getByTitle("Export CSV")).toBeInTheDocument();
    expect(screen.getByTitle("Copy table")).toBeInTheDocument();
    expect(screen.getByTitle("Column setup")).toBeInTheDocument();
  });

  it("shows and hides advanced controls when toggled", () => {
    renderTable([makeRow()]);

    fireEvent.click(screen.getByRole("button", { name: /advanced ▸/i }));
    expect(screen.getByRole("button", { name: /advanced ▾/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /endpoint prefs ▸/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /advanced ▾/i }));
    expect(screen.getByRole("button", { name: /advanced ▸/i })).toBeInTheDocument();
    expect(screen.queryByTitle("Quick profile preset")).not.toBeInTheDocument();
  });

  it("restores advanced toolbar visibility from localStorage", () => {
    localStorage.setItem(ADVANCED_TOOLBAR_VISIBLE_STORAGE_KEY, "1");

    renderTable([makeRow()]);

    expect(screen.getByRole("button", { name: /advanced ▾/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /endpoint prefs ▸/i })).toBeInTheDocument();
  });

  it("toggles ordering mode and updates pins-first control state", () => {
    renderTable([makeRow(), makeRow({ TypeID: 102, TypeName: "Item 102" })]);
    fireEvent.click(screen.getByRole("button", { name: /advanced ▸/i }));

    const smartButton = screen.getByTestId("ordering-mode-toggle:smart");
    const columnOnlyButton = screen.getByTestId("ordering-mode-toggle:column_only");
    const pinsFirstToggle = screen.getByTestId("pins-first-toggle") as HTMLInputElement;

    expect(smartButton).toBeInTheDocument();
    expect(columnOnlyButton).toBeInTheDocument();
    expect(pinsFirstToggle.checked).toBe(true);
    expect(pinsFirstToggle.disabled).toBe(false);

    fireEvent.click(columnOnlyButton);
    expect(pinsFirstToggle.disabled).toBe(true);

    fireEvent.click(smartButton);
    expect(pinsFirstToggle.disabled).toBe(false);

    fireEvent.click(pinsFirstToggle);
    expect(pinsFirstToggle.checked).toBe(false);
  });

  it("renders ordering stack for smart and column-only modes", () => {
    renderTable([makeRow(), makeRow({ TypeID: 102, TypeName: "Item 102" })]);
    fireEvent.click(screen.getByRole("button", { name: /advanced ▸/i }));

    const orderingStack = screen.getByTestId("ordering-stack");
    expect(orderingStack).toBeInTheDocument();
    expect(screen.getByText("Order: Smart")).toBeInTheDocument();
    expect(screen.getByText("Endpoint rank")).toBeInTheDocument();
    expect(screen.getByText(/Desc/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ordering-mode-toggle:column_only"));
    expect(screen.getByText("Order: Column only")).toBeInTheDocument();
    expect(screen.queryByText("Endpoint rank")).not.toBeInTheDocument();
  });

  it("updates ordering stack chips when smart contributors toggle", () => {
    const filters = createSessionStationFilters();
    filters.deprioritizedStationIds.add(60003760);
    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[makeRow()]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
            sessionStationFilters={filters}
          />
        </ToastProvider>
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /advanced ▸/i }));

    expect(screen.getByText("Session deprioritized")).toBeInTheDocument();
    expect(screen.queryByText("Tracked first")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tracked ▸/i }));
    fireEvent.click(screen.getByLabelText("Tracked first"));
    expect(
      screen.getByTestId("ordering-stack-chip:Tracked first"),
    ).toBeInTheDocument();
  });

  it("shows smart-mode sort tooltip only while smart ordering is active", () => {
    renderTable([makeRow()]);
    fireEvent.click(screen.getByRole("button", { name: /advanced ▸/i }));

    expect(
      screen.getByTitle(/Smart ordering layers .* this column sort/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ordering-mode-toggle:column_only"));
    expect(
      screen.queryByTitle(/Smart ordering layers .* this column sort/i),
    ).not.toBeInTheDocument();
  });

  it("exposes accessible grouping labels for filtering and ranking controls", () => {
    renderTable([makeRow()]);
    fireEvent.click(screen.getByRole("button", { name: /advanced ▸/i }));

    expect(
      screen.getByRole("group", { name: "Filtering controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Ranking and ordering controls" }),
    ).toBeInTheDocument();
  });
});
