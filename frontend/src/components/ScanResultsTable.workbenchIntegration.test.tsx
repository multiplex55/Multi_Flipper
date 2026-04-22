import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

function renderTable(onRouteHandoff?: (...args: unknown[]) => void) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable
          results={[makeRow(), makeRow({ TypeID: 1002, TypeName: "Second" })]}
          scanning={false}
          progress=""
          tradeStateTab="radius"
          onRouteHandoff={onRouteHandoff as any}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("ScanResultsTable workbench integration", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("eve-radius-route-view-mode:v1", "route");
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the same workbench route from header, insights, and saved routes", async () => {
    renderTable();

    fireEvent.click(await screen.findByRole("button", { name: /Open route workbench summary for Jita → Amarr/i }));
    const panel = await screen.findByTestId("route-workbench-panel:loc:60003760->loc:60008494");
    expect(panel).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("route-workbench-action-pin"));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Open route workbench summary for Jita → Amarr/i,
      }),
    );
    expect(screen.getByTestId("route-workbench-panel:loc:60003760->loc:60008494")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Open route workbench verification for Jita → Amarr/i,
      }),
    ).toBeInTheDocument();
  });

  it("emits structured payload for each route handoff action", async () => {
    const onRouteHandoff = vi.fn();
    renderTable(onRouteHandoff);

    fireEvent.click(screen.getByRole("button", { name: "Row view" }));
    const checkboxes = await screen.findAllByRole("checkbox");
    fireEvent.click(checkboxes[1]!);

    fireEvent.click(
      await screen.findByRole("button", { name: "Open in Route Planner" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Open in Route Validation" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Open in Cargo Plan" }));

    expect(onRouteHandoff).toHaveBeenCalledTimes(3);
    expect(onRouteHandoff.mock.calls[0][0]).toMatchObject({
      source: "scanner",
      preferredEntryAction: "planner",
      routeKey: "loc:60003760->loc:60008494",
    });
    expect(onRouteHandoff.mock.calls[1][0]).toMatchObject({
      preferredEntryAction: "validation",
    });
    expect(onRouteHandoff.mock.calls[2][0]).toMatchObject({
      preferredEntryAction: "cargo",
    });
    expect(onRouteHandoff.mock.calls[0][1]).toContain("Scanner Route Handoff");
    expect(onRouteHandoff.mock.calls[0][2]).toMatchObject({
      buyLocationID: 60003760,
      sellLocationID: 60008494,
      buySystemName: "Jita",
      sellSystemName: "Amarr",
    });
  });

  it("opens batch builder directly from compact insight CTA with seeded route rows", async () => {
    renderTable();

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Open in Build Batch" }))[0],
    );

    expect(await screen.findByTestId("batch-builder-entry-context")).toHaveTextContent(
      "Mode: core",
    );
    const copyManifestButtons = screen.getAllByRole("button", {
      name: /Copy Manifest/i,
    });
    expect(copyManifestButtons.some((button) => !button.hasAttribute("disabled"))).toBe(true);
  });
});
