import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    TypeID: 1001,
    TypeName: "Route Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyLocationID: 60003760,
    SellPrice: 130,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    SellLocationID: 60008494,
    ProfitPerUnit: 30,
    MarginPercent: 30,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 300,
    ProfitPerJump: 100,
    BuyJumps: 0,
    SellJumps: 3,
    TotalJumps: 3,
    DailyVolume: 50,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 100,
    ...overrides,
  };
}

function renderTable() {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable
          results={[makeRow(), makeRow({ TypeID: 1002, TypeName: "Second" })]}
          scanning={false}
          progress=""
          tradeStateTab="radius"
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("ScanResultsTable workbench integration", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("eve-radius-route-view-mode:v1", "route");
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the same workbench route from header, insights, and saved routes", async () => {
    renderTable();

    fireEvent.click(await screen.findByRole("button", { name: /Open route workbench summary for Jita → Amarr/i }));
    const panel = await screen.findByTestId("route-workbench-panel:loc:60003760->loc:60008494");
    expect(panel).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("route-workbench-action-pin"));
    fireEvent.click(screen.getByRole("button", { name: /Open Jita → Amarr summary/i }));
    expect(screen.getByTestId("route-workbench-panel:loc:60003760->loc:60008494")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /jump to group/i })[0]);
    expect(screen.getByTestId("route-workbench-panel:loc:60003760->loc:60008494")).toBeInTheDocument();
  });
});
