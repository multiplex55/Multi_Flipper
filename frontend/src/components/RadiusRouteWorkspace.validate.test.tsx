import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusRouteWorkspace } from "@/components/RadiusRouteWorkspace";
import { ToastProvider } from "@/components/Toast";
import { I18nProvider } from "@/lib/i18n";
import { deriveRadiusScanSession } from "@/lib/radiusScanSession";
import { createSessionStationFilters } from "@/lib/banlistFilters";
import type { RouteExecutionWorkspace } from "@/lib/useRouteExecutionWorkspace";
import type { FlipResult, SavedRoutePack, ScanParams } from "@/lib/types";

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
    lastVerifiedAt: "2026-01-01T00:00:00.000Z",
    verificationProfileId: "standard",
    entryMode: "core",
    launchIntent: null,
    selectedLineKeys: ["34:60003760:60008494"],
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
    lines: {},
    manifestSnapshot: null,
    verificationSnapshot: {
      status: "Reduced edge",
      recommendation: "proceed_reduced",
      currentProfitIsk: 80,
      minAcceptableProfitIsk: 70,
      verifiedAt: "2026-01-01T00:00:00.000Z",
      checkedAt: "2026-01-01T00:00:00.000Z",
      offenderCount: 1,
      buyDriftPct: 4,
      sellDriftPct: 3,
      profitRetentionPct: 80,
      offenderLines: ["34:60003760:60008494"],
      summary: "Reduced",
    },
    notes: "",
    tags: [],
    status: "active",
  };
}

function makeWorkspace(): RouteExecutionWorkspace {
  const pack = makePack();
  const upsertPack = vi.fn();
  const openBatchBuilder = vi.fn();
  const removePack = vi.fn();
  return {
    activeRouteKey: pack.routeKey,
    activeMode: "validate",
    savedRoutePacks: [pack],
    selectedPack: pack,
    getPackByRouteKey: (routeKey: string) => (routeKey === pack.routeKey ? pack : null),
    getVerificationProfileId: () => "standard",
    openRoute: vi.fn(),
    setMode: vi.fn(),
    selectPack: vi.fn(),
    upsertPack,
    removePack,
    verifyRoute: vi.fn(),
    markBought: vi.fn(),
    markSold: vi.fn(),
    markSkipped: vi.fn(),
    resetExecution: vi.fn(),
    copySummary: vi.fn(() => ""),
    copyManifest: vi.fn(() => ""),
    openBatchBuilder,
  };
}

describe("RadiusRouteWorkspace validate panel", () => {
  afterEach(() => cleanup());

  it("renders metrics and recommendation", () => {
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
            workspaceMode="validate"
            radiusScanSession={session}
            routeWorkspace={makeWorkspace()}
            routeQueueKeys={["loc:60003760->loc:60008494"]}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    expect(screen.getByTestId("validate-panel-container")).toBeInTheDocument();
    expect(screen.getByText("Reduced edge")).toBeInTheDocument();
    expect(screen.getByText("Proceed reduced")).toBeInTheDocument();
    expect(screen.getByText("80.0%")).toBeInTheDocument();
  });

  it("triggers quick actions and callbacks", () => {
    const onValidateVerifyNow = vi.fn();
    const onValidateProfileSwitch = vi.fn();
    const onValidateRebuildFromLiveRows = vi.fn();
    const onValidateOpenOffenders = vi.fn();
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
            workspaceMode="validate"
            radiusScanSession={session}
            routeWorkspace={makeWorkspace()}
            routeQueueKeys={["loc:60003760->loc:60008494"]}
            onValidateVerifyNow={onValidateVerifyNow}
            onValidateProfileSwitch={onValidateProfileSwitch}
            onValidateRebuildFromLiveRows={onValidateRebuildFromLiveRows}
            onValidateOpenOffenders={onValidateOpenOffenders}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Verify now" }));
    fireEvent.change(screen.getByLabelText("Validate profile"), { target: { value: "strict" } });
    fireEvent.click(screen.getByRole("button", { name: "Rebuild from live rows" }));
    fireEvent.click(screen.getByRole("button", { name: "Open offender lines" }));

    expect(onValidateVerifyNow).toHaveBeenCalledTimes(1);
    expect(onValidateProfileSwitch).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "strict" }),
    );
    expect(onValidateRebuildFromLiveRows).toHaveBeenCalledTimes(1);
    expect(onValidateOpenOffenders).toHaveBeenCalledWith(
      expect.objectContaining({ offenderLines: ["34:60003760:60008494"] }),
    );
  });

  it("renders validate actions and applies keep/remove/skip flows", () => {
    const session = deriveRadiusScanSession({
      results: [row],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });
    const workspace = makeWorkspace();

    render(
      <I18nProvider>
        <ToastProvider>
          <RadiusRouteWorkspace
            params={params}
            workspaceMode="validate"
            radiusScanSession={session}
            routeWorkspace={workspace}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Keep Batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Bad Rows" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip Route" }));

    expect(workspace.openBatchBuilder).toHaveBeenCalledWith("loc:60003760->loc:60008494");
    expect(workspace.upsertPack).toHaveBeenCalledTimes(1);
    expect(workspace.removePack).toHaveBeenCalledWith("loc:60003760->loc:60008494");
  });
});
