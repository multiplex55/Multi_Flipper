import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { RadiusRouteWorkspace } from "@/components/RadiusRouteWorkspace";
import { deriveRadiusScanSession } from "@/lib/radiusScanSession";
import type { RadiusScanSession } from "@/lib/radiusScanSession";
import type { FlipResult, ScanParams } from "@/lib/types";
import type { RouteHandoffContext } from "@/lib/routeHandoff";
import type { RouteQueueEntry } from "@/lib/routeQueue";
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
  routeQueue: RouteQueueEntry[] = [],
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
        routeQueue={routeQueue}
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
    fireEvent.click(screen.getByRole("tab", { name: "Grouped Routes" }));
    expect(localStorage.getItem(ROUTE_WORKSPACE_MODE_STORAGE_KEY)).toBe(beforeDiscover);

    fireEvent.click(screen.getByRole("tab", { name: "Workbench" }));
    const persisted = JSON.parse(
      localStorage.getItem(ROUTE_WORKSPACE_MODE_STORAGE_KEY) ?? "{}",
    ) as { mode?: string; hadActiveRouteAtPersistTime?: boolean };

    expect(persisted.mode).toBe("workbench");
    expect(persisted.hadActiveRouteAtPersistTime).toBe(true);
  });

  it("renders filler section when handoff requests preferred filler section", async () => {
    const session = deriveRadiusScanSession({
      results: [makeFlip()],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });
    const pendingRouteContext: RouteHandoffContext = {
      source: "scanner",
      routeKey: "loc:60003760->loc:60008494",
      routeLabel: "Jita → Amarr",
      legContexts: [],
      preferredEntryAction: "planner",
      intent: "open-workbench",
      preferredSection: "filler",
    };

    const Wrapper = () => {
      const workspace = useRouteExecutionWorkspace();
      const { openRoute } = workspace;
      useEffect(() => {
        openRoute("loc:60003760->loc:60008494", "workbench");
      }, [openRoute]);
      return (
        <RadiusRouteWorkspace
          params={params}
          radiusScanSession={session}
          routeWorkspace={workspace}
          workspaceMode="workbench"
          pendingRouteContext={pendingRouteContext}
        />
      );
    };

    render(
      <I18nProvider>
        <ToastProvider>
          <Wrapper />
        </ToastProvider>
      </I18nProvider>,
    );

    expect(await screen.findByTestId("route-workbench-section-filler")).toBeInTheDocument();
  });

  it("defaults to Grouped Routes tab after a scan session exists", async () => {
    const session = deriveRadiusScanSession({
      results: [makeFlip()],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });

    renderWorkspace(session, null);

    expect(await screen.findByTestId("radius-route-groups-panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Grouped Routes" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows grouped-route actions in grouped routes tab", async () => {
    const session = deriveRadiusScanSession({
      results: [makeFlip()],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });

    renderWorkspace(session, null);

    expect(await screen.findByRole("button", { name: "Open Workbench" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign Active Pilot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign Best Pilot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build Batch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Manifest" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Summary" })).toBeInTheDocument();
  });

  it("opens compare panel from grouped-route selections and enforces compare cap", async () => {
    const session = deriveRadiusScanSession({
      results: [
        makeFlip({ TypeID: 1, BuyLocationID: 60000001, BuyStation: "A", SellLocationID: 60000011, SellStation: "B" }),
        makeFlip({ TypeID: 2, BuyLocationID: 60000002, BuyStation: "C", SellLocationID: 60000012, SellStation: "D" }),
        makeFlip({ TypeID: 3, BuyLocationID: 60000003, BuyStation: "E", SellLocationID: 60000013, SellStation: "F" }),
        makeFlip({ TypeID: 4, BuyLocationID: 60000004, BuyStation: "G", SellLocationID: 60000014, SellStation: "H" }),
        makeFlip({ TypeID: 5, BuyLocationID: 60000005, BuyStation: "I", SellLocationID: 60000015, SellStation: "J" }),
      ],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });

    renderWorkspace(session, null);

    const compareButtons = await screen.findAllByRole("button", { name: "Compare" });
    compareButtons.forEach((button) => fireEvent.click(button));

    expect(screen.getByTestId("radius-route-compare-panel")).toBeInTheDocument();
    expect(screen.getByText("Route Compare (4/4)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove I/i })).not.toBeInTheDocument();
  });

  it("applies execution filters in grouped routes panel", async () => {
    const session = deriveRadiusScanSession({
      results: [makeFlip()],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });
    renderWorkspace(session, null, [
      {
        routeKey: "loc:60003760->loc:60008494",
        routeLabel: "Jita → Amarr",
        status: "queued",
        priority: 1,
        assignedPilot: "",
        verificationProfileId: "standard",
        lastVerifiedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const groupsPanel = await screen.findByTestId("radius-route-groups-panel");
    expect(within(groupsPanel).getByText("Jita IV → Amarr VIII")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide queued" }));
    expect(within(groupsPanel).queryByText("Jita IV → Amarr VIII")).not.toBeInTheDocument();
  });
  it("uses workspace batch open path once when fallback callback is also provided", async () => {
    const session = deriveRadiusScanSession({
      results: [makeFlip()],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });
    const workspaceOpenSpy = vi.fn();
    const fallbackSpy = vi.fn();

    const Wrapper = () => {
      const workspace = useRouteExecutionWorkspace({ onOpenBatchBuilder: workspaceOpenSpy });
      return (
        <RadiusRouteWorkspace
          params={params}
          radiusScanSession={session}
          routeWorkspace={workspace}
          onOpenBatchBuilderForRoute={fallbackSpy}
        />
      );
    };

    render(
      <I18nProvider>
        <ToastProvider>
          <Wrapper />
        </ToastProvider>
      </I18nProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Build Batch" }));

    expect(workspaceOpenSpy).toHaveBeenCalledTimes(1);
    expect(fallbackSpy).not.toHaveBeenCalled();
  });

});
