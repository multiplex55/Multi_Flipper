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
    TypeID: 9001,
    TypeName: "Test Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 130,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 30,
    MarginPercent: 30,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 300,
    ProfitPerJump: 30,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 1,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 80,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ScanResultsTable decision mode integration", () => {
  it("applies mode defaults and can restore custom layout", () => {
    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable results={[makeRow()]} scanning={false} progress="" tradeStateTab="radius" />
        </ToastProvider>
      </I18nProvider>,
    );

    const quickBar = screen.getByTestId("radius-toolbar-quick-bar");
    const modeSelect = within(quickBar).getByLabelText("Decision mode");

    fireEvent.change(modeSelect, { target: { value: "execute" } });
    expect(within(quickBar).getByRole("button", { name: /show route insights/i })).toBeInTheDocument();

    fireEvent.click(within(quickBar).getByRole("button", { name: "Columns" }));
    expect(screen.getByRole("button", { name: "Save Layout" })).toBeInTheDocument();

    fireEvent.change(modeSelect, { target: { value: "custom" } });
    expect(within(quickBar).getByRole("button", { name: /hide route insights/i })).toBeInTheDocument();
  });
});
