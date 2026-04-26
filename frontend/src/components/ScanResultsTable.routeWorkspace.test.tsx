import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult, SavedRoutePack } from "@/lib/types";
import type { RouteExecutionWorkspace } from "@/lib/useRouteExecutionWorkspace";

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
  } as FlipResult;
}

function makePack(): SavedRoutePack {
  return {
    routeKey: "loc:60003760->loc:60008494",
    routeLabel: "Jita → Amarr",
    buyLocationId: 60003760,
    sellLocationId: 60008494,
    buySystemId: 30000142,
    sellSystemId: 30002187,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastVerifiedAt: null,
    verificationProfileId: "standard",
    entryMode: "core",
    launchIntent: null,
    selectedLineKeys: ["1001:60003760:60008494"],
    excludedLineKeys: [],
    summarySnapshot: {
      routeItemCount: 1,
      routeTotalProfit: 300,
      routeTotalCapital: 1000,
      routeRealIskPerJump: 10,
      routeDailyIskPerJump: 10,
      routeDailyProfit: 10,
      routeWeightedSlippagePct: 0,
      routeTurnoverDays: null,
      routeSafetyRank: null,
    },
    lines: {},
    manifestSnapshot: null,
    verificationSnapshot: null,
    notes: "",
    tags: [],
    status: "active",
  };
}

describe("ScanResultsTable route workspace integration", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("eve-radius-route-view-mode:v1", "route");
  });
  afterEach(() => cleanup());

  it("calls workspace actions rather than owning execution state", async () => {
    const openRoute = vi.fn();
    const removePack = vi.fn();
    const workspace = {
      activeRouteKey: null,
      activeMode: "finder",
      savedRoutePacks: [makePack()],
      selectedPack: null,
      getPackByRouteKey: vi.fn(() => makePack()),
      getVerificationProfileId: vi.fn(() => "standard"),
      openRoute,
      setMode: vi.fn(),
      selectPack: vi.fn(),
      upsertPack: vi.fn(),
      removePack,
      verifyRoute: vi.fn(),
      markBought: vi.fn(),
      markSold: vi.fn(),
      markSkipped: vi.fn(),
      resetExecution: vi.fn(),
      copySummary: vi.fn(),
      copyManifest: vi.fn(),
      openBatchBuilder: vi.fn(),
    } as unknown as RouteExecutionWorkspace;

    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[makeRow()]}
            scanning={false}
            progress=""
            tradeStateTab="region"
            routeWorkspace={workspace}
            routeQueueEntries={[
              {
                routeKey: "loc:60003760->loc:60008494",
                routeLabel: "Jita → Amarr",
                status: "needs_verify",
                priority: 1,
                assignedPilot: "Pilot Nova",
                verificationProfileId: "standard",
                lastVerifiedAt: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ]}
            featureConfig={{
              allowRouteGrouping: true,
              showRouteInsights: true,
              showRouteWorkbench: true,
              showSavedRoutes: true,
              showLoopPanel: false,
              defaultViewMode: "route",
            }}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Open Jita → Amarr summary/i }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(openRoute).toHaveBeenCalledWith("loc:60003760->loc:60008494", "workbench");
    expect(removePack).toHaveBeenCalledWith("loc:60003760->loc:60008494");
  });
});
