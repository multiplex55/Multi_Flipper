import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { RadiusRouteWorkspace } from "@/components/RadiusRouteWorkspace";
import type { RouteResult, ScanParams } from "@/lib/types";

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

describe("RouteTab integration", () => {
  it("keeps Finder wired to RouteBuilder route search flow", async () => {
    render(
      <I18nProvider>
        <ToastProvider>
          <RadiusRouteWorkspace
            params={params}
            routeLoadedResults={loadedResults}
            radiusScanSession={null}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Finder" }));

    expect(await screen.findByText("Route Settings")).toBeInTheDocument();
    expect(await screen.findByTestId("route-result-row-0")).toHaveTextContent("Jita");
  });
});
