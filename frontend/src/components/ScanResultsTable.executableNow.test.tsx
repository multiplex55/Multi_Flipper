import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function makeRow(typeId: number, name: string, overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: typeId,
    TypeName: name,
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Buy",
    BuySystemName: "Buy",
    BuySystemID: 30000142,
    SellPrice: 130,
    SellStation: "Sell",
    SellSystemName: "Sell",
    SellSystemID: 30002187,
    ProfitPerUnit: 30,
    MarginPercent: 30,
    UnitsToBuy: 100,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 3_000,
    ProfitPerJump: 1_500,
    BuyJumps: 0,
    SellJumps: 1,
    TotalJumps: 1,
    DailyVolume: 900,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 900,
    RealProfit: 3_000,
    ExpectedProfit: 3_000,
    PreExecutionUnits: 100,
    FilledQty: 90,
    CanFill: true,
    SlippageBuyPct: 0.5,
    SlippageSellPct: 0.5,
    ExpectedSellPrice: 130,
    HistoryAvailable: true,
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

describe("ScanResultsTable executable now filter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("filters to executable rows when executable toggle is enabled", async () => {
    const executable = makeRow(1, "Executable Item");
    const weak = makeRow(2, "Weak Item", { FilledQty: 10, PreExecutionUnits: 100, DailyProfit: 1 });

    renderTable([executable, weak]);

    expect(await screen.findByText("Executable Item")).toBeInTheDocument();
    expect(screen.getByText("Weak Item")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("radius-command-bar-executable-toggle"));

    expect(screen.getByText("Executable Item")).toBeInTheDocument();
    expect(screen.queryByText("Weak Item")).not.toBeInTheDocument();
  });
});
