import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { RadiusRouteWorkspace } from "@/components/RadiusRouteWorkspace";
import { deriveRadiusScanSession } from "@/lib/radiusScanSession";
import type { FlipResult, ScanParams } from "@/lib/types";
import { createSessionStationFilters } from "@/lib/banlistFilters";

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

function renderWorkspace(session = null) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <RadiusRouteWorkspace params={params} radiusScanSession={session} />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("RadiusRouteWorkspace rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("switches sections and toggles visible content", () => {
    const session = deriveRadiusScanSession({
      results: [makeFlip()],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });
    renderWorkspace(session);

    expect(screen.getByTestId("route-workspace-discover")).toBeInTheDocument();
    expect(screen.getByText("Grouped routes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Workbench" }));
    expect(screen.getByTestId("route-workspace-workbench")).toBeInTheDocument();
    expect(screen.getByText(/Selected route:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Validate" }));
    expect(screen.getByTestId("route-workspace-validate")).toBeInTheDocument();
    expect(screen.getByText(/Route checks:/)).toBeInTheDocument();
  });

  it("shows no-scan state in discover/workbench/validate", () => {
    renderWorkspace(null);

    expect(screen.getByText("No data")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Workbench" }));
    expect(screen.getByText("No data")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Validate" }));
    expect(screen.getByText("No data")).toBeInTheDocument();
  });
});
