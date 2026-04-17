import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

describe("ScanResultsTable saved route packs", () => {
  const writeText = vi.fn(async () => undefined);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("eve-radius-route-view-mode:v1", "route");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    writeText.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("route header Pin persists pack and toggles state", async () => {
    renderTable([makeRow(), makeRow({ TypeID: 1002, TypeName: "Second" })]);

    const pinButton = await screen.findByRole("button", { name: "Pin" });
    fireEvent.click(pinButton);

    expect(await screen.findByRole("button", { name: "Pinned" })).toBeInTheDocument();
    expect(screen.getByTestId("saved-route-packs-panel")).toHaveTextContent("Jita → Amarr");

    fireEvent.click(screen.getByRole("button", { name: "Pinned" }));
    expect(await screen.findByRole("button", { name: "Pin" })).toBeInTheDocument();
  });

  it("route header Copy writes expected formatted text", async () => {
    renderTable([makeRow()]);
    const copyButton = await screen.findByRole("button", { name: "Copy" });
    fireEvent.click(copyButton);

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = String(writeText.mock.calls[0][0]);
    expect(copied).toContain("Route: Jita → Amarr");
    expect(copied).toContain("Verification:");
  });

  it("reopening saved pack restores workbench route context", async () => {
    renderTable([makeRow(), makeRow({ TypeID: 1002, TypeName: "Second" })]);

    fireEvent.click(await screen.findByRole("button", { name: "Pin" }));
    const panel = screen.getByTestId("saved-route-packs-panel");
    fireEvent.click(within(panel).getByRole("button", { name: "Open" }));

    expect(await screen.findByRole("button", { name: /Copy manifest/i })).toBeInTheDocument();
  });
});
