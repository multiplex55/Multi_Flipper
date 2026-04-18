import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import {
  RouteExecutionPlanner,
  type RoutePlannerSelection,
} from "@/components/RouteExecutionPlanner";

function makeSelection(): RoutePlannerSelection {
  return {
    route: {
      Hops: [
        {
          SystemName: "Jita",
          StationName: "Jita IV - Moon 4",
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
          RegionID: 10000002,
          modeled_qty: 1000,
          buy_remaining: 1000,
          sell_remaining: 1000,
          effective_buy: 5,
          effective_sell: 7,
        },
      ],
      TotalProfit: 2000,
      TotalJumps: 9,
      ProfitPerJump: 222,
      HopCount: 1,
      TargetSystemName: "Dodixie",
      TargetJumps: 4,
    },
    activeFilters: {
      minHops: 1,
      maxHops: 5,
      targetSystemName: "Amarr",
      minISKPerJump: 0,
      allowEmptyHops: false,
    },
    executionSettings: {
      cargoCapacityM3: 12000,
      feeModel: {
        splitTradeFees: false,
        salesTaxPercent: 3,
        brokerFeePercent: 2,
        buyBrokerFeePercent: 2,
        sellBrokerFeePercent: 2,
      },
      riskConstraints: {
        minRouteSecurity: 0.5,
        maxDetourJumpsPerNode: 2,
        allowLowsec: false,
        allowNullsec: false,
        allowWormhole: false,
      },
      validationThresholds: {
        maxBuyDriftPct: 5,
        maxSellDriftPct: 5,
        minProfitRetainedPct: 80,
        minLiquidityRetainedPct: 70,
      },
    },
  };
}

describe("RouteExecutionPlanner", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined),
      },
    });
  });

  it("prioritizes manifest copy and open-verifier actions from initial handoff action", async () => {
    const onOpenPriceValidation = vi.fn();
    render(
      <I18nProvider>
        <ToastProvider>
          <RouteExecutionPlanner
            open
            onClose={() => undefined}
            selection={makeSelection()}
            initialAction="validate_route_prices"
            onOpenPriceValidation={onOpenPriceValidation}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    expect(await screen.findByTestId("route-ops-priority")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("route-priority-copy-manifest"));
    fireEvent.click(screen.getByTestId("route-priority-open-verifier"));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(onOpenPriceValidation).toHaveBeenCalledTimes(1);
    });
    expect(onOpenPriceValidation.mock.calls[0][0]).toContain(
      "--- Route Planner Context ---",
    );
  });
});
