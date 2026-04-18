import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";
import { rebootStationCache } from "@/lib/api";

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
  rebootStationCache: vi.fn(async () => ({ cleared: 1 })),
  removeFromWatchlist: vi.fn(async () => undefined),
  removePinnedOpportunity: vi.fn(async () => ({ status: "deleted" })),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
  setStationTradeState: vi.fn(async () => undefined),
  setWaypointInGame: vi.fn(async () => undefined),
}));

const ADVANCED_TOOLBAR_VISIBLE_STORAGE_KEY =
  "eve-radius-advanced-toolbar-visible:v1";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 101,
    TypeName: "Item 101",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyLocationID: 60003760,
    SellPrice: 125,
    SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    SellLocationID: 60008494,
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

function renderTable(results: FlipResult[]) {
  localStorage.setItem(ADVANCED_TOOLBAR_VISIBLE_STORAGE_KEY, "1");
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ScanResultsTable toolbar popovers", () => {
  it("opens each compact trigger panel and shows expected controls", () => {
    renderTable([makeRow()]);

    fireEvent.click(screen.getByRole("button", { name: /endpoint prefs ▸/i }));
    const endpointPanel = screen.getByRole("dialog", {
      name: /endpoint preferences/i,
    });
    expect(endpointPanel).toBeInTheDocument();
    expect(within(endpointPanel).getByDisplayValue("Rank-only")).toBeInTheDocument();
    expect(within(endpointPanel).getByTitle("Quick profile preset")).toBeInTheDocument();
    expect(within(endpointPanel).getByTitle("Buy endpoint type selector")).toBeInTheDocument();
    expect(within(endpointPanel).getByTitle("Sell endpoint type selector")).toBeInTheDocument();
    expect(within(endpointPanel).getByPlaceholderText(/major hubs/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tracked ▸/i }));
    const trackedPanel = screen.getByRole("dialog", { name: /tracked preferences/i });
    expect(within(trackedPanel).getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(within(trackedPanel).getByLabelText("Tracked first")).toBeInTheDocument();
    expect(within(trackedPanel).getByLabelText("Tracked chip")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cache.*▸/i }));
    const cachePanel = screen.getByRole("dialog", { name: /cache controls/i });
    expect(within(cachePanel).getAllByRole("button").length).toBeGreaterThanOrEqual(2);
  });

  it("closes popovers on outside click and Escape", () => {
    renderTable([makeRow()]);

    fireEvent.click(screen.getByRole("button", { name: /endpoint prefs ▸/i }));
    expect(
      screen.getByRole("dialog", { name: /endpoint preferences/i }),
    ).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByRole("dialog", { name: /endpoint preferences/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tracked ▸/i }));
    expect(screen.getByRole("dialog", { name: /tracked preferences/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: /tracked preferences/i }),
    ).not.toBeInTheDocument();
  });

  it("preset UI updates both soft and hard settings", () => {
    renderTable([makeRow()]);

    expect(screen.getByText("Item 101")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tracked ▸/i }));
    fireEvent.click(screen.getByRole("button", { name: "Tracked only" }));
    expect(screen.queryByText("Item 101")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /endpoint prefs ▸/i }));
    const endpointPanel = screen.getByRole("dialog", {
      name: /endpoint preferences/i,
    });
    const modeSelect = within(endpointPanel).getByDisplayValue("Rank-only");
    fireEvent.change(modeSelect, { target: { value: "hide" } });
    expect(within(endpointPanel).getByDisplayValue("Hide non-matching")).toBeInTheDocument();

    const presetSelect = within(endpointPanel).getByTitle("Quick profile preset");
    fireEvent.change(presetSelect, { target: { value: "structure_exit" } });
    expect(within(endpointPanel).getByDisplayValue("Structure Exit")).toBeInTheDocument();

    const storedPrefs = JSON.parse(
      localStorage.getItem("eve-radius-endpoint-preferences:v1") ?? "{}",
    ) as { profile?: { sellStructureBonus?: number; requireSellStructure?: boolean } };
    expect(storedPrefs.profile?.sellStructureBonus).toBe(16);
    expect(storedPrefs.profile?.requireSellStructure).toBe(true);
  });

  it("structure-only setting removes NPC sell results when hide mode is active", () => {
    renderTable([
      makeRow({
        TypeID: 201,
        TypeName: "NPC Sell Result",
        SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
        SellLocationID: 60008494,
      }),
      makeRow({
        TypeID: 202,
        TypeName: "Structure Sell Result",
        SellStation: "Perimeter Keepstar Freeport",
        SellLocationID: 1_000_000_000_005,
        SellSystemName: "Perimeter",
      }),
    ]);

    expect(screen.getByText("NPC Sell Result")).toBeInTheDocument();
    expect(screen.getByText("Structure Sell Result")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /endpoint prefs ▸/i }));
    const endpointPanel = screen.getByRole("dialog", {
      name: /endpoint preferences/i,
    });
    fireEvent.change(within(endpointPanel).getByDisplayValue("Rank-only"), {
      target: { value: "hide" },
    });
    fireEvent.change(within(endpointPanel).getByTitle("Sell endpoint type selector"), {
      target: { value: "structure" },
    });

    expect(screen.queryByText("NPC Sell Result")).not.toBeInTheDocument();
    expect(screen.getByText("Structure Sell Result")).toBeInTheDocument();
  });

  it("supports Disabled mode and Neutral preset in endpoint controls", () => {
    renderTable([
      makeRow({ TypeID: 301, TypeName: "Hub Buy", BuySystemName: "Jita" }),
      makeRow({ TypeID: 302, TypeName: "Non-Hub Buy", BuySystemName: "Perimeter" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /endpoint prefs ▸/i }));
    const endpointPanel = screen.getByRole("dialog", {
      name: /endpoint preferences/i,
    });

    const modeSelect = within(endpointPanel).getByDisplayValue("Rank-only");
    fireEvent.change(modeSelect, { target: { value: "disabled" } });
    expect(within(endpointPanel).getByDisplayValue("Disabled")).toBeInTheDocument();

    const presetSelect = within(endpointPanel).getByTitle("Quick profile preset");
    fireEvent.change(presetSelect, { target: { value: "neutral" } });
    expect(within(endpointPanel).getByDisplayValue("Neutral")).toBeInTheDocument();
  });

  it("disabled mode removes endpoint ordering/filtering influence metadata", () => {
    renderTable([
      makeRow({
        TypeID: 401,
        TypeName: "Hub constrained",
        BuySystemName: "Jita",
        BuyLocationID: 60003760,
        SellLocationID: 60008494,
      }),
      makeRow({
        TypeID: 402,
        TypeName: "Structure sell",
        BuySystemName: "Perimeter",
        SellLocationID: 1_000_000_000_123,
        SellStation: "Perimeter Keepstar",
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /endpoint prefs ▸/i }));
    const endpointPanel = screen.getByRole("dialog", {
      name: /endpoint preferences/i,
    });

    fireEvent.change(within(endpointPanel).getByDisplayValue("Rank-only"), {
      target: { value: "hide" },
    });
    fireEvent.change(within(endpointPanel).getByTitle("Sell endpoint type selector"), {
      target: { value: "structure" },
    });

    expect(screen.queryByText("Hub constrained")).not.toBeInTheDocument();
    expect(screen.getByText("Structure sell")).toBeInTheDocument();

    fireEvent.change(within(endpointPanel).getByDisplayValue("Hide non-matching"), {
      target: { value: "disabled" },
    });

    expect(screen.getByText("Hub constrained")).toBeInTheDocument();
    const endpointRows = document.querySelectorAll("tr[data-endpoint-score-delta]");
    expect(endpointRows.length).toBeGreaterThan(0);
    endpointRows.forEach((row) => {
      expect(row.getAttribute("data-endpoint-score-delta")).toBe("0");
      expect(row.getAttribute("data-endpoint-excluded-reasons")).toBe("");
      expect(row.getAttribute("data-applied-rules")).toBe("");
    });
  });


  it("keeps cache actions callable from compact cache entry point", () => {
    renderTable([makeRow()]);

    fireEvent.click(screen.getByRole("button", { name: /cache.*▸/i }));
    const cachePanel = screen.getByRole("dialog", { name: /cache controls/i });
    const [rebootBtn, hiddenBtn] = within(cachePanel).getAllByRole("button");

    fireEvent.click(rebootBtn);
    expect(rebootStationCache).toHaveBeenCalledTimes(1);

    fireEvent.click(hiddenBtn);
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });
});
