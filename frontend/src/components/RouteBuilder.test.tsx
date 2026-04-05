import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { RouteBuilder } from "@/components/RouteBuilder";
import type { RouteResult, ScanParams } from "@/lib/types";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    findRoutes: vi.fn(async () => []),
    getBanlistItems: vi.fn(async () => []),
    getBannedStations: vi.fn(async () => []),
    setWaypointInGame: vi.fn(async () => undefined),
  };
});

function makeRouteResult(): RouteResult {
  return {
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
  };
}

const baseParams: ScanParams = {
  system_name: "Jita",
  cargo_capacity: 12000,
  buy_radius: 5,
  sell_radius: 5,
  min_margin: 0,
  sales_tax_percent: 3,
  broker_fee_percent: 2,
  route_min_hops: 1,
  route_max_hops: 4,
  route_min_isk_per_jump: 0,
  route_allow_empty_hops: false,
  route_low_attention_max_stops: 2,
  route_low_attention_max_items: 4,
  route_low_attention_min_fill_confidence: 75,
  route_low_attention_min_stop_profit_isk: 1000,
  route_low_attention_avoid_structure_only: true,
  route_low_attention_avoid_item_concentration: true,
};

function renderRouteBuilder(routes: RouteResult[] = [makeRouteResult()]) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <RouteBuilder params={baseParams} loadedResults={routes} />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("RouteBuilder planner interactions", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("opens planner from route detail popup", async () => {
    renderRouteBuilder();

    const routeRow = await screen.findByTestId("route-result-row-0");
    fireEvent.doubleClick(routeRow);

    const expandButton = await screen.findByTestId("route-planner-cta-expand");
    fireEvent.click(expandButton);

    expect(
      await screen.findByTestId("route-execution-planner"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("route-planner-manifest")).toBeInTheDocument();
  });

  it("shows planner CTA buttons and enables them for plannable routes", async () => {
    renderRouteBuilder();

    const routeRow = await screen.findByTestId("route-result-row-0");
    fireEvent.doubleClick(routeRow);

    const expandButton = await screen.findByTestId("route-planner-cta-expand");
    const cargoButton = screen.getByTestId("route-planner-cta-cargo");
    const validateButton = screen.getByTestId("route-planner-cta-validate");

    expect(expandButton).toBeVisible();
    expect(cargoButton).toBeVisible();
    expect(validateButton).toBeVisible();
    expect(expandButton).toBeEnabled();
    expect(cargoButton).toBeEnabled();
    expect(validateButton).toBeEnabled();
  });

  it("preserves selected route context when planner closes and reopens", async () => {
    renderRouteBuilder();

    const routeRow = await screen.findByTestId("route-result-row-0");
    fireEvent.doubleClick(routeRow);

    fireEvent.click(await screen.findByTestId("route-planner-cta-cargo"));
    expect(
      await screen.findByTestId("route-execution-planner"),
    ).toBeInTheDocument();
    expect(screen.getByText("Route hops")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close dialog"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("route-execution-planner"),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(await screen.findByTestId("route-planner-cta-expand"));
    expect(
      await screen.findByTestId("route-execution-planner"),
    ).toBeInTheDocument();
    expect(screen.getByText("Route hops")).toBeInTheDocument();
    expect(screen.getByTestId("route-result-row-0")).toHaveTextContent("Jita");
  });

  it("keeps existing route copy actions working", async () => {
    renderRouteBuilder();

    const routeRow = await screen.findByTestId("route-result-row-0");
    fireEvent.doubleClick(routeRow);

    fireEvent.click(await screen.findByTestId("route-copy-systems"));
    fireEvent.click(screen.getByTestId("route-copy-manifest"));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    });
  });

  it("does not mutate route search results when planner actions run", async () => {
    renderRouteBuilder();

    const routeRow = await screen.findByTestId("route-result-row-0");
    expect(routeRow).toHaveTextContent("Jita");

    fireEvent.doubleClick(routeRow);
    fireEvent.click(await screen.findByTestId("route-planner-cta-validate"));

    expect(
      await screen.findByTestId("route-validation-band"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close dialog"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("route-execution-planner"),
      ).not.toBeInTheDocument();
    });

    const postPlannerRow = screen.getByTestId("route-result-row-0");
    expect(postPlannerRow).toHaveTextContent("Amarr");
    expect(postPlannerRow).toHaveTextContent("2.0K");
  });

  it("renders green/yellow/red validation bands", async () => {
    const green = makeRouteResult();
    const yellow = makeRouteResult();
    yellow.Hops[0].effective_buy = 5.3;
    const red = makeRouteResult();
    red.Hops[0].effective_buy = 5.8;

    const { rerender } = render(
      <I18nProvider>
        <ToastProvider>
          <RouteBuilder params={baseParams} loadedResults={[green]} />
        </ToastProvider>
      </I18nProvider>,
    );
    fireEvent.doubleClick(await screen.findByTestId("route-result-row-0"));
    fireEvent.click(await screen.findByTestId("route-planner-cta-validate"));
    expect(
      await screen.findByTestId("route-validation-band"),
    ).toHaveTextContent("green");
    fireEvent.click(screen.getByLabelText("Close dialog"));

    rerender(
      <I18nProvider>
        <ToastProvider>
          <RouteBuilder params={baseParams} loadedResults={[yellow]} />
        </ToastProvider>
      </I18nProvider>,
    );
    fireEvent.doubleClick(await screen.findByTestId("route-result-row-0"));
    fireEvent.click(await screen.findByTestId("route-planner-cta-validate"));
    expect(
      await screen.findByTestId("route-validation-band"),
    ).toHaveTextContent("yellow");
    fireEvent.click(screen.getByLabelText("Close dialog"));

    rerender(
      <I18nProvider>
        <ToastProvider>
          <RouteBuilder params={baseParams} loadedResults={[red]} />
        </ToastProvider>
      </I18nProvider>,
    );
    fireEvent.doubleClick(await screen.findByTestId("route-result-row-0"));
    fireEvent.click(await screen.findByTestId("route-planner-cta-validate"));
    expect(
      await screen.findByTestId("route-validation-band"),
    ).toHaveTextContent("red");
  });

  it("re-run validation updates summary and stop cards together", async () => {
    const route = makeRouteResult();
    route.Hops[0].snapshot_ts = "2026-04-04T11:55:00Z";
    renderRouteBuilder([route]);

    fireEvent.doubleClick(await screen.findByTestId("route-result-row-0"));
    fireEvent.click(await screen.findByTestId("route-planner-cta-validate"));
    expect(
      await screen.findByTestId("route-stale-warning"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("route-validation-summary"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("route-degradation-indicators"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("route-validation-stops"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("route-validation-rerun"));
    expect(
      await screen.findByTestId("route-stale-warning"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("route-validation-summary"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("route-degradation-indicators"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("route-validation-stops"),
    ).toBeInTheDocument();
  });

  it("filter chips modify planner option list for low-attention mode", async () => {
    renderRouteBuilder();
    fireEvent.doubleClick(await screen.findByTestId("route-result-row-0"));
    fireEvent.click(await screen.findByTestId("route-planner-cta-expand"));

    expect(
      await screen.findByTestId("route-filter-chip-low-attention"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("route-planner-option-expand_route"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("route-filter-chip-all-options"));
    expect(
      await screen.findByTestId("route-planner-option-expand_route"),
    ).toBeInTheDocument();
  });

  it("planner controls expose aria labels and keyboard activation", async () => {
    renderRouteBuilder();
    fireEvent.doubleClick(await screen.findByTestId("route-result-row-0"));
    fireEvent.click(await screen.findByTestId("route-planner-cta-validate"));

    const rerunButton = await screen.findByLabelText(
      "Re-run route validation checks",
    );
    const copyValidationButton = screen.getByLabelText(
      "Copy validation summary export",
    );

    expect(rerunButton).toBeVisible();
    expect(copyValidationButton).toBeVisible();
    rerunButton.focus();
    fireEvent.keyDown(rerunButton, { key: "Enter", code: "Enter" });
    fireEvent.click(copyValidationButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it("renders station labels with enriched-field fallback when fields are missing", async () => {
    const route = makeRouteResult();
    route.Hops = [
      {
        ...route.Hops[0],
        StationName: "",
        DestStationName: "Legacy Sell Station",
        buy_station_name: "Enriched Buy Station",
        sell_station_name: "",
      },
    ];
    renderRouteBuilder([route]);

    fireEvent.doubleClick(await screen.findByTestId("route-result-row-0"));

    expect(await screen.findByText("Enriched Buy Station")).toBeInTheDocument();
    expect(screen.getByText("Legacy Sell Station")).toBeInTheDocument();
  });
});
