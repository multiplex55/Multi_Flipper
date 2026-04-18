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

function row(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Trit",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 200,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 100,
    MarginPercent: 25,
    UnitsToBuy: 20,
    BuyOrderRemain: 20,
    SellOrderRemain: 20,
    TotalProfit: 1000,
    ProfitPerJump: 100,
    BuyJumps: 1,
    SellJumps: 1,
    TotalJumps: 2,
    DailyVolume: 500,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 600,
    RealProfit: 800,
    ...overrides,
  };
}

describe("ScanResultsTable route explanation", () => {
  afterEach(() => cleanup());

  it("shows route popover content with lens delta", async () => {
    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[row(), row({ TypeID: 2, TypeName: "Pyerite" })]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
          />
        </ToastProvider>
      </I18nProvider>,
    );
    const buttons = await screen.findAllByRole("button", { name: "Why this route?" });
    fireEvent.click(buttons[0]);
    expect(await screen.findByText(/Lens change/i)).toBeInTheDocument();
  });
});
