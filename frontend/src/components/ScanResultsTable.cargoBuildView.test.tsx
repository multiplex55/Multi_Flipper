import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  getStationTradeStates: vi.fn(async () => ({ states: [] })),
  getGankCheck: vi.fn(async () => ({ route: [] })),
  getGankCheckBatch: vi.fn(async () => []),
  getWatchlist: vi.fn(async () => []),
  openMarketInGame: vi.fn(async () => undefined),
  listPinnedOpportunities: vi.fn(async () => []),
  rebootStationCache: vi.fn(async () => ({ cleared: 0 })),
  removeFromWatchlist: vi.fn(async () => undefined),
  removePinnedOpportunity: vi.fn(async () => ({ status: "deleted" })),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
  setStationTradeState: vi.fn(async () => undefined),
  setWaypointInGame: vi.fn(async () => undefined),
}));

function row(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 200,
    TypeName: "Cargo Item",
    Volume: 3,
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
    UnitsToBuy: 1000,
    FilledQty: 1000,
    CanFill: true,
    BuyOrderRemain: 1000,
    SellOrderRemain: 1000,
    TotalProfit: 30000,
    ExpectedProfit: 30000,
    RealProfit: 30000,
    ProfitPerJump: 5000,
    BuyJumps: 2,
    SellJumps: 4,
    TotalJumps: 6,
    DailyVolume: 10000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 25000,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ScanResultsTable cargo builds toggle", () => {
  it("returns to prior row-mode behavior when leaving cargo builds", () => {
    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[row()]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
            featureConfig={{
              allowRouteGrouping: true,
              showRouteInsights: false,
              showRouteWorkbench: false,
              showSavedRoutes: false,
              showLoopPanel: false,
              defaultViewMode: "rows",
            }}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    const groupByItem = screen.getByLabelText("Group by item") as HTMLInputElement;
    fireEvent.click(groupByItem);
    expect(groupByItem.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Cargo builds" }));
    expect(screen.getByText(/Ranked cargo build candidates/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Row view" }));
    const groupByItemAgain = screen.getByLabelText("Group by item") as HTMLInputElement;
    expect(groupByItemAgain.checked).toBe(true);
  });

  it("shows diagnostics summary when cargo preset yields no builds", () => {
    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[
              row({
                TypeName: "No units",
                UnitsToBuy: 0,
              }),
              row({
                TypeID: 201,
                TypeName: "No volume",
                Volume: 0,
              }),
            ]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
            featureConfig={{
              allowRouteGrouping: true,
              showRouteInsights: false,
              showRouteWorkbench: false,
              showSavedRoutes: false,
              showLoopPanel: false,
              defaultViewMode: "rows",
            }}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cargo builds" }));

    expect(screen.getByText(/No cargo builds matched the/i)).toBeInTheDocument();
    expect(screen.getByTestId("radius-cargo-build-diagnostics-panel")).toBeInTheDocument();
    expect(screen.getByText(/Switch preset/i)).toBeInTheDocument();
  });

});
