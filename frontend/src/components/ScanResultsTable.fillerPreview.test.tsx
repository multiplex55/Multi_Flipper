import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";
import { buildFillerCandidates, summarizeTopFillerCandidates } from "@/lib/fillerCandidates";
import { routeLineKey } from "@/lib/batchMetrics";
import { formatISK } from "@/lib/format";

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
    TypeID: 100,
    TypeName: "Item",
    Volume: 2,
    BuyPrice: 100,
    BuyStation: "Buy",
    BuySystemName: "BuySys",
    BuySystemID: 1,
    BuyLocationID: 101,
    SellPrice: 140,
    SellStation: "Sell",
    SellSystemName: "SellSys",
    SellSystemID: 2,
    SellLocationID: 202,
    ProfitPerUnit: 40,
    MarginPercent: 10,
    UnitsToBuy: 10,
    BuyOrderRemain: 100,
    SellOrderRemain: 100,
    TotalProfit: 400,
    ProfitPerJump: 100,
    BuyJumps: 0,
    SellJumps: 1,
    TotalJumps: 1,
    DailyVolume: 100,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 100,
    FilledQty: 10,
    PreExecutionUnits: 10,
    HistoryAvailable: true,
    ...overrides,
  };
}

function groupedRouteButtons() {
  return screen.getAllByRole("button").filter((node) => {
    const text = node.textContent ?? "";
    return text.includes("→") && text.includes("items");
  });
}

describe("ScanResultsTable filler preview", () => {
  it("shows top candidate preview from solver output", async () => {
    localStorage.setItem("eve-radius-route-view-mode:v1", "route");

    const core = makeRow({ TypeID: 5001, TypeName: "Core", TotalProfit: 800 });
    const f1 = makeRow({ TypeID: 5002, TypeName: "F1", TotalProfit: 450 });
    const f2 = makeRow({ TypeID: 5003, TypeName: "F2", TotalProfit: 300, Volume: 1.5 });
    const f3 = makeRow({ TypeID: 5004, TypeName: "F3", TotalProfit: 280, Volume: 1 });

    const expected = summarizeTopFillerCandidates(
      buildFillerCandidates({
        routeRows: [core, f1, f2, f3],
        selectedCoreLineKeys: [routeLineKey(core)],
        remainingCargoM3: 200 - core.Volume * core.UnitsToBuy,
        remainingCapitalIsk: 1_000_000,
        minConfidencePercent: 35,
        minExecutionQuality: 35,
      }),
      3,
    );

    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[core, f1, f2, f3]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
            cargoLimit={200}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    const [routeButton] = groupedRouteButtons();
    fireEvent.click(routeButton);

    const summary = await screen.findByTestId(
      `route-filler-summary:loc:${core.BuyLocationID}->loc:${core.SellLocationID}`,
    );

    await waitFor(() => {
      expect(summary.textContent ?? "").toContain(`top ${expected.count}`);
      expect(summary.textContent ?? "").toContain(formatISK(expected.totalProfitIsk));
    });
  });
});
