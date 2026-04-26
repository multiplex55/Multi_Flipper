import { cleanup, render, screen } from "@testing-library/react";
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

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ScanResultsTable default view mode", () => {
  it.each(["route", "cargo_builds", "shopping_list"] as const)(
    "sanitizes persisted %s mode to rows for Radius row-first config",
    (storedMode) => {
      localStorage.setItem("eve-radius-route-view-mode:v1", storedMode);

      const { asFragment } = render(
        <I18nProvider>
          <ToastProvider>
            <ScanResultsTable
              results={[makeRow()]}
              scanning={false}
              progress=""
              tradeStateTab="radius"
              featureConfig={{
                allowRouteGrouping: false,
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

      expect(screen.getByText("Group by item")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Group by route" }),
      ).not.toBeInTheDocument();
      expect(localStorage.getItem("eve-radius-route-view-mode:v1")).toBe("rows");
      expect(asFragment()).toMatchSnapshot();
    },
  );
});
