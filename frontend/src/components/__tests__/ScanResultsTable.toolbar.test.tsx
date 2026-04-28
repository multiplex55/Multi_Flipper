import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";
import { createSessionStationFilters } from "@/lib/banlistFilters";

vi.mock("@/lib/api", () => ({
  addToWatchlist: vi.fn(async () => undefined),
  addPinnedOpportunity: vi.fn(async () => []),
  clearStationTradeStates: vi.fn(async () => undefined),
  deleteStationTradeStates: vi.fn(async () => undefined),
  getStationTradeStates: vi.fn(async () => []),
  getGankCheck: vi.fn(async () => ({ route: [] })),
  getGankCheckBatch: vi.fn(async () => []),
  getWatchlist: vi.fn(async () => []),
  openMarketInGame: vi.fn(async () => undefined),
  listPinnedOpportunities: vi.fn(async () => []),
  rebootStationCache: vi.fn(async () => undefined),
  removeFromWatchlist: vi.fn(async () => undefined),
  removePinnedOpportunity: vi.fn(async () => ({ status: "deleted" })),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
  setStationTradeState: vi.fn(async () => undefined),
  setWaypointInGame: vi.fn(async () => undefined),
}));

const ADVANCED_TOOLBAR_VISIBLE_STORAGE_KEY =
  "eve-radius-advanced-toolbar-visible:v1";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 101,
    TypeName: "Item 101",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 125,
    SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 25,
    MarginPercent: 25,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 250,
    ProfitPerJump: 20,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 0,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 50,
    ...overrides,
  };
}

function renderTable(results: FlipResult[]) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable
          results={results}
          scanning={false}
          progress=""
          tradeStateTab="radius"
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ScanResultsTable more controls toolbar", () => {
  it("is hidden by default and keeps primary controls visible", () => {
    renderTable([makeRow()]);

    expect(screen.getByRole("button", { name: /more controls ▸/i })).toBeInTheDocument();
    expect(screen.queryByTitle("Quick profile preset")).not.toBeInTheDocument();
    expect(screen.queryByText("Route: All")).not.toBeInTheDocument();
    expect(screen.getByTitle("Export CSV")).toBeInTheDocument();
    expect(screen.getByTitle("Copy table")).toBeInTheDocument();
    expect(screen.getByTitle("Column setup")).toBeInTheDocument();
  });

  it("shows and hides more controls when toggled", () => {
    renderTable([makeRow()]);

    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));
    expect(screen.getByRole("button", { name: /more controls ▾/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /endpoint prefs ▸/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /more controls ▾/i }));
    expect(screen.getByRole("button", { name: /more controls ▸/i })).toBeInTheDocument();
    expect(screen.queryByTitle("Quick profile preset")).not.toBeInTheDocument();
  });

  it("restores more controls visibility from localStorage", () => {
    localStorage.setItem(ADVANCED_TOOLBAR_VISIBLE_STORAGE_KEY, "1");

    renderTable([makeRow()]);

    expect(screen.getByRole("button", { name: /more controls ▾/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /endpoint prefs ▸/i })).toBeInTheDocument();
  });

  it("toggles ordering mode and updates pins-first control state", () => {
    renderTable([makeRow(), makeRow({ TypeID: 102, TypeName: "Item 102" })]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    const smartButton = screen.getByTestId("ordering-mode-toggle:smart");
    const columnOnlyButton = screen.getByTestId("ordering-mode-toggle:column_only");
    const pinsFirstToggle = screen.getByTestId("pins-first-toggle") as HTMLInputElement;

    expect(smartButton).toBeInTheDocument();
    expect(columnOnlyButton).toBeInTheDocument();
    expect(pinsFirstToggle.checked).toBe(true);
    expect(pinsFirstToggle.disabled).toBe(false);

    fireEvent.click(columnOnlyButton);
    expect(pinsFirstToggle.disabled).toBe(true);

    fireEvent.click(smartButton);
    expect(pinsFirstToggle.disabled).toBe(false);

    fireEvent.click(pinsFirstToggle);
    expect(pinsFirstToggle.checked).toBe(false);
  });

  it("shows ordering chip by default in radius and updates when toggled", () => {
    renderTable([makeRow()]);
    expect(screen.getByText(/^Ordering: Smart/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));
    fireEvent.click(screen.getByTestId("ordering-mode-toggle:column_only"));
    expect(screen.getByText(/^Ordering: Column only/)).toBeInTheDocument();
  });

  it("opens more controls and focuses ordering group when ordering chip is clicked", () => {
    renderTable([makeRow()]);
    fireEvent.click(screen.getByText(/^Ordering: Smart/));
    expect(screen.getByRole("button", { name: /more controls ▾/i })).toBeInTheDocument();
    const orderingGroup = screen.getByTestId("radius-control-menu-group:ordering");
    expect(orderingGroup).toHaveFocus();
  });

  it("starts with smart toggle active and column-only inactive", () => {
    renderTable([makeRow()]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));
    expect(screen.getByTestId("ordering-mode-toggle:smart")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("ordering-mode-toggle:column_only")).toHaveAttribute("aria-pressed", "false");
  });

  it("hydrates ordering preferences from localStorage", () => {
    localStorage.setItem("eve-scan-ui-state:v1:radius:default:ordering", JSON.stringify({
      orderingMode: "column_only",
      pinsFirst: false,
      trackedFirst: false,
    }));
    renderTable([makeRow()]);
    expect(screen.getByText(/^Ordering: Column only/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));
    expect(screen.getByTestId("ordering-mode-toggle:column_only")).toHaveAttribute("aria-pressed", "true");
  });

  it("renders ordering stack for smart and column-only modes", () => {
    renderTable([makeRow(), makeRow({ TypeID: 102, TypeName: "Item 102" })]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    const orderingStack = screen.getByTestId("ordering-stack");
    expect(orderingStack).toBeInTheDocument();
    expect(screen.getByText("Order: Smart")).toBeInTheDocument();
    expect(screen.getByText("Endpoint rank")).toBeInTheDocument();
    expect(screen.getByText(/Desc/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ordering-mode-toggle:column_only"));
    expect(screen.getByText("Order: Column only")).toBeInTheDocument();
    expect(screen.queryByText("Endpoint rank")).not.toBeInTheDocument();
  });

  it("updates ordering stack chips when smart contributors toggle", () => {
    const filters = createSessionStationFilters();
    filters.deprioritizedStationIds.add(60003760);
    render(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable
            results={[makeRow()]}
            scanning={false}
            progress=""
            tradeStateTab="radius"
            sessionStationFilters={filters}
          />
        </ToastProvider>
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    expect(screen.getByText("Session deprioritized")).toBeInTheDocument();
    expect(screen.queryByText("Tracked first")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tracked ▸/i }));
    fireEvent.click(screen.getByLabelText("Tracked first"));
    expect(
      screen.getByTestId("ordering-stack-chip:Tracked first"),
    ).toBeInTheDocument();
  });

  it("shows smart-mode sort tooltip only while smart ordering is active", () => {
    renderTable([makeRow()]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    expect(
      screen.getByTitle(/Smart ordering layers .* this column sort/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ordering-mode-toggle:column_only"));
    expect(
      screen.queryByTitle(/Smart ordering layers .* this column sort/i),
    ).not.toBeInTheDocument();
  });

  it("resets only implicit-ordering controls when requested", () => {
    renderTable([
      makeRow({
        TypeID: 201,
        TypeName: "Hub constrained",
        BuySystemName: "Jita",
        BuyLocationID: 60003760,
      }),
      makeRow({
        TypeID: 202,
        TypeName: "Structure sell",
        BuySystemName: "Perimeter",
        SellLocationID: 1_000_000_000_123,
        SellStation: "Perimeter Keepstar",
      }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    fireEvent.click(screen.getByRole("button", { name: /tracked ▸/i }));
    fireEvent.click(screen.getByLabelText("Tracked first"));
    fireEvent.click(screen.getByRole("button", { name: /endpoint prefs ▸/i }));
    const endpointPanel = screen.getByRole("dialog", {
      name: /endpoint preferences/i,
    });
    fireEvent.change(within(endpointPanel).getByDisplayValue("Rank-only"), {
      target: { value: "hide" },
    });
    fireEvent.change(within(endpointPanel).getByTitle("Sell endpoint type selector"), {
      target: { value: "structure" },
    });
    fireEvent.click(screen.getByTestId("pins-first-toggle"));

    fireEvent.click(screen.getByTestId("ordering-clean-column-sort-button"));

    expect(screen.getByTestId("ordering-mode-toggle:column_only")).toHaveClass(
      "border-eve-accent/70",
    );
    expect(screen.queryByText("Tracked first")).not.toBeInTheDocument();
    expect(screen.getByTestId("pins-first-toggle")).not.toBeChecked();
    expect(
      within(endpointPanel).getByDisplayValue("Disabled"),
    ).toBeInTheDocument();
    expect(screen.getByText("Hub constrained")).toBeInTheDocument();
    expect(screen.getByText("Structure sell")).toBeInTheDocument();
  });

  it("preserves explicit filters and active sort when implicit ordering is reset", () => {
    renderTable([makeRow(), makeRow({ TypeID: 102, TypeName: "Item 102", RealProfit: 800 })]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    fireEvent.click(screen.getByTestId("urgency-sort-button"));
    fireEvent.click(screen.getByTestId("urgency-filter-chip:aging"));
    const realProfitInput = screen
      .getAllByTitle("Real Profit")
      .find((el) => el.tagName.toLowerCase() === "input");
    if (!realProfitInput) {
      throw new Error("Real Profit filter input not found");
    }
    fireEvent.change(realProfitInput, { target: { value: ">300" } });

    expect(screen.getByTestId("active-filter-chip:urgency-filter")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2")).toBeInTheDocument();
    expect(screen.getByTestId("urgency-sort-button")).toHaveClass(
      "border-eve-accent/70",
    );

    fireEvent.click(screen.getByTestId("ordering-clean-column-sort-button"));

    expect(screen.getByTestId("active-filter-chip:urgency-filter")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2")).toBeInTheDocument();
    expect(screen.getByTestId("urgency-sort-button")).toHaveClass(
      "border-eve-accent/70",
    );
  });

  it("does not expose route safety selector in more-controls filtering controls", () => {
    renderTable([makeRow(), makeRow({ TypeID: 102, TypeName: "Item 102", BuySystemID: 30002187, SellSystemID: 30000142 })]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    expect(screen.queryByTestId("route-safety-filter-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("active-filter-chip:route-safety")).not.toBeInTheDocument();
  });

  it("toggles urgency toolbar sort direction and updates directional label", () => {
    renderTable([makeRow(), makeRow({ TypeID: 102, TypeName: "Item 102", RealProfit: 800 })]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    const urgencySortButton = screen.getByTestId("urgency-sort-button");
    expect(urgencySortButton).toHaveTextContent("Urgency ↓");

    fireEvent.click(urgencySortButton);
    expect(urgencySortButton).toHaveTextContent("Urgency ↓");
    expect(urgencySortButton).toHaveClass("border-eve-accent/70");

    fireEvent.click(urgencySortButton);
    expect(urgencySortButton).toHaveTextContent("Urgency ↑");

    fireEvent.click(urgencySortButton);
    expect(urgencySortButton).toHaveTextContent("Urgency ↓");
  });

  it("keeps urgency direction synchronized between column header and toolbar control", () => {
    renderTable([makeRow(), makeRow({ TypeID: 102, TypeName: "Item 102", RealProfit: 800 })]);
    fireEvent.click(screen.getByTitle("Column setup"));
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    const urgencySortButton = screen.getByTestId("urgency-sort-button");
    const urgencyHeader = screen
      .getAllByRole("columnheader")
      .find((el) => /urgency/i.test(el.textContent ?? ""));

    expect(urgencyHeader).toBeTruthy();
    expect(urgencySortButton).toHaveTextContent("Urgency ↓");

    fireEvent.click(urgencyHeader!);
    expect(urgencySortButton).toHaveTextContent("Urgency ↓");

    fireEvent.click(urgencyHeader!);
    expect(urgencySortButton).toHaveTextContent("Urgency ↑");

    fireEvent.click(urgencySortButton);
    expect(urgencySortButton).toHaveTextContent("Urgency ↓");

    fireEvent.click(urgencySortButton);
    expect(urgencySortButton).toHaveTextContent("Urgency ↑");
  });

  it("exposes accessible grouping labels for filtering and ranking controls", () => {
    renderTable([makeRow()]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    expect(
      screen.getByRole("group", { name: "Filtering controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Ranking and ordering controls" }),
    ).toBeInTheDocument();
  });

  it("applies scoring recipes to update sort and filter state", () => {
    renderTable([makeRow(), makeRow({ TypeID: 102, TypeName: "Item 102", RealProfit: 800 })]);
    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));

    fireEvent.click(screen.getByTestId("scoring-recipe:fragile_first"));

    expect(screen.getByTestId("active-filter-chip:urgency-filter")).toHaveTextContent(
      "Urgency: fragile",
    );
    expect(screen.getByTestId("urgency-sort-button")).toHaveClass(
      "border-eve-accent/70",
    );
  });
});
