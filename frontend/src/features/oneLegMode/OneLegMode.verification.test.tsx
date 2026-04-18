import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

function row(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "A",
    BuySystemName: "A",
    BuySystemID: 10,
    BuyLocationID: 100,
    SellPrice: 130,
    SellStation: "B",
    SellSystemName: "B",
    SellSystemID: 20,
    SellLocationID: 200,
    ProfitPerUnit: 30,
    MarginPercent: 30,
    UnitsToBuy: 10,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 300,
    ProfitPerJump: 100,
    BuyJumps: 0,
    SellJumps: 2,
    TotalJumps: 2,
    DailyVolume: 50,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 120,
    ...overrides,
  };
}

describe("OneLegMode verification", () => {
  it("quick verify uses row/batch rows from selected same-leg only", async () => {
    const anchor = row({ TypeID: 4101, TypeName: "Anchor" });
    const offLeg = row({ TypeID: 4102, TypeName: "OffLeg", SellLocationID: 999, SellSystemID: 99, SellSystemName: "C" });

    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[anchor, offLeg]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
            cargoLimit={200}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    const panel = await screen.findByTestId("one-leg-panel");
    expect(panel.textContent).toContain("1 selected");

    fireEvent.click(screen.getByRole("button", { name: /quick verify selected leg/i }));
    expect(await screen.findByTestId("one-leg-verification-status")).toHaveTextContent(/Good|Reduced edge|Abort/);
  });
});
