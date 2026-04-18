import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadiusRouteWorkspace } from "@/components/RadiusRouteWorkspace";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { deriveRadiusScanSession } from "@/lib/radiusScanSession";
import { createSessionStationFilters } from "@/lib/banlistFilters";
import type { FlipResult, ScanParams } from "@/lib/types";

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

describe("RadiusRouteWorkspace discover contract", () => {
  it("consumes derived session DTO output", () => {
    const session = deriveRadiusScanSession({
      results: [row],
      scanParams: params,
      sessionStationFilters: createSessionStationFilters(),
    });

    expect(session.insights.routeSummaries.length).toBeGreaterThan(0);
    expect((session.insights as Record<string, unknown>).datasetRows).toBeUndefined();
    expect((session.insights as Record<string, unknown>).sorted).toBeUndefined();

    render(
      <I18nProvider>
        <ToastProvider>
          <RadiusRouteWorkspace params={params} radiusScanSession={session} />
        </ToastProvider>
      </I18nProvider>,
    );

    expect(screen.getByText("Grouped routes")).toBeInTheDocument();
    expect(screen.getByText("Top grouped routes")).toBeInTheDocument();
  });
});
