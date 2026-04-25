import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionStationFilters } from "@/lib/banlistFilters";
import { buildFlipResult, renderWithProviders } from "@/test/utils/scanResultsFixtures";
import { ScanResultsTable } from "@/components/ScanResultsTable";

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

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderTable(results: ReturnType<typeof buildFlipResult>[], sessionFilters?: ReturnType<typeof createSessionStationFilters>) {
  return renderWithProviders(
    <ScanResultsTable
      results={results}
      scanning={false}
      progress=""
      tradeStateTab="radius"
      sessionStationFilters={sessionFilters}
    />,
  );
}

function expectTypeNameOrder(names: string[]) {
  const rows = screen.getAllByRole("row");
  const seen: string[] = [];
  for (const row of rows) {
    const text = row.textContent ?? "";
    for (const name of names) {
      if (text.includes(name) && !seen.includes(name)) {
        seen.push(name);
      }
    }
  }
  expect(seen).toEqual(names);
}

describe("ScanResultsTable ordering flows", () => {
  it("supports sort mode toggles, endpoint mode/preset changes, and reset invariants with disclosure chips", () => {
    const sessionFilters = createSessionStationFilters();
    sessionFilters.deprioritizedStationIds.add(60003760);
    renderTable([
      buildFlipResult({ TypeID: 401, TypeName: "LowPinned", RealProfit: 20 }),
      buildFlipResult({ TypeID: 402, TypeName: "MidTracked", RealProfit: 120 }),
      buildFlipResult({ TypeID: 403, TypeName: "HighPlain", RealProfit: 800, BuySystemName: "Perimeter" }),
    ], sessionFilters);

    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));
    expect(screen.getByTestId("ordering-stack-chip:Order: Smart")).toBeInTheDocument();
    expect(screen.getByTestId("ordering-stack-chip:Session deprioritized")).toBeInTheDocument();

    const realProfitHeader = screen
      .getAllByTitle(/Real Profit/i)
      .find((el) => el.tagName.toLowerCase() === "th");
    expect(realProfitHeader).toBeTruthy();
    fireEvent.click(realProfitHeader!);

    const directionChipBefore = screen.getByTestId("ordering-stack").textContent ?? "";
    expect(directionChipBefore).toMatch(/Asc|Desc/i);

    fireEvent.click(screen.getByTestId("ordering-mode-toggle:column_only"));
    expect(screen.getByTestId("ordering-stack-chip:Order: Column only")).toBeInTheDocument();
    expect(screen.queryByTestId("ordering-stack-chip:Endpoint rank")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /endpoint prefs ▸/i }));
    const endpointPanel = screen.getByRole("dialog", { name: /endpoint preferences/i });
    const endpointModeSelect = within(endpointPanel).getAllByRole("combobox")[0];
    fireEvent.change(endpointModeSelect, { target: { value: "rank_only" } });
    fireEvent.change(within(endpointPanel).getByTitle("Quick profile preset"), {
      target: { value: "neutral" },
    });

    expect(screen.queryByTestId("ordering-stack-chip:Endpoint rank")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ordering-mode-toggle:smart"));
    expect(screen.getByTestId("ordering-stack-chip:Endpoint rank")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reset-implicit-ordering-button"));

    expect(screen.getByTestId("ordering-mode-toggle:column_only")).toHaveClass("border-eve-accent/70");
    expect(within(endpointPanel).getByDisplayValue("Disabled")).toBeInTheDocument();
    expect(screen.queryByTestId("ordering-stack-chip:Endpoint rank")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ordering-stack-chip:Tracked first")).not.toBeInTheDocument();
    expect(screen.getByTestId("pins-first-toggle")).not.toBeChecked();
    expectTypeNameOrder(["HighPlain", "MidTracked", "LowPinned"]);
  });

  it("regresses hidden smart-rank influence: column-only order stays pure across endpoint mode changes", () => {
    renderTable([
      buildFlipResult({ TypeID: 501, TypeName: "LowerColumnValue", RealProfit: 10, BuySystemName: "Perimeter" }),
      buildFlipResult({ TypeID: 502, TypeName: "HigherColumnValue", RealProfit: 500, BuySystemName: "Jita", SellSystemName: "Perimeter" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /more controls ▸/i }));
    const realProfitHeader = screen
      .getAllByTitle(/Real Profit/i)
      .find((el) => el.tagName.toLowerCase() === "th");
    expect(realProfitHeader).toBeTruthy();
    fireEvent.click(realProfitHeader!);
    if ((screen.getByTestId("ordering-stack").textContent ?? "").includes("Real Profit Asc")) {
      fireEvent.click(realProfitHeader!);
    }

    fireEvent.click(screen.getByTestId("ordering-mode-toggle:column_only"));

    fireEvent.click(screen.getByRole("button", { name: /endpoint prefs ▸/i }));
    const endpointPanel = screen.getByRole("dialog", { name: /endpoint preferences/i });
    const endpointModeSelect = within(endpointPanel).getAllByRole("combobox")[0];
    fireEvent.change(endpointModeSelect, { target: { value: "rank_only" } });

    expect(screen.getByTestId("ordering-stack-chip:Order: Column only")).toBeInTheDocument();
    expect(screen.queryByTestId("ordering-stack-chip:Endpoint rank")).not.toBeInTheDocument();
    expectTypeNameOrder(["HigherColumnValue", "LowerColumnValue"]);

    const smartTooltip = screen.queryByTitle(/Smart ordering layers .* this column sort/i);
    expect(smartTooltip).not.toBeInTheDocument();
  });
});
