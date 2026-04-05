import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";
import { addPinnedOpportunity, removePinnedOpportunity } from "@/lib/api";

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

function renderTable({
  scanning,
  results,
}: {
  scanning: boolean;
  results: FlipResult[];
}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable
          results={results}
          scanning={scanning}
          progress=""
          tradeStateTab="radius"
        />
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
          <ScanResultsTable
            results={[row]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
          />
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
          <ScanResultsTable
            results={[]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
          />
        </ToastProvider>
      </I18nProvider>,
    );

    rerender(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[row]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
          />
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
          <ScanResultsTable
            results={[row]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
          />
        </ToastProvider>
      </I18nProvider>,
    );

    const comfyButton = await screen.findByTitle("Comfy rows");
    fireEvent.click(comfyButton);

    expect(await screen.findByTitle("Compact rows")).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[row]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
          />
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
    expect(screen.getAllByPlaceholderText("Filter...").length).toBeGreaterThan(
      0,
    );

    fireEvent.click(screen.getByTitle("Clear filters"));
    expect(screen.queryByPlaceholderText("Filter...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Filter..."));
    expect(screen.getAllByPlaceholderText("Filter...").length).toBeGreaterThan(
      0,
    );
  });
});

describe("ScanResultsTable opportunity score", () => {
  afterEach(() => cleanup());

  it("renders score column, sorts by score, and shows explanation popover", async () => {
    const low = makeRow({
      TypeID: 1,
      TypeName: "Low",
      ExpectedProfit: 1_000_000,
      DayCapitalRequired: 900_000_000,
    });
    const high = makeRow({
      TypeID: 2,
      TypeName: "High",
      ExpectedProfit: 120_000_000,
      DayCapitalRequired: 80_000_000,
    });
    renderTable({ scanning: false, results: [low, high] });

    expect(screen.getAllByText("Score").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText("Score")[0]);
    const rows = screen.getAllByRole("row");
    expect(rows[2]).toHaveTextContent("High");

    fireEvent.click(screen.getAllByLabelText("Why this score?")[0]);
    expect(await screen.findByText("Final score")).toBeInTheDocument();
    expect(screen.getByText("Top positives")).toBeInTheDocument();
    expect(screen.getByText("Main penalties")).toBeInTheDocument();
    expect(screen.getByText("Factor")).toBeInTheDocument();
  });

  it("keeps score sort deterministic for ties", () => {
    const a = makeRow({
      TypeID: 10,
      TypeName: "Alpha",
      ExpectedProfit: 20_000_000,
      DayCapitalRequired: 200_000_000,
    });
    const b = makeRow({
      TypeID: 20,
      TypeName: "Beta",
      ExpectedProfit: 20_000_000,
      DayCapitalRequired: 200_000_000,
    });
    renderTable({ scanning: false, results: [a, b] });
    fireEvent.click(screen.getAllByText("Score")[0]);
    const rows = screen.getAllByRole("row");
    expect(rows[2]).toHaveTextContent("Alpha");
    expect(rows[3]).toHaveTextContent("Beta");
  });

  it("keeps score and day-detail rendering stable when target sell fields are missing", async () => {
    const row = makeRow({
      TypeID: 99,
      TypeName: "No target depth",
      DayTargetDemandPerDay: 12.5,
      DayTargetSupplyUnits: undefined,
      DayTargetLowestSell: undefined,
      TargetSellSupply: undefined,
      TargetLowestSell: undefined,
    });
    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[row]}
            scanning={false}
            progress=""
            tradeStateTab="region"
          />
        </ToastProvider>
      </I18nProvider>,
    );

    expect(screen.getAllByText("Score").length).toBeGreaterThan(0);
    expect(screen.getByText("No target depth")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("ScanResultsTable pinning", () => {
  it("pins and unpins using normalized key", async () => {
    renderTable({ scanning: false, results: [makeRow()] });
    const pinBtn = await screen.findByTitle("Pin");
    fireEvent.click(pinBtn);
    expect(addPinnedOpportunity).toHaveBeenCalled();
    const payload = vi.mocked(addPinnedOpportunity).mock.calls[0][0];
    expect(payload.opportunity_key).toContain("flip:");
    expect(payload.source).toBe("scan");
    expect(payload.metrics).toEqual(
      expect.objectContaining({
        profit: expect.any(Number),
        margin: expect.any(Number),
        volume: expect.any(Number),
        route_risk: expect.any(Number),
      }),
    );

    fireEvent.click(await screen.findByTitle("Unpin"));
    expect(removePinnedOpportunity).toHaveBeenCalledWith(
      payload.opportunity_key,
    );
  });
});
