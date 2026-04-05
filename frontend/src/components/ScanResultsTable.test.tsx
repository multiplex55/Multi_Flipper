import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";
import {
  addPinnedOpportunity,
  getGankCheckBatch,
  removePinnedOpportunity,
} from "@/lib/api";

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


describe("ScanResultsTable radius decision lens and tie sorting", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("applies decision lens preset sorting while keeping custom sorting available", async () => {
    localStorage.clear();
    const faster = makeRow({
      TypeID: 11,
      TypeName: "Faster",
      RealProfit: 600,
      TotalJumps: 2,
    });
    const slower = makeRow({
      TypeID: 12,
      TypeName: "Slower",
      RealProfit: 400,
      TotalJumps: 4,
    });

    renderTable({ scanning: false, results: [slower, faster] });

    fireEvent.click(screen.getAllByRole("button", { name: "Fastest ISK" })[0]);
    let rows = screen
      .getAllByRole("row")
      .filter((row) => /Faster|Slower/.test(row.textContent ?? ""));
    expect(rows[0]).toHaveTextContent("Faster");

    fireEvent.click(screen.getAllByText("Item")[0]);
    rows = screen
      .getAllByRole("row")
      .filter((row) => /Faster|Slower/.test(row.textContent ?? ""));
    expect(rows.length).toBeGreaterThan(0);
  });

  it("keeps Real ISK/Jump sorting deterministic when values tie", () => {
    const b = makeRow({
      TypeID: 20,
      TypeName: "Type 20",
      RealProfit: 100,
      TotalJumps: 2,
      BuySystemID: 30000144,
      SellSystemID: 30002188,
    });
    const a = makeRow({
      TypeID: 10,
      TypeName: "Type 10",
      RealProfit: 100,
      TotalJumps: 2,
      BuySystemID: 30000142,
      SellSystemID: 30002187,
    });

    renderTable({ scanning: false, results: [b, a] });
    fireEvent.click(screen.getAllByText("Real ISK/Jump")[0]);

    const rows = screen.getAllByRole("row");
    expect(rows[2]).toHaveTextContent("Type 10");
    expect(rows[3]).toHaveTextContent("Type 20");
  });

  it("supports grouped-by-route expand/collapse and grouped sorting", () => {
    const routeHighA = makeRow({
      TypeID: 401,
      TypeName: "High A",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      ProfitPerUnit: 50,
      UnitsToBuy: 10,
    });
    const routeHighB = makeRow({
      TypeID: 402,
      TypeName: "High B",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: routeHighA.BuySystemID,
      SellSystemID: routeHighA.SellSystemID,
      ProfitPerUnit: 40,
      UnitsToBuy: 10,
    });
    const routeLow = makeRow({
      TypeID: 403,
      TypeName: "Low Route",
      BuyStation: "Dodixie Hub",
      SellStation: "Rens Hub",
      BuySystemID: 30002659,
      SellSystemID: 30002510,
      BuyLocationID: 0,
      SellLocationID: 0,
      ProfitPerUnit: 5,
      UnitsToBuy: 10,
    });

    renderTable({ scanning: false, results: [routeLow, routeHighA, routeHighB] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    fireEvent.click(screen.getAllByText("Batch Profit")[0]);

    const routeButtons = screen.getAllByRole("button").filter((node) => {
      const text = node.textContent ?? "";
      return text.includes("→") && text.includes("items");
    });
    expect(routeButtons[0]).toHaveTextContent("Jita Hub → Amarr Hub");

    expect(screen.queryByText("High A")).not.toBeInTheDocument();
    fireEvent.click(routeButtons[0]);
    expect(screen.getByText("High A")).toBeInTheDocument();
    expect(screen.getByText("High B")).toBeInTheDocument();
    fireEvent.click(routeButtons[0]);
    expect(screen.queryByText("High A")).not.toBeInTheDocument();
  });

  it("honors Safest lens route ordering in route mode", async () => {
    vi.mocked(getGankCheckBatch).mockResolvedValueOnce([
      { key: "30000142:30002187", danger: "red", kills: 3, totalISK: 10_000_000 },
      { key: "30002659:30002510", danger: "green", kills: 0, totalISK: 0 },
    ]);

    const redRoute = makeRow({
      TypeID: 502,
      TypeName: "Red Route",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
    });
    const greenRoute = makeRow({
      TypeID: 503,
      TypeName: "Green Route",
      BuyStation: "Dodixie Hub",
      SellStation: "Rens Hub",
      BuySystemID: 30002659,
      SellSystemID: 30002510,
    });

    renderTable({
      scanning: false,
      results: [redRoute, greenRoute],
    });

    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Safest" })[0]);

    await waitFor(() => {
      const groupedRouteButtons = screen
        .getAllByRole("button")
        .filter((node) => {
          const text = node.textContent ?? "";
          return text.includes("→") && text.includes("items");
        });
      expect(groupedRouteButtons[0]).toHaveTextContent("Dodixie Hub → Rens Hub");
      expect(groupedRouteButtons[1]).toHaveTextContent("Jita Hub → Amarr Hub");
    });
  });

  it("keeps identical metric rows in deterministic order across rerenders", () => {
    const tieOne = makeRow({
      TypeID: 500,
      TypeName: "Tie Item",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      RealProfit: 200,
      TotalJumps: 2,
    });
    const tieTwo = makeRow({
      TypeID: 500,
      TypeName: "Tie Item",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      BuyLocationID: 0,
      SellLocationID: 0,
      RealProfit: 200,
      TotalJumps: 2,
    });

    const { rerender } = renderTable({ scanning: false, results: [tieTwo, tieOne] });
    fireEvent.click(screen.getAllByText("Real ISK/Jump")[0]);
    const firstRenderRows = screen
      .getAllByRole("row")
      .filter((row) => row.textContent?.includes("Tie Item"));
    const firstOrder = firstRenderRows.map((row) => row.textContent);

    rerender(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[tieTwo, tieOne]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
          />
        </ToastProvider>
      </I18nProvider>,
    );
    fireEvent.click(screen.getAllByText("Real ISK/Jump")[0]);
    const secondRenderRows = screen
      .getAllByRole("row")
      .filter((row) => row.textContent?.includes("Tie Item"));
    const secondOrder = secondRenderRows.map((row) => row.textContent);
    expect(secondOrder).toEqual(firstOrder);
  });
});
