import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusRouteWorkspace } from "@/components/RadiusRouteWorkspace";
import { ToastProvider } from "@/components/Toast";
import { I18nProvider } from "@/lib/i18n";
import { deriveRadiusScanSession } from "@/lib/radiusScanSession";
import { createSessionStationFilters } from "@/lib/banlistFilters";
import type { RouteExecutionWorkspace } from "@/lib/useRouteExecutionWorkspace";
import type { FlipResult, SavedRoutePack, ScanParams } from "@/lib/types";

vi.mock("@/lib/routeFillPlanner", async () => {
  const actual = await vi.importActual<typeof import("@/lib/routeFillPlanner")>("@/lib/routeFillPlanner");
  return {
    ...actual,
    buildRouteFillPlannerSections: vi.fn(() => ({
      sameEndpointFiller: [
        {
          id: "filler:one",
          title: "Filler One",
          type: "filler",
          incrementalProfitIsk: 1000,
          addedJumps: 1,
          addedM3: 10,
          confidencePercent: 80,
          rationale: "same leg",
          sourceLineKeys: ["34:60003760:60008494"],
        },
      ],
      alongTheWayDetourFiller: [],
      backhaulReturnLegFiller: [],
    })),
  };
});

const params: ScanParams = {
  system_name: "Jita",
  cargo_capacity: 12000,
  buy_radius: 5,
  sell_radius: 5,
  min_margin: 0,
  sales_tax_percent: 3,
  broker_fee_percent: 2,
};

const row = {
  TypeID: 34,
  TypeName: "Tritanium",
  BuySystemID: 30000142,
  BuySystemName: "Jita",
  SellSystemID: 30002187,
  SellSystemName: "Amarr",
  BuyStation: "Jita IV",
  SellStation: "Amarr VIII",
  BuyLocationID: 60003760,
  SellLocationID: 60008494,
  BuyPrice: 5,
  SellPrice: 7,
  ExpectedBuyPrice: 5,
  ExpectedSellPrice: 7,
  ProfitPerUnit: 2,
  UnitsToBuy: 1000,
  FilledQty: 1000,
  DailyVolume: 10000,
  DailyProfit: 2000000,
  TotalJumps: 9,
  Volume: 0.01,
} as FlipResult;

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
    selectedLineKeys: ["existing:line"],
    excludedLineKeys: [],
    summarySnapshot: {
      routeItemCount: 1,
      routeTotalProfit: 100,
      routeTotalCapital: 100,
      routeRealIskPerJump: 10,
      routeDailyIskPerJump: 10,
      routeDailyProfit: 10,
      routeWeightedSlippagePct: 1,
      routeTurnoverDays: null,
      routeSafetyRank: null,
    },
    lines: {
      "existing:line": {
        lineKey: "existing:line",
        typeId: 34,
        typeName: "Tritanium",
        plannedQty: 1,
        plannedBuyPrice: 5,
        plannedSellPrice: 7,
        plannedProfit: 2,
        plannedVolume: 1,
        boughtQty: 0,
        boughtTotal: 0,
        soldQty: 0,
        soldTotal: 0,
        remainingQty: 1,
        status: "planned",
        skipReason: null,
        notes: "",
      },
    },
    manifestSnapshot: null,
    verificationSnapshot: null,
    notes: "",
    tags: [],
    status: "active",
  };
}

function makeWorkspace(upsertPack: (pack: SavedRoutePack) => void): RouteExecutionWorkspace {
  const pack = makePack();
  return {
    activeRouteKey: pack.routeKey,
    activeMode: "workbench",
    savedRoutePacks: [pack],
    selectedPack: pack,
    getPackByRouteKey: (routeKey: string) => (routeKey === pack.routeKey ? pack : null),
    getVerificationProfileId: () => "standard",
    openRoute: vi.fn(),
    setMode: vi.fn(),
    selectPack: vi.fn(),
    upsertPack,
    removePack: vi.fn(),
    verifyRoute: vi.fn(),
    markBought: vi.fn(),
    markSold: vi.fn(),
    markSkipped: vi.fn(),
    resetExecution: vi.fn(),
    copySummary: vi.fn(() => ""),
    copyManifest: vi.fn(() => ""),
    openBatchBuilder: vi.fn(),
  };
}

describe("RadiusRouteWorkspace suggestion open", () => {
  afterEach(() => cleanup());

  it("merges suggestion source keys into selected pack and sets filler intent", () => {
    const upsertPack = vi.fn<(pack: SavedRoutePack) => void>();
    const session = deriveRadiusScanSession({
      results: [row],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });

    render(
      <I18nProvider>
        <ToastProvider>
          <RadiusRouteWorkspace
            params={params}
            workspaceMode="workbench"
            radiusScanSession={session}
            routeWorkspace={makeWorkspace(upsertPack)}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "filler" }));
    const rowNode = screen.getByTestId("route-fill-suggestion:filler:one");
    fireEvent.click(within(rowNode).getByRole("button", { name: "Open" }));

    expect(upsertPack).toHaveBeenCalledTimes(1);
    expect(upsertPack.mock.calls[0]?.[0]).toMatchObject({
      entryMode: "filler",
      launchIntent: "radius-fill-planner",
      selectedLineKeys: ["34:60003760:60008494", "existing:line"],
    });
  });
});
