import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";

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

function renderTable(tradeStateTab: "radius" | "region" = "radius") {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable
          results={[makeRow()]}
          scanning={false}
          progress=""
          tradeStateTab={tradeStateTab}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ScanResultsTable radius toolbar exclusivity", () => {
  it("renders each key Radius action exactly once", () => {
    renderTable("radius");

    const quickBar = screen.getByTestId("radius-toolbar-quick-bar");
    expect(within(quickBar).getAllByRole("button", { name: /^Verify Prices$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /^Export CSV$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /^Copy Table$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /^Columns$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /^Filters$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /One-leg mode/i })).toHaveLength(1);
  });

  it("shows generic toolbar in non-Radius mode and hides Radius command bar", () => {
    renderTable("region");

    expect(screen.queryByTestId("radius-toolbar-quick-bar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Verify Prices$/i })).toBeInTheDocument();

    cleanup();
    renderTable("radius");

    expect(screen.getByTestId("radius-toolbar-quick-bar")).toBeInTheDocument();
  });

  it("does not duplicate controls after route view transitions", () => {
    renderTable("radius");

    const quickBar = screen.getByTestId("radius-toolbar-quick-bar");
    fireEvent.click(screen.getByRole("button", { name: /Group by route/i }));
    fireEvent.click(screen.getByRole("button", { name: /Row view/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cargo builds/i }));
    fireEvent.click(screen.getByRole("button", { name: /Row view/i }));

    expect(within(quickBar).getAllByRole("button", { name: /^Verify Prices$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /^Export CSV$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /^Copy Table$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /^Columns$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /^Filters$/i })).toHaveLength(1);
    expect(within(quickBar).getAllByRole("button", { name: /One-leg mode/i })).toHaveLength(1);
  });
});
