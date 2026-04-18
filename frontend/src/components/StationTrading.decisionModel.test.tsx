import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { StationTrading } from "@/components/StationTrading";
import type { ScanParams, StationTrade } from "@/lib/types";

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

const params: ScanParams = { system_name: "Jita", cargo_capacity: 1000, buy_radius: 0, sell_radius: 0, min_margin: 0, sales_tax_percent: 0, broker_fee_percent: 0 };
const trade: StationTrade = {
  TypeID: 34, TypeName: "Trit", Volume: 1, StationID: 1, StationName: "Jita", RegionID: 1, SystemID: 1,
  BuyPrice: 100, SellPrice: 120, Spread: 20, ProfitPerUnit: 20, MarginPercent: 20, DailyVolume: 100,
  BuyOrderCount: 1, SellOrderCount: 1, BuyVolume: 100, SellVolume: 100, TotalProfit: 1000, DailyProfit: 1000, RealizableDailyProfit: 1000,
  ROI: 1, CapitalRequired: 1000, BuyUnitsPerDay: 10, SellUnitsPerDay: 10, BvSRatio: 1, CTS: 50, SDS: 10, PVI: 10, OBDS: 10, DOS: 2,
  S2BPerDay: 10, BfSPerDay: 10, S2BBfSRatio: 1, PeriodROI: 1, NowROI: 1, VWAP: 110, CI: 1, AvgPrice: 110, PriceHigh: 120, PriceLow: 100,
  IsHighRiskFlag: false, IsExtremePriceFlag: false,
};

describe("StationTrading decision model helpers", () => {
  afterEach(() => cleanup());
  it("renders shared explanation/filter/save interactions", async () => {
    render(<I18nProvider><ToastProvider><StationTrading params={params} loadedResults={[trade]} /></ToastProvider></I18nProvider>);
    expect(await screen.findByText("Rows: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save/Pin pattern" }));
    fireEvent.click(screen.getByRole("button", { name: "Why this recommendation?" }));
    expect(await screen.findByText("Final score")).toBeInTheDocument();
  });
});
