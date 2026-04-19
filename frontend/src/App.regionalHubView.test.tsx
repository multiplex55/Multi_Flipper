import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const { mockGetConfig, mockScanRegionalDayTrader } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(async () => ({ system_name: "Jita", target_market_system: "Jita" })),
  mockScanRegionalDayTrader: vi.fn(async () => ({
    rows: [
      { TypeID: 34, TypeName: "Tritanium", BuySystemID: 30000142, BuyStation: "Jita", BuySystemName: "Jita", SellStation: "Amarr", SellSystemName: "Amarr", SellSystemID: 30002187, Volume: 1, BuyPrice: 1, SellPrice: 2, ProfitPerUnit: 1, MarginPercent: 10, UnitsToBuy: 1, BuyOrderRemain: 1, SellOrderRemain: 1, TotalProfit: 1, ProfitPerJump: 1, BuyJumps: 0, SellJumps: 1, TotalJumps: 1, DailyVolume: 1, Velocity: 1, PriceTrend: 0, BuyCompetitors: 0, SellCompetitors: 0, DailyProfit: 1 },
    ],
    hubs: [
      { source_system_id: 30000142, source_system_name: "Jita", source_region_id: 10000002, source_region_name: "The Forge", security: 0.9, purchase_units: 1, source_units: 1, target_demand_per_day: 1, target_supply_units: 1, target_dos: 1, assets: 0, active_orders: 0, target_now_profit: 10, target_period_profit: 12, capital_required: 100, shipping_cost: 5, item_count: 1, items: [
        { type_id: 34, type_name: "Tritanium", source_system_id: 30000142, source_system_name: "Jita", source_station_name: "Jita", source_location_id: 60003760, source_region_id: 10000002, source_region_name: "The Forge", target_system_id: 30002187, target_system_name: "Amarr", target_station_name: "Amarr", target_location_id: 60008494, target_region_id: 10000043, target_region_name: "Domain", purchase_units: 1, source_units: 1, target_demand_per_day: 1, target_supply_units: 1, target_dos: 1, assets: 0, active_orders: 0, source_avg_price: 1, target_now_price: 2, target_period_price: 2, target_now_profit: 1, target_period_profit: 1, roi_now: 1, roi_period: 1, capital_required: 1, item_volume: 1, shipping_cost: 0, jumps: 1, margin_now: 1, margin_period: 1 },
      ] },
    ],
    summary: { count: 1, targetRegionName: "The Forge", periodDays: 14 },
  })),
}));

vi.mock("@/lib/api", () => ({
  applyAppUpdate: vi.fn(),
  addPinnedOpportunity: vi.fn(async () => ({})),
  listPinnedOpportunities: vi.fn(async () => []),
  removePinnedOpportunity: vi.fn(async () => ({})),
  subscribePinnedOpportunityChanges: vi.fn(() => () => {}),
  getUpdateCheckStatus: vi.fn(),
  getConfig: () => mockGetConfig(),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  updateConfig: vi.fn(async () => ({})),
  scan: vi.fn(async () => []),
  scanMultiRegion: vi.fn(async () => []),
  scanRegionalDayTrader: mockScanRegionalDayTrader,
  scanContracts: vi.fn(async () => []),
  testAlertChannels: vi.fn(),
  getWatchlist: vi.fn(async () => []),
  getBanlistItems: vi.fn(async () => []),
  getBannedStations: vi.fn(async () => []),
  rebootStationCache: vi.fn(async () => ({ ok: true, cleared: 1 })),
  getCharacterLocation: vi.fn(async () => null),
}));

vi.mock("@/lib/useAuth", () => ({ useAuth: () => ({ authStatus: { logged_in: false, characters: [] }, loginPolling: false, handleLogin: vi.fn(), handleLogout: vi.fn(), handleSelectCharacter: vi.fn(async () => ({})), handleDeleteCharacter: vi.fn(async () => ({})), refreshAuthStatus: vi.fn(async () => ({})) }) }));
vi.mock("@/lib/useVersionCheck", () => ({ useVersionCheck: () => ({ appVersion: "test", latestVersion: "test", hasUpdate: false, dismissedForSession: false, autoUpdateSupported: false, platform: "web", releaseURL: "" }) }));
vi.mock("@/lib/useEsiStatus", () => ({ useEsiStatus: () => ({ esiAvailable: true }) }));
vi.mock("@/lib/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/components/Toast", () => ({ useGlobalToast: () => ({ addToast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, language: "en", setLanguage: vi.fn() }) }));
vi.mock("@/components/ParametersPanel", () => ({ ParametersPanel: () => null }));
vi.mock("@/components/StatusBar", () => ({ StatusBar: () => null }));
vi.mock("@/components/ContractParametersPanel", () => ({ ContractParametersPanel: () => null }));
vi.mock("@/components/ScanResultsTable", () => ({
  ScanResultsTable: ({ results, tradeStateTab }: { results: unknown[]; tradeStateTab?: string }) => (
    <div data-testid={tradeStateTab === "region" ? "region-items-table" : "radius-items-table"}>rows:{results.length}</div>
  ),
}));
vi.mock("@/components/RegionalDayTraderTable", () => ({ RegionalDayTraderTable: ({ hubs, onOpenItemsAtHub }: { hubs: Array<{ source_system_name: string }>; onOpenItemsAtHub?: (hub: never) => void }) => <div><div data-testid="region-hubs-table">hubs:{hubs.length}</div><button onClick={() => onOpenItemsAtHub?.(hubs[0] as never)}>open-hub-items</button></div> }));
vi.mock("@/components/ContractResultsTable", () => ({ ContractResultsTable: () => null }));
vi.mock("@/components/RadiusRouteWorkspace", () => ({ RadiusRouteWorkspace: () => null }));
vi.mock("@/components/WatchlistTab", () => ({ WatchlistTab: () => null }));
vi.mock("@/components/BanlistTab", () => ({ BanlistTab: () => null }));
vi.mock("@/components/StationTrading", () => ({ StationTrading: () => null }));
vi.mock("@/components/IndustryTab", () => ({ IndustryTab: () => null }));
vi.mock("@/components/WarTracker", () => ({ WarTracker: () => null }));
vi.mock("@/components/PlexTab", () => ({ PlexTab: () => null }));
vi.mock("@/components/PinnedOpportunitiesTab", () => ({ PinnedOpportunitiesTab: () => null }));
vi.mock("@/components/ScanHistory", () => ({ ScanHistory: () => null }));
vi.mock("@/components/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/KeyboardShortcutsHelp", () => ({ KeyboardShortcutsHelp: () => null }));
vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/components/ThemeSwitcher", () => ({ ThemeSwitcher: () => null }));
vi.mock("@/components/Modal", () => ({ Modal: () => null }));
vi.mock("@/components/CharacterPopup", () => ({ CharacterPopup: () => null }));
vi.mock("@/components/TopActionButtons", () => ({ TopActionButtons: () => null }));
vi.mock("@/components/RadiusColumnGuideModal", () => ({ RadiusColumnGuideModal: () => null }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("eve-flipper-active-tab", "region");
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ patrons: [] }) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App regional hubs view", () => {
  it("stores regional rows + hubs and toggles items/hubs views", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));

    await waitFor(() => expect(mockScanRegionalDayTrader).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("region-items-table")).toHaveTextContent("rows:1");

    fireEvent.click(screen.getByRole("button", { name: "Hubs" }));
    expect(await screen.findByTestId("region-hubs-table")).toHaveTextContent("hubs:1");
  });

  it("open items at this hub switches back to items view", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(mockScanRegionalDayTrader).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Hubs" }));
    fireEvent.click(screen.getByRole("button", { name: "open-hub-items" }));

    expect(await screen.findByTestId("region-items-table")).toBeInTheDocument();
  });
});
