import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { StationTrading } from "@/components/StationTrading";
import type { ScanParams, StationTrade } from "@/lib/types";
import { addPinnedOpportunity, removePinnedOpportunity } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  clearStationTradeStates: vi.fn(async () => undefined),
  deleteStationTradeStates: vi.fn(async () => undefined),
  getStationCommand: vi.fn(async () => ({ rows: [], summary: null })),
  getStations: vi.fn(async () => ({ stations: [], region_id: 10000002, system_id: 30000142 })),
  getStructures: vi.fn(async () => []),
  getStationTradeStates: vi.fn(async () => []),
  scanStation: vi.fn(async () => []),
  setStationTradeState: vi.fn(async () => undefined),
  getWatchlist: vi.fn(async () => []),
  getBanlistItems: vi.fn(async () => []),
  getBannedStations: vi.fn(async () => []),
  addPinnedOpportunity: vi.fn(async () => []),
  addToWatchlist: vi.fn(async () => undefined),
  listPinnedOpportunities: vi.fn(async () => []),
  removePinnedOpportunity: vi.fn(async () => ({ status: "deleted" })),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
  removeFromWatchlist: vi.fn(async () => undefined),
  openMarketInGame: vi.fn(async () => undefined),
  setWaypointInGame: vi.fn(async () => undefined),
  rebootStationCache: vi.fn(async () => ({ cleared: 0 })),
}));

const params: ScanParams = {
  system_name: "Jita",
  cargo_capacity: 1000,
  buy_radius: 0,
  sell_radius: 0,
  min_margin: 0,
  sales_tax_percent: 0,
  broker_fee_percent: 0,
};

function makeTrade(overrides: Partial<StationTrade> = {}): StationTrade {
  return {
    TypeID: 34,
    TypeName: "Tritanium",
    Volume: 0.01,
    StationID: 60003760,
    StationName: "Jita IV - Moon 4",
    RegionID: 10000002,
    SystemID: 30000142,
    BuyPrice: 1,
    SellPrice: 2,
    Spread: 1,
    ProfitPerUnit: 1,
    MarginPercent: 10,
    DailyVolume: 1000,
    BuyOrderCount: 10,
    SellOrderCount: 10,
    BuyVolume: 1000,
    SellVolume: 1000,
    TotalProfit: 100,
    DailyProfit: 100,
    RealizableDailyProfit: 100,
    ROI: 5,
    CapitalRequired: 10000,
    BuyUnitsPerDay: 100,
    SellUnitsPerDay: 100,
    BvSRatio: 1,
    CTS: 40,
    SDS: 10,
    PVI: 10,
    OBDS: 10,
    DOS: 5,
    S2BPerDay: 100,
    BfSPerDay: 50,
    S2BBfSRatio: 2,
    PeriodROI: 3,
    NowROI: 2,
    VWAP: 1.5,
    CI: 10,
    AvgPrice: 1.4,
    PriceHigh: 1.8,
    PriceLow: 1.0,
    IsHighRiskFlag: false,
    IsExtremePriceFlag: false,
    ...overrides,
  };
}

describe("StationTrading opportunity score", () => {
  afterEach(() => cleanup());

  it("renders score column and explanation popover", async () => {
    render(
      <I18nProvider>
        <ToastProvider>
          <StationTrading params={params} loadedResults={[makeTrade()]} />
        </ToastProvider>
      </I18nProvider>,
    );
    expect(screen.getAllByText("Score").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("Why this score?"));
    expect(await screen.findByText("Final score")).toBeInTheDocument();
  });
});

describe("StationTrading pinning", () => {
  it("renders pin button and pins/unpins with stable key", async () => {
    render(
      <I18nProvider>
        <ToastProvider>
          <StationTrading params={params} loadedResults={[makeTrade()]} />
        </ToastProvider>
      </I18nProvider>,
    );
    const pinBtn = await screen.findByLabelText("Pin row");
    fireEvent.click(pinBtn);
    expect(addPinnedOpportunity).toHaveBeenCalled();
    const payload = vi.mocked(addPinnedOpportunity).mock.calls[0][0];
    const key = payload.opportunity_key;
    expect(payload.source).toBe("station");
    expect(payload.metrics.volume).toBeGreaterThanOrEqual(0);
    fireEvent.click(await screen.findByLabelText("Unpin row"));
    expect(removePinnedOpportunity).toHaveBeenCalledWith(key);
  });
});
