import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";

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

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

function row(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 100,
    TypeName: "Anchor",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyLocationID: 60003760,
    SellPrice: 140,
    SellStation: "Amarr VIII",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    SellLocationID: 60008494,
    ProfitPerUnit: 40,
    MarginPercent: 40,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 400,
    ProfitPerJump: 100,
    BuyJumps: 1,
    SellJumps: 1,
    TotalJumps: 2,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 100,
    RealProfit: 400,
    ...overrides,
  };
}

function renderTable(rows: FlipResult[], onOpenPriceValidation?: (manifest: string) => void) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable
          results={rows}
          scanning={false}
          progress=""
          tradeStateTab="radius"
          onOpenPriceValidation={onOpenPriceValidation}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("ScanResultsTable same-leg rail", () => {
  it("appears after row focus and hides when data clears", async () => {
    const first = row({ TypeID: 1, TypeName: "A" });
    const second = row({ TypeID: 2, TypeName: "B" });
    const view = renderTable([first, second]);

    expect(screen.queryByTestId("same-leg-rail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("A"));
    expect(await screen.findByTestId("same-leg-rail")).toBeInTheDocument();

    view.rerender(
      <I18nProvider>
        <ToastProvider>
          <ScanResultsTable results={[]} scanning={false} progress="" tradeStateTab="radius" />
        </ToastProvider>
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.queryByTestId("same-leg-rail")).not.toBeInTheDocument());
  });

  it("rail quick verify dispatches manifest and Fill Cargo excludes off-leg rows", async () => {
    const onOpenPriceValidation = vi.fn();
    const anchor = row({ TypeID: 10, TypeName: "Anchor" });
    const sameLeg = row({ TypeID: 11, TypeName: "Same Leg" });
    const offLeg = row({ TypeID: 12, TypeName: "Off Leg", SellLocationID: 60008495, SellStation: "Dodixie" });
    renderTable([anchor, sameLeg, offLeg], onOpenPriceValidation);

    fireEvent.click(screen.getAllByText("Anchor")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Quick Verify" }));
    expect(onOpenPriceValidation).toHaveBeenCalledTimes(1);
    expect(onOpenPriceValidation.mock.calls[0]?.[0]).toContain("Anchor");

    fireEvent.click(screen.getByRole("button", { name: "Fill Cargo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open Price Validation" }));
    const manifest =
      onOpenPriceValidation.mock.calls[
        onOpenPriceValidation.mock.calls.length - 1
      ]?.[0] as string;
    expect(manifest).toContain("Anchor");
    expect(manifest).toContain("Same Leg");
    expect(manifest).not.toContain("Off Leg");
  });

  it("renders lock chips, supports clear, and lock filters rows", async () => {
    const anchor = row({ TypeID: 20, TypeName: "Anchor" });
    const sameBuyDifferentSell = row({ TypeID: 21, TypeName: "Different Sell", SellLocationID: 60008495, SellStation: "Dodixie" });
    const differentBuy = row({ TypeID: 22, TypeName: "Different Buy", BuyLocationID: 60000001, BuyStation: "Rens" });
    renderTable([anchor, sameBuyDifferentSell, differentBuy]);

    fireEvent.click(screen.getAllByText("Anchor")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Lock buy" }));

    expect(await screen.findByRole("button", { name: /Buy lock #60003760/i })).toBeInTheDocument();
    expect(screen.queryAllByText("Anchor").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Different Sell").length).toBeGreaterThan(0);
    const tableContainer = document.querySelector(".table-scroll-container");
    expect(tableContainer?.textContent ?? "").not.toContain("Rens");

    fireEvent.click(screen.getByRole("button", { name: /Buy lock #60003760/i }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Buy lock #60003760/i })).not.toBeInTheDocument());
  });
});
