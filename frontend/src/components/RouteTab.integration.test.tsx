import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { RadiusRouteWorkspace } from "@/components/RadiusRouteWorkspace";
import { deriveRadiusScanSession } from "@/lib/radiusScanSession";
import { createSessionStationFilters } from "@/lib/banlistFilters";
import type { FlipResult, RouteResult, ScanParams } from "@/lib/types";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getBanlistItems: vi.fn(async () => []),
    getBannedStations: vi.fn(async () => []),
    findRoutes: vi.fn(async () => []),
    setWaypointInGame: vi.fn(async () => undefined),
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

const loadedResults: RouteResult[] = [
  {
    Hops: [
      {
        SystemName: "Jita",
        StationName: "Jita IV",
        SystemID: 30000142,
        DestSystemName: "Amarr",
        DestStationName: "Amarr VIII",
        DestSystemID: 30002187,
        TypeName: "Tritanium",
        TypeID: 34,
        BuyPrice: 5,
        SellPrice: 7,
        Units: 1000,
        Profit: 2000,
        Jumps: 9,
      },
    ],
    TotalProfit: 2000,
    TotalJumps: 9,
    ProfitPerJump: 222,
    HopCount: 1,
  },
];

const baseFlip = {
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

function renderWorkspace(props: Partial<ComponentProps<typeof RadiusRouteWorkspace>> = {}) {
  const session = deriveRadiusScanSession({
    results: [baseFlip],
    scanParams: params,
    sessionStationFilters: createSessionStationFilters(),
  });
  return render(
    <I18nProvider>
      <ToastProvider>
        <RadiusRouteWorkspace
          params={params}
          routeLoadedResults={loadedResults}
          radiusScanSession={session}
          {...props}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("RouteTab integration", () => {
  it("defaults to Finder when there is no handoff and no selected route context", async () => {
    renderWorkspace({ radiusScanSession: null });
    expect(await screen.findByText("Route Settings")).toBeInTheDocument();
  });

  it("opens Workbench by default when route is opened from Radius", async () => {
    renderWorkspace({ workspaceSource: "radius", activeRouteKey: "loc:60003760->loc:60008494" });
    expect(await screen.findByTestId("route-workbench-header")).toBeInTheDocument();
  });

  it("opens Validate when explicit validate intent is provided", async () => {
    renderWorkspace({ handoffIntent: "open-validate", activeRouteKey: "loc:60003760->loc:60008494" });
    expect(await screen.findByTestId("route-workspace-validate")).toBeInTheDocument();
    expect(await screen.findByText(/Route checks:/)).toBeInTheDocument();
  });
});
