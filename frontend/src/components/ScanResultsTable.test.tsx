import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable, calcRouteConfidence } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";
import { executionQualityForFlip, requestedUnitsForFlip } from "@/lib/executionQuality";
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

function groupedRouteButtons() {
  return screen.getAllByRole("button").filter((node) => {
    const text = node.textContent ?? "";
    return text.includes("→") && text.includes("items");
  });
}
const TOP_PICKS_VISIBLE_STORAGE_KEY = "eve-radius-top-picks-visible:v1";

function focusedRouteFixtures() {
  const safeTrimmed = makeRow({
    TypeID: 1201,
    TypeName: "Safe Trimmed",
    BuyStation: "R-1001 Buy",
    SellStation: "R-1001 Sell",
    BuySystemID: 41000001,
    SellSystemID: 41000002,
    PreExecutionUnits: 100,
    UnitsToBuy: 60,
    FilledQty: 60,
    BuyOrderRemain: 60,
    SellOrderRemain: 60,
    RealProfit: 120,
    DailyProfit: 80,
    SlippageBuyPct: 0.3,
    SlippageSellPct: 0.2,
    DayTargetPeriodPrice: 100,
    DayTargetNowPrice: 101,
    TotalJumps: 2,
    Volume: 1,
  });
  const safeCompanion = makeRow({
    TypeID: 1202,
    TypeName: "Safe Companion",
    BuyStation: safeTrimmed.BuyStation,
    SellStation: safeTrimmed.SellStation,
    BuySystemID: safeTrimmed.BuySystemID,
    SellSystemID: safeTrimmed.SellSystemID,
    RealProfit: 300,
    DailyProfit: 220,
    UnitsToBuy: 100,
    FilledQty: 95,
    BuyOrderRemain: 150,
    SellOrderRemain: 140,
    SlippageBuyPct: 1,
    SlippageSellPct: 1,
    DayTargetPeriodPrice: 110,
    DayTargetNowPrice: 111,
    TotalJumps: 2,
    Volume: 1,
  });
  const unknownRoute = makeRow({
    TypeID: 1301,
    TypeName: "Unknown Safety",
    BuyStation: "R-1002 Buy",
    SellStation: "R-1002 Sell",
    BuySystemID: 42000001,
    SellSystemID: 42000002,
    RealProfit: 250,
    DailyProfit: 190,
    UnitsToBuy: 50,
    FilledQty: 40,
    BuyOrderRemain: 60,
    SellOrderRemain: 60,
    SlippageBuyPct: 2,
    SlippageSellPct: 1,
    DayTargetPeriodPrice: 125,
    DayTargetNowPrice: 125,
    TotalJumps: 2,
    Volume: 1,
  });
  const conflictingRowSignalWeakTop = makeRow({
    TypeID: 1401,
    TypeName: "Conflicting Weak Top",
    BuyStation: "R-1003 Buy",
    SellStation: "R-1003 Sell",
    BuySystemID: 43000001,
    SellSystemID: 43000002,
    RealProfit: 5,
    DailyProfit: 5,
    UnitsToBuy: 3,
    FilledQty: 2,
    BuyOrderRemain: 4,
    SellOrderRemain: 4,
    SlippageBuyPct: 10,
    SlippageSellPct: 10,
    TotalJumps: 1,
    Volume: 1,
  });
  const conflictingRowSignalStrongSecond = makeRow({
    TypeID: 1402,
    TypeName: "Conflicting Strong Second",
    BuyStation: conflictingRowSignalWeakTop.BuyStation,
    SellStation: conflictingRowSignalWeakTop.SellStation,
    BuySystemID: conflictingRowSignalWeakTop.BuySystemID,
    SellSystemID: conflictingRowSignalWeakTop.SellSystemID,
    RealProfit: 600,
    DailyProfit: 400,
    UnitsToBuy: 200,
    FilledQty: 180,
    BuyOrderRemain: 220,
    SellOrderRemain: 220,
    SlippageBuyPct: 0.5,
    SlippageSellPct: 0.5,
    TotalJumps: 1,
    Volume: 1,
  });

  return {
    safeTrimmed,
    safeCompanion,
    unknownRoute,
    conflictingRowSignalWeakTop,
    conflictingRowSignalStrongSecond,
    allRows: [
      unknownRoute,
      safeTrimmed,
      safeCompanion,
      conflictingRowSignalWeakTop,
      conflictingRowSignalStrongSecond,
    ],
  };
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

    const routeButtons = groupedRouteButtons();
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
    fireEvent.click(screen.getByRole("button", { name: "Safest Route" }));

    await waitFor(() => {
      const routeButtons = groupedRouteButtons();
      expect(routeButtons[0]).toHaveTextContent("Dodixie Hub → Rens Hub");
      expect(routeButtons[1]).toHaveTextContent("Jita Hub → Amarr Hub");
    });
  });

  it("uses route aggregate values (not first row values) for route mode ordering", () => {
    const routeOneLowFirst = makeRow({
      TypeID: 601,
      TypeName: "Route One Low",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      RealProfit: 10,
      TotalJumps: 2,
      Volume: 1,
      UnitsToBuy: 20,
      ProfitPerUnit: 0.5,
    });
    const routeOneStrongSecond = makeRow({
      TypeID: 602,
      TypeName: "Route One Strong",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      RealProfit: 400,
      TotalJumps: 2,
      Volume: 1,
      UnitsToBuy: 100,
      ProfitPerUnit: 4,
    });
    const routeTwoMid = makeRow({
      TypeID: 603,
      TypeName: "Route Two Mid",
      BuyStation: "Dodixie Hub",
      SellStation: "Rens Hub",
      BuySystemID: 30002659,
      SellSystemID: 30002510,
      RealProfit: 150,
      TotalJumps: 2,
      Volume: 1,
      UnitsToBuy: 20,
      ProfitPerUnit: 7.5,
    });

    renderTable({
      scanning: false,
      results: [routeTwoMid, routeOneLowFirst, routeOneStrongSecond],
    });

    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    fireEvent.click(screen.getByRole("button", { name: "Fastest Route" }));

    const routeButtons = groupedRouteButtons();
    expect(routeButtons[0]).toHaveTextContent("Jita Hub → Amarr Hub");
    expect(routeButtons[1]).toHaveTextContent("Dodixie Hub → Rens Hub");
  });

  it("orders route mode lenses by their intended aggregate metrics", async () => {
    vi.mocked(getGankCheckBatch).mockResolvedValue([
      { key: "30000142:30002187", danger: "yellow", kills: 2, totalISK: 1_000_000 },
      { key: "30002659:30002510", danger: "green", kills: 0, totalISK: 0 },
      { key: "30002053:30002537", danger: "red", kills: 5, totalISK: 2_000_000 },
    ]);

    const alpha = makeRow({
      TypeID: 701,
      TypeName: "Alpha",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      RealProfit: 200,
      DailyProfit: 150,
      TotalJumps: 2,
      Volume: 4,
      UnitsToBuy: 100,
      ProfitPerUnit: 2,
      BuyPrice: 10,
    });
    const beta = makeRow({
      TypeID: 702,
      TypeName: "Beta",
      BuyStation: "Dodixie Hub",
      SellStation: "Rens Hub",
      BuySystemID: 30002659,
      SellSystemID: 30002510,
      RealProfit: 120,
      DailyProfit: 80,
      TotalJumps: 1,
      Volume: 1,
      UnitsToBuy: 20,
      ProfitPerUnit: 6,
      BuyPrice: 200,
    });
    const gamma = makeRow({
      TypeID: 703,
      TypeName: "Gamma",
      BuyStation: "Hek Hub",
      SellStation: "Jita Hub",
      BuySystemID: 30002053,
      SellSystemID: 30002537,
      RealProfit: 50,
      DailyProfit: 20,
      TotalJumps: 1,
      Volume: 3,
      UnitsToBuy: 10,
      ProfitPerUnit: 5,
      BuyPrice: 500,
    });

    renderTable({ scanning: false, results: [gamma, beta, alpha] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));

    fireEvent.click(screen.getByRole("button", { name: "Best Route Pack" }));
    let routeButtons = groupedRouteButtons();
    expect(routeButtons[0]).toHaveTextContent("Dodixie Hub → Rens Hub");

    fireEvent.click(screen.getByRole("button", { name: "Fastest Route" }));
    routeButtons = groupedRouteButtons();
    expect(routeButtons[0]).toHaveTextContent("Dodixie Hub → Rens Hub");

    fireEvent.click(screen.getByRole("button", { name: "Safest Route" }));
    await waitFor(() => {
      const safest = groupedRouteButtons();
      expect(safest[0]).toHaveTextContent("Dodixie Hub → Rens Hub");
    });

    fireEvent.click(screen.getByRole("button", { name: "Best Cargo Use" }));
    routeButtons = groupedRouteButtons();
    expect(routeButtons[0]).toHaveTextContent("Dodixie Hub → Rens Hub");

    fireEvent.click(screen.getByRole("button", { name: "Lowest Capital Lock-up" }));
    routeButtons = groupedRouteButtons();
    expect(routeButtons[0]).toHaveTextContent("Dodixie Hub → Rens Hub");
  });

  it("keeps route tie ordering stable and deterministic", () => {
    const routeA = makeRow({
      TypeID: 801,
      TypeName: "A",
      BuyStation: "AAA",
      SellStation: "ZZZ",
      BuySystemID: 30001001,
      SellSystemID: 30001002,
      RealProfit: 100,
      DailyProfit: 50,
      TotalJumps: 2,
      UnitsToBuy: 20,
      Volume: 1,
    });
    const routeB = makeRow({
      TypeID: 802,
      TypeName: "B",
      BuyStation: "BBB",
      SellStation: "YYY",
      BuySystemID: 30001003,
      SellSystemID: 30001004,
      RealProfit: 100,
      DailyProfit: 50,
      TotalJumps: 2,
      UnitsToBuy: 20,
      Volume: 1,
    });

    renderTable({ scanning: false, results: [routeB, routeA] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    fireEvent.click(screen.getByRole("button", { name: "Fastest Route" }));
    const first = groupedRouteButtons().map((node) => node.textContent);

    fireEvent.click(screen.getByRole("button", { name: "Fastest Route" }));
    fireEvent.click(screen.getByRole("button", { name: "Fastest Route" }));
    const second = groupedRouteButtons().map((node) => node.textContent);
    expect(second).toEqual(first);
  });

  it("reduces route confidence score as exit overhang grows (invariant)", () => {
    const baseline = calcRouteConfidence({
      routeSafetyRank: 1,
      dailyIskPerJump: 100,
      dailyProfit: 1000,
      iskPerM3PerJump: 5,
      fastestIskPerJump: 100,
      weakestExecutionQuality: 90,
      riskSpikeCount: 0,
      riskNoHistoryCount: 0,
      riskUnstableHistoryCount: 0,
      riskThinFillCount: 0,
      riskTotalCount: 0,
      turnoverDays: 5,
      exitOverhangDays: 5,
      breakevenBuffer: 10,
      dailyProfitOverCapital: 10,
      routeTotalProfit: 10_000,
      routeTotalCapital: 100_000,
      weightedSlippagePct: 1,
    });
    const highOverhang = calcRouteConfidence({
      routeSafetyRank: 1,
      dailyIskPerJump: 100,
      dailyProfit: 1000,
      iskPerM3PerJump: 5,
      fastestIskPerJump: 100,
      weakestExecutionQuality: 90,
      riskSpikeCount: 0,
      riskNoHistoryCount: 0,
      riskUnstableHistoryCount: 0,
      riskThinFillCount: 0,
      riskTotalCount: 0,
      turnoverDays: 5,
      exitOverhangDays: 60,
      breakevenBuffer: 10,
      dailyProfitOverCapital: 10,
      routeTotalProfit: 10_000,
      routeTotalCapital: 100_000,
      weightedSlippagePct: 1,
    });
    expect(highOverhang.score).toBeLessThan(baseline.score);
  });

  it("renders compact collapsed route header metrics from route aggregate metadata", async () => {
    const row = makeRow({
      TypeID: 8801,
      TypeName: "Header route row",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      TotalJumps: 2,
      UnitsToBuy: 50,
      FilledQty: 30,
      Volume: 2,
      RealProfit: 400,
      DailyProfit: 150,
      SlippageBuyPct: 3,
      SlippageSellPct: 2,
    });
    renderTable({ scanning: false, results: [row] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    const routeButton = groupedRouteButtons()[0];
    expect(routeButton.textContent).toContain("P ");
    expect(routeButton.textContent).toContain("C ");
    expect(routeButton.textContent).toContain("V ");
    expect(routeButton.textContent).toContain("Cap ");
    expect(routeButton.textContent).toContain("D/J ");
    expect(routeButton.textContent).toContain("m³/J ");
    expect(routeButton.textContent).toContain("EQ min");
    expect(routeButton.textContent).toContain("Safety ");
    expect(routeButton.textContent).toContain("Slip ");
  });

  it("renders both route aggregate score and best/avg row score in route mode", () => {
    const routeRowHigh = makeRow({
      TypeID: 8810,
      TypeName: "Route score high row",
      BuyStation: "Perimeter Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000144,
      SellSystemID: 30002187,
      TotalJumps: 1,
      UnitsToBuy: 200,
      FilledQty: 190,
      Volume: 1,
      RealProfit: 900,
      DailyProfit: 600,
      SlippageBuyPct: 0.4,
      SlippageSellPct: 0.4,
    });
    const routeRowWeak = makeRow({
      TypeID: 8811,
      TypeName: "Route score weak row",
      BuyStation: routeRowHigh.BuyStation,
      SellStation: routeRowHigh.SellStation,
      BuySystemID: routeRowHigh.BuySystemID,
      SellSystemID: routeRowHigh.SellSystemID,
      TotalJumps: 1,
      UnitsToBuy: 8,
      FilledQty: 2,
      Volume: 15,
      RealProfit: 15,
      DailyProfit: 5,
      SlippageBuyPct: 25,
      SlippageSellPct: 25,
    });
    renderTable({ scanning: false, results: [routeRowHigh, routeRowWeak] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    const routeButton = groupedRouteButtons()[0];
    expect(routeButton).toHaveTextContent(/Route Score \d+\.\d/);
    expect(routeButton).toHaveTextContent(/Row Score B\/A \d+\.\d\/\d+\.\d/);

    const routeScoreMatch = routeButton.textContent?.match(/Route Score (\d+\.\d)/);
    const rowScoreMatch = routeButton.textContent?.match(/Row Score B\/A (\d+\.\d)\/(\d+\.\d)/);
    expect(routeScoreMatch).not.toBeNull();
    expect(rowScoreMatch).not.toBeNull();
    expect(routeScoreMatch?.[1]).not.toEqual(rowScoreMatch?.[1]);
  });

  it("formats route score chips deterministically with one decimal", () => {
    const row = makeRow({
      TypeID: 8812,
      TypeName: "Formatted route score row",
      BuyStation: "Dodixie Hub",
      SellStation: "Jita Hub",
      BuySystemID: 30002659,
      SellSystemID: 30000142,
      TotalJumps: 3,
      UnitsToBuy: 41,
      FilledQty: 26,
      Volume: 2,
      RealProfit: 260,
      DailyProfit: 95,
      SlippageBuyPct: 2.3,
      SlippageSellPct: 1.1,
    });
    renderTable({ scanning: false, results: [row] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    const routeButton = groupedRouteButtons()[0];
    expect(routeButton).toHaveTextContent(/Route Score \d+\.\d/);
    expect(routeButton).toHaveTextContent(/Row Score B\/A \d+\.\d\/\d+\.\d/);
  });

  it("keeps route-mode sort behavior based on route aggregates, not displayed row score summary", () => {
    const highRowScoreLowAggregate = makeRow({
      TypeID: 8813,
      TypeName: "High row score low aggregate",
      BuyStation: "Route Alpha Buy",
      SellStation: "Route Alpha Sell",
      BuySystemID: 30003001,
      SellSystemID: 30003002,
      TotalJumps: 1,
      UnitsToBuy: 10,
      FilledQty: 10,
      Volume: 1,
      RealProfit: 80,
      DailyProfit: 60,
      SlippageBuyPct: 0.2,
      SlippageSellPct: 0.2,
    });
    const lowRowScoreHighAggregate = makeRow({
      TypeID: 8814,
      TypeName: "Low row score high aggregate",
      BuyStation: "Route Beta Buy",
      SellStation: "Route Beta Sell",
      BuySystemID: 30003011,
      SellSystemID: 30003012,
      TotalJumps: 1,
      UnitsToBuy: 900,
      FilledQty: 300,
      Volume: 20,
      RealProfit: 2_000,
      DailyProfit: 1_000,
      SlippageBuyPct: 18,
      SlippageSellPct: 18,
    });
    renderTable({
      scanning: false,
      results: [highRowScoreLowAggregate, lowRowScoreHighAggregate],
    });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    fireEvent.click(screen.getByRole("button", { name: "Fastest Route" }));
    const routeButtons = groupedRouteButtons();
    expect(routeButtons[0]).toHaveTextContent(
      `${lowRowScoreHighAggregate.BuyStation} → ${lowRowScoreHighAggregate.SellStation}`,
    );
  });

  it("shows and hides warning badges on collapsed route header using configured thresholds", () => {
    const risky = makeRow({
      TypeID: 8802,
      TypeName: "Risky route row",
      BuyStation: "Hek Hub",
      SellStation: "Dodixie Hub",
      BuySystemID: 30002053,
      SellSystemID: 30002659,
      UnitsToBuy: 20,
      FilledQty: 5, // thin fill
      DayNowProfit: 5,
      DayPeriodProfit: -1, // spike
      DayTargetPeriodPrice: 100,
      DayTargetNowPrice: 150, // unstable history
    });
    renderTable({ scanning: false, results: [risky] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    expect(screen.getByText(/SPIKE 1/)).toBeInTheDocument();
    expect(screen.getByText(/UNSTABLE 1/)).toBeInTheDocument();
    expect(screen.getByText(/THIN 1/)).toBeInTheDocument();
    expect(screen.queryByText(/NO HIST 1/)).not.toBeInTheDocument();
  });

  it("renders route-header badges before route label text in the left segment", () => {
    const risky = makeRow({
      TypeID: 8892,
      TypeName: "Route header ordering row",
      BuyStation: "Order Buy",
      SellStation: "Order Sell",
      BuySystemID: 30112053,
      SellSystemID: 30112659,
      UnitsToBuy: 20,
      FilledQty: 5,
      DayNowProfit: 5,
      DayPeriodProfit: -1,
      DayTargetPeriodPrice: 100,
      DayTargetNowPrice: 150,
    });
    const { container } = renderTable({ scanning: false, results: [risky] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    const leftSegment = container.querySelector(
      "[data-route-group] [data-testid^='route-header-left:']",
    ) as HTMLElement | null;
    expect(leftSegment).not.toBeNull();
    const leftText = leftSegment?.textContent ?? "";
    expect(leftText.indexOf("SPIKE")).toBeGreaterThan(-1);
    const confidenceLabel =
      leftText.includes("High")
        ? "High"
        : leftText.includes("Medium")
          ? "Medium"
          : "Low";
    expect(leftText.indexOf(confidenceLabel)).toBeGreaterThan(-1);
    expect(leftText.indexOf("Order Buy → Order Sell")).toBeGreaterThan(-1);
    expect(leftText.indexOf("SPIKE")).toBeLessThan(
      leftText.indexOf("Order Buy → Order Sell"),
    );
    expect(leftText.indexOf(confidenceLabel)).toBeLessThan(
      leftText.indexOf("Order Buy → Order Sell"),
    );
  });

  it("applies route badge filters and reset in route mode", async () => {
    const high = makeRow({
      TypeID: 9901,
      TypeName: "Filter High",
      BuyStation: "High Buy",
      SellStation: "High Sell",
      BuySystemID: 30010142,
      SellSystemID: 30012187,
      RealProfit: 300,
      DailyProfit: 180,
      UnitsToBuy: 20,
      FilledQty: 20,
      SlippageBuyPct: 0.2,
      SlippageSellPct: 0.2,
      DayTargetPeriodPrice: 120,
      DayTargetNowPrice: 121,
    });
    const risky = makeRow({
      TypeID: 9902,
      TypeName: "Filter Spike/Thin/Unstable",
      BuyStation: "Risk Buy",
      SellStation: "Risk Sell",
      BuySystemID: 30012053,
      SellSystemID: 30012659,
      UnitsToBuy: 20,
      FilledQty: 5,
      DayNowProfit: 5,
      DayPeriodProfit: -1,
      DayTargetPeriodPrice: 100,
      DayTargetNowPrice: 150,
    });
    const noHistory = makeRow({
      TypeID: 9903,
      TypeName: "Filter No History",
      BuyStation: "NoHist Buy",
      SellStation: "NoHist Sell",
      BuySystemID: 30013053,
      SellSystemID: 30013659,
      UnitsToBuy: 15,
      FilledQty: 15,
      DayTargetPeriodPrice: 0,
      DayTargetNowPrice: 0,
    });

    renderTable({ scanning: false, results: [high, risky, noHistory] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    await waitFor(() => expect(groupedRouteButtons()).toHaveLength(3));
    for (const label of [
      "Clean",
      "Moderate",
      "Busy",
      "SPIKE",
      "NO HIST",
      "UNSTABLE",
      "THIN",
      "High",
      "Medium",
      "Low",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    fireEvent.click(
      screen.getByTitle("Show routes that have at least one SPIKE warning badge."),
    );
    expect(groupedRouteButtons()).toHaveLength(1);
    expect(groupedRouteButtons()[0]).toHaveTextContent("Risk Buy → Risk Sell");

    fireEvent.click(
      screen.getByTitle("Show routes with a High confidence badge."),
    );
    const labelsOr = groupedRouteButtons().map((node) => node.textContent ?? "");
    expect(labelsOr.some((text) => text.includes("Risk Buy → Risk Sell"))).toBe(true);
    expect(labelsOr.some((text) => text.includes("High Buy → High Sell"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(groupedRouteButtons()).toHaveLength(3));
    expect(screen.getAllByText(/NoHist Buy → NoHist Sell/).length).toBeGreaterThan(0);
  });

  it("uses OR behavior for multi-select route badge filters", async () => {
    const high = makeRow({
      TypeID: 9911,
      TypeName: "OR High",
      BuyStation: "OR High Buy",
      SellStation: "OR High Sell",
      BuySystemID: 30020142,
      SellSystemID: 30022187,
      RealProfit: 300,
      DailyProfit: 180,
      UnitsToBuy: 20,
      FilledQty: 20,
      SlippageBuyPct: 0.2,
      SlippageSellPct: 0.2,
      DayTargetPeriodPrice: 120,
      DayTargetNowPrice: 121,
    });
    const spike = makeRow({
      TypeID: 9912,
      TypeName: "OR Spike",
      BuyStation: "OR Spike Buy",
      SellStation: "OR Spike Sell",
      BuySystemID: 30022053,
      SellSystemID: 30022659,
      UnitsToBuy: 20,
      FilledQty: 5,
      DayNowProfit: 5,
      DayPeriodProfit: -1,
      DayTargetPeriodPrice: 100,
      DayTargetNowPrice: 150,
    });
    renderTable({ scanning: false, results: [high, spike] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    await waitFor(() => expect(groupedRouteButtons()).toHaveLength(2));

    fireEvent.click(
      screen.getByTitle("Show routes that have at least one SPIKE warning badge."),
    );
    fireEvent.click(
      screen.getByTitle("Show routes with a High confidence badge."),
    );
    const labels = groupedRouteButtons().map((node) => node.textContent ?? "");
    expect(labels).toHaveLength(2);
    expect(labels.some((text) => text.includes("OR Spike Buy → OR Spike Sell"))).toBe(
      true,
    );
    expect(labels.some((text) => text.includes("OR High Buy → OR High Sell"))).toBe(
      true,
    );
  });

  it("uses the corrected Weighted Slippage % label for route-pack slippage column", () => {
    renderTable({ scanning: false, results: [makeRow()] });
    fireEvent.click(screen.getByTitle("Column setup"));
    expect(screen.getAllByText("Weighted Slippage %").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Slippage Cost").length).toBeGreaterThan(0);
  });

  it("snapshot: collapsed route row confidence states (high/medium/low)", async () => {
    vi.mocked(getGankCheckBatch).mockResolvedValue([
      { key: "30000142:30002187", danger: "green", kills: 0, totalISK: 0 },
      { key: "30002659:30002510", danger: "yellow", kills: 1, totalISK: 10_000_000 },
      { key: "30002053:30002537", danger: "red", kills: 4, totalISK: 60_000_000 },
    ]);
    const high = makeRow({
      TypeID: 9001,
      TypeName: "High Confidence",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      RealProfit: 300,
      DailyProfit: 180,
      UnitsToBuy: 20,
      FilledQty: 20,
      SlippageBuyPct: 0.2,
      SlippageSellPct: 0.2,
      DayTargetPeriodPrice: 120,
      DayTargetNowPrice: 121,
    });
    const medium = makeRow({
      TypeID: 9002,
      TypeName: "Medium Confidence",
      BuyStation: "Dodixie Hub",
      SellStation: "Rens Hub",
      BuySystemID: 30002659,
      SellSystemID: 30002510,
      RealProfit: 120,
      DailyProfit: 80,
      UnitsToBuy: 30,
      FilledQty: 14,
      SlippageBuyPct: 6,
      SlippageSellPct: 5,
      DayTargetPeriodPrice: 100,
      DayTargetNowPrice: 130,
    });
    const low = makeRow({
      TypeID: 9003,
      TypeName: "Low Confidence",
      BuyStation: "Hek Hub",
      SellStation: "Jita Hub",
      BuySystemID: 30002053,
      SellSystemID: 30002537,
      RealProfit: 30,
      DailyProfit: 10,
      UnitsToBuy: 40,
      FilledQty: 5,
      SlippageBuyPct: 15,
      SlippageSellPct: 12,
      DayNowProfit: 1,
      DayPeriodProfit: -1,
      DayTargetPeriodPrice: 100,
      DayTargetNowPrice: 180,
    });
    renderTable({ scanning: false, results: [high, medium, low] });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    await waitFor(() => {
      expect(groupedRouteButtons()).toHaveLength(3);
    });
    const routes = groupedRouteButtons();
    const byRouteLabel = new Map(routes.map((node) => [node.textContent ?? "", node]));
    const highBadgeRoute = [...byRouteLabel.entries()].find(([text]) =>
      text.includes("Jita Hub → Amarr Hub"),
    )?.[1];
    const mediumBadgeRoute = [...byRouteLabel.entries()].find(([text]) =>
      text.includes("Dodixie Hub → Rens Hub"),
    )?.[1];
    const lowBadgeRoute = [...byRouteLabel.entries()].find(([text]) =>
      text.includes("Hek Hub → Jita Hub"),
    )?.[1];
    expect(highBadgeRoute).toBeDefined();
    expect(mediumBadgeRoute).toBeDefined();
    expect(lowBadgeRoute).toBeDefined();
    await waitFor(() => {
      expect(highBadgeRoute).toHaveTextContent(/High \d+/);
      expect(mediumBadgeRoute).toHaveTextContent(/Medium \d+/);
      expect(lowBadgeRoute).toHaveTextContent(/Low \d+/);
    });
  });

  it("switching rows ↔ route mode changes comparator source", () => {
    const routeAFirstRowWeak = makeRow({
      TypeID: 901,
      TypeName: "RouteA weak row",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      RealProfit: 5,
      TotalJumps: 1,
      UnitsToBuy: 5,
      Volume: 1,
    });
    const routeASecondRowStrong = makeRow({
      TypeID: 902,
      TypeName: "RouteA strong row",
      BuyStation: "Jita Hub",
      SellStation: "Amarr Hub",
      BuySystemID: 30000142,
      SellSystemID: 30002187,
      RealProfit: 500,
      TotalJumps: 1,
      UnitsToBuy: 200,
      Volume: 1,
    });
    const routeB = makeRow({
      TypeID: 903,
      TypeName: "RouteB row",
      BuyStation: "Dodixie Hub",
      SellStation: "Rens Hub",
      BuySystemID: 30002659,
      SellSystemID: 30002510,
      RealProfit: 150,
      TotalJumps: 1,
      UnitsToBuy: 20,
      Volume: 1,
    });

    renderTable({ scanning: false, results: [routeB, routeAFirstRowWeak, routeASecondRowStrong] });

    fireEvent.click(screen.getByRole("button", { name: "Fastest ISK" }));
    const rows = screen.getAllByRole("row");
    expect(rows[2]).toHaveTextContent("RouteA strong row");

    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    fireEvent.click(screen.getByRole("button", { name: "Fastest Route" }));
    const routeButtons = groupedRouteButtons();
    expect(routeButtons[0]).toHaveTextContent("Jita Hub → Amarr Hub");
  });

  it("integration: top route ordering for mixed dataset in route mode", async () => {
    vi.mocked(getGankCheckBatch).mockResolvedValue([
      { key: "30000142:30002187", danger: "yellow", kills: 1, totalISK: 1_000_000 },
      { key: "30002659:30002510", danger: "green", kills: 0, totalISK: 0 },
      { key: "30002053:30002537", danger: "red", kills: 4, totalISK: 3_000_000 },
      { key: "30003068:30000142", danger: "green", kills: 0, totalISK: 0 },
    ]);
    const rows = [
      makeRow({ TypeID: 1001, TypeName: "A1", BuyStation: "Jita Hub", SellStation: "Amarr Hub", BuySystemID: 30000142, SellSystemID: 30002187, RealProfit: 320, DailyProfit: 180, TotalJumps: 2, Volume: 2, UnitsToBuy: 80, ProfitPerUnit: 4 }),
      makeRow({ TypeID: 1002, TypeName: "A2", BuyStation: "Jita Hub", SellStation: "Amarr Hub", BuySystemID: 30000142, SellSystemID: 30002187, RealProfit: 120, DailyProfit: 60, TotalJumps: 2, Volume: 2, UnitsToBuy: 20, ProfitPerUnit: 6 }),
      makeRow({ TypeID: 1003, TypeName: "B1", BuyStation: "Dodixie Hub", SellStation: "Rens Hub", BuySystemID: 30002659, SellSystemID: 30002510, RealProfit: 150, DailyProfit: 100, TotalJumps: 1, Volume: 1, UnitsToBuy: 10, ProfitPerUnit: 15 }),
      makeRow({ TypeID: 1004, TypeName: "C1", BuyStation: "Hek Hub", SellStation: "Jita Hub", BuySystemID: 30002053, SellSystemID: 30002537, RealProfit: 75, DailyProfit: 25, TotalJumps: 1, Volume: 3, UnitsToBuy: 10, ProfitPerUnit: 7.5 }),
      makeRow({ TypeID: 1005, TypeName: "D1", BuyStation: "Plex Outpost", SellStation: "Jita Hub", BuySystemID: 30003068, SellSystemID: 30000142, RealProfit: 180, DailyProfit: 120, TotalJumps: 3, Volume: 1, UnitsToBuy: 30, ProfitPerUnit: 6 }),
    ];
    renderTable({ scanning: false, results: rows });
    fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
    fireEvent.click(screen.getByRole("button", { name: "Best Route Pack" }));
    await waitFor(() => {
      const top3 = groupedRouteButtons().slice(0, 3).map((n) => n.textContent ?? "");
      expect(top3[0]).toContain("Jita Hub → Amarr Hub");
      expect(top3[1]).toContain("Dodixie Hub → Rens Hub");
      expect(top3[2]).toContain("Plex Outpost → Jita Hub");
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

  describe("focused fixture regressions", () => {
    afterEach(() => {
      localStorage.clear();
    });

    it("execution quality uses original desired quantity when partial-fill trim happened", () => {
      const { safeTrimmed } = focusedRouteFixtures();
      const quality = executionQualityForFlip(safeTrimmed);

      expect(
        requestedUnitsForFlip(safeTrimmed),
        "requested units should preserve original desired quantity",
      ).toBe(100);
      expect(
        quality.factors.find((factor) => factor.factor === "fillRatio")?.score,
        "execution quality must score fill ratio against original desired quantity",
      ).toBe(60);
    });

    it("safest lens ordering keeps green ahead of unknown/loading", async () => {
      const { allRows, safeTrimmed, unknownRoute } = focusedRouteFixtures();
      vi.mocked(getGankCheckBatch).mockResolvedValueOnce([
        { key: `${safeTrimmed.BuySystemID}:${safeTrimmed.SellSystemID}`, danger: "green", kills: 0, totalISK: 0 },
        // Intentionally simulate an unexpected backend token to ensure unknown/loading ordering
        // remains safe even if API response drifts.
        { key: `${unknownRoute.BuySystemID}:${unknownRoute.SellSystemID}`, danger: "loading", kills: 0, totalISK: 0 } as never,
      ]);

      renderTable({ scanning: false, results: allRows });
      fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
      fireEvent.click(screen.getByRole("button", { name: "Safest Route" }));

      await waitFor(() => {
        const routeButtons = groupedRouteButtons();
        expect(
          routeButtons[0],
          "unknown must not outrank safe when Safest Route lens is applied",
        ).toHaveTextContent(`${safeTrimmed.BuyStation} → ${safeTrimmed.SellStation}`);
      });

      const orderedRouteLabels = groupedRouteButtons().map((btn) => btn.textContent ?? "");
      const safeIdx = orderedRouteLabels.findIndex((text) =>
        text.includes(`${safeTrimmed.BuyStation} → ${safeTrimmed.SellStation}`),
      );
      const unknownIdx = orderedRouteLabels.findIndex((text) =>
        text.includes(`${unknownRoute.BuyStation} → ${unknownRoute.SellStation}`),
      );
      expect(
        safeIdx,
        "green route should come before unknown/loading route in safest lens",
      ).toBeLessThan(unknownIdx);
    });

    it("route mode sorting uses route aggregates for conflicting row-vs-route signals", () => {
      const {
        unknownRoute,
        conflictingRowSignalWeakTop,
        conflictingRowSignalStrongSecond,
      } = focusedRouteFixtures();
      renderTable({
        scanning: false,
        results: [unknownRoute, conflictingRowSignalWeakTop, conflictingRowSignalStrongSecond],
      });

      fireEvent.click(screen.getByRole("button", { name: "Fastest ISK" }));
      const rowModeRows = screen.getAllByRole("row");
      expect(
        rowModeRows[2],
        "row mode sorts directly by best row metric",
      ).toHaveTextContent("Conflicting Strong Second");

      fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
      fireEvent.click(screen.getByRole("button", { name: "Fastest Route" }));
      const routeButtons = groupedRouteButtons();
      expect(
        routeButtons[0],
        "route mode must sort by route aggregate, not first row values",
      ).toHaveTextContent("R-1003 Buy → R-1003 Sell");
    });

    it("route-pack summary scope remains selected-pack only", () => {
      const selectedOnly = makeRow({
        TypeID: 1501,
        BuyStation: "R-2001 Buy",
        SellStation: "R-2001 Sell",
        BuySystemID: 44000001,
        SellSystemID: 44000002,
        Volume: 30,
        UnitsToBuy: 1,
        ProfitPerUnit: 100,
        ExpectedBuyPrice: 120,
        SlippageBuyPct: 1,
        SlippageSellPct: 1,
        FilledQty: 1,
        PreExecutionUnits: 1,
      });
      const excludedUniverseOnly = makeRow({
        TypeID: 1502,
        BuyStation: selectedOnly.BuyStation,
        SellStation: selectedOnly.SellStation,
        BuySystemID: selectedOnly.BuySystemID,
        SellSystemID: selectedOnly.SellSystemID,
        Volume: 30,
        UnitsToBuy: 1,
        ProfitPerUnit: 400,
        ExpectedBuyPrice: 100,
        SlippageBuyPct: 30,
        SlippageSellPct: 30,
        FilledQty: 0,
        PreExecutionUnits: 1,
      });

      render(
        <I18nProvider>
          <ToastProvider>
            <ScanResultsTable
              results={[selectedOnly, excludedUniverseOnly]}
              scanning={false}
              progress=""
              tradeStateTab="radius"
              cargoLimit={35}
            />
          </ToastProvider>
        </I18nProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
      const routeSummary = groupedRouteButtons()[0];
      expect(routeSummary).toHaveTextContent("1 items");
      expect(routeSummary).toHaveTextContent("P 100");
      expect(routeSummary).toHaveTextContent("C 120");
    });

    it("slippage percent and slippage ISK stay distinct and correctly labeled", () => {
      renderTable({ scanning: false, results: [makeRow({ SlippageBuyPct: 6, SlippageSellPct: 4, FilledQty: 10 })] });
      fireEvent.click(screen.getByTitle("Column setup"));
      expect(screen.getAllByText("Weighted Slippage %").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Slippage Cost").length).toBeGreaterThan(0);
    });

    it("end-to-end: route mode + selected lens yields expected route order and top-card metrics", async () => {
      const { allRows, safeTrimmed, conflictingRowSignalWeakTop } = focusedRouteFixtures();
      vi.mocked(getGankCheckBatch).mockResolvedValue([
        { key: `${safeTrimmed.BuySystemID}:${safeTrimmed.SellSystemID}`, danger: "green", kills: 0, totalISK: 0 },
        {
          key: "42000001:42000002",
          danger: "loading",
          kills: 0,
          totalISK: 0,
        } as never,
        {
          key: `${conflictingRowSignalWeakTop.BuySystemID}:${conflictingRowSignalWeakTop.SellSystemID}`,
          danger: "yellow",
          kills: 1,
          totalISK: 1_000_000,
        },
      ]);

      renderTable({ scanning: false, results: allRows });
      fireEvent.click(screen.getByRole("button", { name: "Group by route" }));
      fireEvent.click(screen.getByRole("button", { name: "Safest Route" }));

      await waitFor(() => {
        const routeButtons = groupedRouteButtons();
        expect(routeButtons[0]).toHaveTextContent("R-1001 Buy → R-1001 Sell");
        expect(routeButtons[0]).toHaveTextContent("P ");
        expect(routeButtons[0]).toHaveTextContent("C ");
        expect(routeButtons[0]).toHaveTextContent("V ");
        expect(routeButtons[0]).toHaveTextContent("D/J ");
        expect(routeButtons[0]).toHaveTextContent("m³/J ");
        expect(routeButtons[0]).toHaveTextContent("EQ min");
        expect(routeButtons[0]).toHaveTextContent("Slip ");
      });
    });

    it("renders top picks panel and supports one-click jump-to-group", async () => {
      const rowA = makeRow({
        TypeID: 8001,
        BuyStation: "TopPick A Buy",
        SellStation: "TopPick A Sell",
        BuySystemID: 500001,
        SellSystemID: 500002,
        DailyProfit: 400,
        RealProfit: 700,
        TotalJumps: 2,
        UnitsToBuy: 120,
        FilledQty: 100,
      });
      const rowB = makeRow({
        TypeID: 8002,
        BuyStation: "TopPick B Buy",
        SellStation: "TopPick B Sell",
        BuySystemID: 500011,
        SellSystemID: 500012,
        DailyProfit: 900,
        RealProfit: 1000,
        TotalJumps: 1,
        UnitsToBuy: 150,
        FilledQty: 110,
      });

      renderTable({ scanning: false, results: [rowA, rowB] });

      expect(await screen.findByText("Best Recommended Route Pack")).toBeInTheDocument();
      expect(screen.getByText("Action Queue")).toBeInTheDocument();
      const jumpButtons = screen.getAllByRole("button", {
        name: "Jump to group",
      });
      expect(jumpButtons.length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          /baseline_rank|high_confidence|risk_or_confidence_guard|endpoint_rules_applied|endpoint_hub_penalty/i,
        ).length,
      ).toBeGreaterThan(0);

      fireEvent.click(jumpButtons[0]);

      await waitFor(() => {
        expect(groupedRouteButtons().length).toBeGreaterThan(0);
      });
    });

    it("shows Top Picks by default when candidates exist", async () => {
      const rowA = makeRow({
        TypeID: 8101,
        BuyStation: "Default TopPick Buy A",
        SellStation: "Default TopPick Sell A",
        BuySystemID: 510001,
        SellSystemID: 510002,
        DailyProfit: 200,
        RealProfit: 300,
      });
      const rowB = makeRow({
        TypeID: 8102,
        BuyStation: "Default TopPick Buy B",
        SellStation: "Default TopPick Sell B",
        BuySystemID: 510011,
        SellSystemID: 510012,
        DailyProfit: 320,
        RealProfit: 410,
      });

      renderTable({ scanning: false, results: [rowA, rowB] });

      expect(await screen.findByText("Best Recommended Route Pack")).toBeInTheDocument();
    });

    it("hides top picks panel when the toolbar toggle is disabled", async () => {
      const rowA = makeRow({
        TypeID: 8201,
        BuyStation: "Toggle TopPick Buy A",
        SellStation: "Toggle TopPick Sell A",
        BuySystemID: 520001,
        SellSystemID: 520002,
      });
      const rowB = makeRow({
        TypeID: 8202,
        BuyStation: "Toggle TopPick Buy B",
        SellStation: "Toggle TopPick Sell B",
        BuySystemID: 520011,
        SellSystemID: 520012,
      });

      renderTable({ scanning: false, results: [rowA, rowB] });
      expect(await screen.findByText("Best Recommended Route Pack")).toBeInTheDocument();

      const toggle = screen.getByRole("button", { name: "Top Picks" });
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByText("Best Recommended Route Pack")).not.toBeInTheDocument();
    });

    it("restores persisted top picks visibility on rerender from localStorage", async () => {
      localStorage.setItem(TOP_PICKS_VISIBLE_STORAGE_KEY, "0");
      const rowA = makeRow({
        TypeID: 8301,
        BuyStation: "Persist TopPick Buy A",
        SellStation: "Persist TopPick Sell A",
        BuySystemID: 530001,
        SellSystemID: 530002,
      });
      const rowB = makeRow({
        TypeID: 8302,
        BuyStation: "Persist TopPick Buy B",
        SellStation: "Persist TopPick Sell B",
        BuySystemID: 530011,
        SellSystemID: 530012,
      });

      const { unmount } = renderTable({ scanning: false, results: [rowA, rowB] });

      const hiddenToggle = screen.getByRole("button", { name: "Top Picks" });
      expect(hiddenToggle).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByText("Best Recommended Route Pack")).not.toBeInTheDocument();

      fireEvent.click(hiddenToggle);
      expect(localStorage.getItem(TOP_PICKS_VISIBLE_STORAGE_KEY)).toBe("1");
      unmount();

      renderTable({ scanning: false, results: [rowA, rowB] });
      const shownToggle = await screen.findByRole("button", { name: "Top Picks" });
      expect(shownToggle).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Best Recommended Route Pack")).toBeInTheDocument();
    });

    it("keeps top picks panel hidden when there are no route candidates", () => {
      renderTable({ scanning: false, results: [] });

      expect(screen.queryByText("Best Recommended Route Pack")).not.toBeInTheDocument();
    });
  });
});

describe("ScanResultsTable column hint tooltips", () => {
  it("uses expanded descriptive tooltip text for representative RADIUS columns", async () => {
    renderTable({ scanning: false, results: [makeRow()] });

    const realIskHeader = (await screen.findAllByText("Real ISK/Jump"))[0];
    const realIskTitle = realIskHeader.closest("th")?.getAttribute("title") ?? "";
    expect(realIskTitle).toContain("Why it matters:");
    expect(realIskTitle).toContain("Good vs risky:");

    const slippageHeader = screen.getAllByText("Slippage Cost")[0];
    const slippageTitle = slippageHeader.closest("th")?.getAttribute("title") ?? "";
    expect(slippageTitle).toContain("Why it matters:");
    expect(slippageTitle).toContain("Good vs risky:");
  });
});
