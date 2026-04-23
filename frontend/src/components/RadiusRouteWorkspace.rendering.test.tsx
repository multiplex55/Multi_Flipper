import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { RadiusRouteWorkspace } from "@/components/RadiusRouteWorkspace";
import { deriveRadiusScanSession } from "@/lib/radiusScanSession";
import type { RadiusScanSession } from "@/lib/radiusScanSession";
import type { FlipResult, ScanParams } from "@/lib/types";
import { createSessionStationFilters } from "@/lib/banlistFilters";
import { useRouteExecutionWorkspace } from "@/lib/useRouteExecutionWorkspace";
import { ROUTE_WORKSPACE_MODE_STORAGE_KEY } from "@/lib/routeWorkspaceModeResolver";

const params: ScanParams = {
  system_name: "Jita",
  cargo_capacity: 12000,
  buy_radius: 5,
  sell_radius: 5,
  min_margin: 0,
  sales_tax_percent: 3,
  broker_fee_percent: 2,
};

function makeFlip(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
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
    ...overrides,
  } as FlipResult;
}

function renderWorkspace(
  session: RadiusScanSession | null = null,
  activeRouteKey: string | null = null,
) {
  const Wrapper = () => {
    const workspace = useRouteExecutionWorkspace();
    const { openRoute } = workspace;
    useEffect(() => {
      if (activeRouteKey) openRoute(activeRouteKey, "workbench");
    }, [activeRouteKey, openRoute]);
    return (
      <RadiusRouteWorkspace
        params={params}
        radiusScanSession={session}
        routeWorkspace={workspace}
      />
    );
  };
  return render(
    <I18nProvider>
      <ToastProvider>
        <Wrapper />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("RadiusRouteWorkspace rendering", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("falls back from stale persisted workbench mode to Finder", async () => {
    localStorage.setItem(
      ROUTE_WORKSPACE_MODE_STORAGE_KEY,
      JSON.stringify({
        mode: "workbench",
        hadActiveRouteAtPersistTime: true,
        persistedAt: Date.now(),
      }),
    );

    renderWorkspace(null, null);

    expect(await screen.findByText("Route Settings")).toBeInTheDocument();
    expect(screen.queryByTestId("route-workspace-workbench")).not.toBeInTheDocument();
  });

  it("persists only meaningful modes with route guard metadata", async () => {
    const session = deriveRadiusScanSession({
      results: [makeFlip()],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });
    renderWorkspace(session, "loc:60003760->loc:60008494");

    const beforeDiscover = localStorage.getItem(ROUTE_WORKSPACE_MODE_STORAGE_KEY);
    fireEvent.click(screen.getByRole("tab", { name: "Discover" }));
    expect(localStorage.getItem(ROUTE_WORKSPACE_MODE_STORAGE_KEY)).toBe(beforeDiscover);

    fireEvent.click(screen.getByRole("tab", { name: "Workbench" }));
    const persisted = JSON.parse(
      localStorage.getItem(ROUTE_WORKSPACE_MODE_STORAGE_KEY) ?? "{}",
    ) as { mode?: string; hadActiveRouteAtPersistTime?: boolean };

    expect(persisted.mode).toBe("workbench");
    expect(persisted.hadActiveRouteAtPersistTime).toBe(true);
  });
});
