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

const COMPACT_DASHBOARD_STORAGE_KEY = "eve-radius-compact-dashboard:v1";

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

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ScanResultsTable compact dashboard", () => {
  it("toggles compact dashboard and updates dashboard spacing + helper visibility", () => {
    renderTable([makeRow()]);

    expect(
      screen.getByText(
        "Use Advanced for endpoint preferences, tracked visibility, and cache controls.",
      ),
    ).toBeInTheDocument();
    const insightsCard = screen.getByText("Insights").closest("section");
    expect(insightsCard?.className).toContain("p-2");

    fireEvent.click(screen.getByRole("button", { name: /compact dashboard/i }));

    expect(
      screen.queryByText(
        "Use Advanced for endpoint preferences, tracked visibility, and cache controls.",
      ),
    ).not.toBeInTheDocument();
    expect(insightsCard?.className).toContain("p-1.5");
  });

  it("persists compact dashboard preference and restores it on reload", () => {
    const firstRender = renderTable([makeRow()]);

    fireEvent.click(screen.getByRole("button", { name: /compact dashboard/i }));
    expect(localStorage.getItem(COMPACT_DASHBOARD_STORAGE_KEY)).toBe("1");

    firstRender.unmount();
    renderTable([makeRow()]);

    expect(screen.getByRole("button", { name: /compact dashboard/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.queryByText(
        "Use Advanced for endpoint preferences, tracked visibility, and cache controls.",
      ),
    ).not.toBeInTheDocument();
  });

  it("allows compact rows and compact dashboard to be toggled independently", () => {
    renderTable([makeRow()]);

    const compactDashboardBtn = screen.getByRole("button", {
      name: /compact dashboard/i,
    });
    const compactRowsBtn = screen.getByTitle("Compact rows");

    fireEvent.click(compactDashboardBtn);
    expect(compactDashboardBtn).toHaveAttribute("aria-pressed", "true");
    expect(compactRowsBtn).toHaveAttribute("title", "Compact rows");

    fireEvent.click(compactRowsBtn);
    expect(compactRowsBtn).toHaveAttribute("title", "Comfy rows");
    expect(compactDashboardBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("suppresses helper text only in compact dashboard mode", () => {
    renderTable([makeRow()]);
    const helperText =
      "Use Advanced for endpoint preferences, tracked visibility, and cache controls.";

    expect(screen.getByText(helperText)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Compact rows"));
    expect(screen.getByText(helperText)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /compact dashboard/i }));
    expect(screen.queryByText(helperText)).not.toBeInTheDocument();
  });
});
