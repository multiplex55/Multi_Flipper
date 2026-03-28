import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  addToWatchlist: vi.fn(async () => undefined),
  clearStationTradeStates: vi.fn(async () => undefined),
  deleteStationTradeStates: vi.fn(async () => undefined),
  getStationTradeStates: vi.fn(async () => []),
  getGankCheck: vi.fn(async () => ({ route: [] })),
  getGankCheckBatch: vi.fn(async () => []),
  getWatchlist: vi.fn(async () => []),
  openMarketInGame: vi.fn(async () => undefined),
  rebootStationCache: vi.fn(async () => undefined),
  removeFromWatchlist: vi.fn(async () => undefined),
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

function renderTable({ scanning, results }: { scanning: boolean; results: FlipResult[] }) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable results={results} scanning={scanning} progress="" tradeStateTab="radius" />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("ScanResultsTable compact mode defaults", () => {
  afterEach(() => {
    cleanup();
  });

  it("activates compact mode after scan completes with results", async () => {
    const row = makeRow();
    const { rerender } = renderTable({ scanning: true, results: [row] });

    expect(await screen.findByTitle("Compact rows")).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable results={[row]} scanning={false} progress="" tradeStateTab="radius" />
        </ToastProvider>
      </I18nProvider>,
    );

    expect(await screen.findByTitle("Comfy rows")).toBeInTheDocument();
  });

  it("does not auto-enable compact mode when completion has zero results", async () => {
    const row = makeRow();
    const { rerender } = renderTable({ scanning: true, results: [] });

    rerender(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable results={[]} scanning={false} progress="" tradeStateTab="radius" />
        </ToastProvider>
      </I18nProvider>,
    );

    rerender(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable results={[row]} scanning={false} progress="" tradeStateTab="radius" />
        </ToastProvider>
      </I18nProvider>,
    );

    expect(await screen.findByTitle("Compact rows")).toBeInTheDocument();
    expect(screen.queryByTitle("Comfy rows")).not.toBeInTheDocument();
  });

  it("still allows user toggling out of compact mode after auto-default", async () => {
    const row = makeRow();
    const { rerender } = renderTable({ scanning: true, results: [row] });

    rerender(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable results={[row]} scanning={false} progress="" tradeStateTab="radius" />
        </ToastProvider>
      </I18nProvider>,
    );

    const comfyButton = await screen.findByTitle("Comfy rows");
    fireEvent.click(comfyButton);

    expect(await screen.findByTitle("Compact rows")).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable results={[row]} scanning={false} progress="" tradeStateTab="radius" />
        </ToastProvider>
      </I18nProvider>,
    );

    expect(await screen.findByTitle("Compact rows")).toBeInTheDocument();
    expect(screen.queryByTitle("Comfy rows")).not.toBeInTheDocument();
  });
});

describe("ScanResultsTable filter visibility defaults", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows column filters by default in radius mode and allows toggling", async () => {
    const row = makeRow();
    renderTable({ scanning: false, results: [row] });

    // Radius mode default: filter header row is visible immediately.
    expect(screen.getAllByPlaceholderText("Filter...").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTitle("Clear filters"));
    expect(screen.queryByPlaceholderText("Filter...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Filter..."));
    expect(screen.getAllByPlaceholderText("Filter...").length).toBeGreaterThan(0);
  });
});
