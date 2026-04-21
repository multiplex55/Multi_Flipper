import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const { mockScan, mockScanRegionalDayTrader } = vi.hoisted(() => ({
  mockScan: vi.fn(async () => ([
    {
      TypeID: 34, TypeName: "Tritanium", Volume: 1, BuyPrice: 1, SellPrice: 2,
      BuyStation: "Jita 4-4", BuySystemName: "Jita", BuySystemID: 30000142,
      SellStation: "Amarr", SellSystemName: "Amarr", SellSystemID: 30002187,
      ProfitPerUnit: 1, MarginPercent: 10, UnitsToBuy: 1, BuyOrderRemain: 1, SellOrderRemain: 1,
      TotalProfit: 1, ProfitPerJump: 1, BuyJumps: 0, SellJumps: 1, TotalJumps: 1, DailyVolume: 1,
      Velocity: 1, PriceTrend: 0, BuyCompetitors: 0, SellCompetitors: 0, DailyProfit: 1,
    },
    {
      TypeID: 35, TypeName: "Pyerite", Volume: 1, BuyPrice: 1, SellPrice: 2,
      BuyStation: "Perimeter", BuySystemName: "Perimeter", BuySystemID: 30000144,
      SellStation: "Jita 4-4", SellSystemName: "Jita", SellSystemID: 30000142,
      ProfitPerUnit: 1, MarginPercent: 10, UnitsToBuy: 1, BuyOrderRemain: 1, SellOrderRemain: 1,
      TotalProfit: 1, ProfitPerJump: 1, BuyJumps: 0, SellJumps: 1, TotalJumps: 1, DailyVolume: 1,
      Velocity: 1, PriceTrend: 0, BuyCompetitors: 0, SellCompetitors: 0, DailyProfit: 1,
    },
  ])),
  mockScanRegionalDayTrader: vi.fn(async () => ({
    rows: [
      {
        TypeID: 99, TypeName: "Mexallon", Volume: 1, BuyPrice: 1, SellPrice: 2, BuyStation: "Jita", BuySystemName: "Jita", BuySystemID: 30000142,
        SellStation: "Amarr", SellSystemName: "Amarr", SellSystemID: 30002187, ProfitPerUnit: 1, MarginPercent: 10, UnitsToBuy: 1, BuyOrderRemain: 1,
        SellOrderRemain: 1, TotalProfit: 1, ProfitPerJump: 1, BuyJumps: 0, SellJumps: 1, TotalJumps: 1, DailyVolume: 1, Velocity: 1, PriceTrend: 0,
        BuyCompetitors: 0, SellCompetitors: 0, DailyProfit: 1,
      },
      {
        TypeID: 100, TypeName: "Isogen", Volume: 1, BuyPrice: 1, SellPrice: 2, BuyStation: "Perimeter", BuySystemName: "Perimeter", BuySystemID: 30000144,
        SellStation: "Amarr", SellSystemName: "Amarr", SellSystemID: 30002187, ProfitPerUnit: 1, MarginPercent: 10, UnitsToBuy: 1, BuyOrderRemain: 1,
        SellOrderRemain: 1, TotalProfit: 1, ProfitPerJump: 1, BuyJumps: 0, SellJumps: 1, TotalJumps: 1, DailyVolume: 1, Velocity: 1, PriceTrend: 0,
        BuyCompetitors: 0, SellCompetitors: 0, DailyProfit: 1,
      },
    ],
    hubs: [],
    summary: { count: 2, targetRegionName: "The Forge", periodDays: 14 },
  })),
}));

vi.mock("@/lib/api", () => ({
  applyAppUpdate: vi.fn(),
  addPinnedOpportunity: vi.fn(async () => ({})),
  listPinnedOpportunities: vi.fn(async () => []),
  removePinnedOpportunity: vi.fn(async () => ({})),
  subscribePinnedOpportunityChanges: vi.fn(() => () => {}),
  getUpdateCheckStatus: vi.fn(),
  getConfig: vi.fn(async () => ({ system_name: "Jita", target_market_system: "Jita" })),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  updateConfig: vi.fn(async () => ({})),
  scan: mockScan,
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

vi.mock("@/lib/useAuth", () => ({ useAuth: () => ({ authStatus: { logged_in: false, character_id: null, character_name: "", characters: [] }, loginPolling: false, handleLogin: vi.fn(), handleLogout: vi.fn(), handleSelectCharacter: vi.fn(async () => ({})), handleDeleteCharacter: vi.fn(async () => ({})), refreshAuthStatus: vi.fn(async () => ({})) }) }));
vi.mock("@/lib/useVersionCheck", () => ({ useVersionCheck: () => ({ appVersion: "test", latestVersion: "test", hasUpdate: false, dismissedForSession: false, autoUpdateSupported: false, platform: "web", releaseURL: "" }) }));
vi.mock("@/lib/useEsiStatus", () => ({ useEsiStatus: () => ({ esiAvailable: true }) }));
vi.mock("@/lib/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/components/Toast", () => ({ useGlobalToast: () => ({ addToast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, language: "en", setLanguage: vi.fn() }) }));
vi.mock("@/components/ParametersPanel", () => ({ ParametersPanel: () => null }));
vi.mock("@/components/StatusBar", () => ({ StatusBar: () => null }));
vi.mock("@/components/ContractParametersPanel", () => ({ ContractParametersPanel: () => null }));
vi.mock("@/components/ScanResultsTable", () => ({
  ScanResultsTable: ({ results, tradeStateTab }: { results: Array<{ BuySystemID: number; SellSystemID: number }>; tradeStateTab?: string }) => (
    <div data-testid={`${tradeStateTab}-items-table`}>{results.map((row) => `${row.BuySystemID}->${row.SellSystemID}`).join(",")}</div>
  ),
}));
vi.mock("@/components/RadiusHubSummaryPanel", () => ({
  RadiusHubSummaryPanel: ({ onOpenHubRows }: { onOpenHubRows?: (hub: { system_id: number; system_name: string }, side: "buy" | "sell") => void }) => (
    <div>
      <button onClick={() => onOpenHubRows?.({ system_id: 30000142, system_name: "Jita" }, "buy")}>open-radius-buy</button>
      <button onClick={() => onOpenHubRows?.({ system_id: 30002187, system_name: "Amarr" }, "sell")}>open-radius-sell</button>
    </div>
  ),
}));
vi.mock("@/components/RegionalBuyHubTable", () => ({
  RegionalBuyHubTable: ({ onOpenItemsAtHub }: { onOpenItemsAtHub?: (hub: { source_system_id: number }) => void }) => (
    <button onClick={() => onOpenItemsAtHub?.({ source_system_id: 30000142 })}>open-region-buy-summary</button>
  ),
}));
vi.mock("@/components/RegionalSellSinkTable", () => ({
  RegionalSellSinkTable: ({ onOpenItemsAtSink }: { onOpenItemsAtSink?: (hub: { target_system_id: number }) => void }) => (
    <button onClick={() => onOpenItemsAtSink?.({ target_system_id: 30002187 })}>open-region-sell-summary</button>
  ),
}));
vi.mock("@/components/RegionalDayTraderTable", () => ({ RegionalDayTraderTable: () => null }));
vi.mock("@/components/RegionalCorridorTable", () => ({ RegionalCorridorTable: () => null }));
vi.mock("@/components/StagingAdvisorPanel", () => ({ StagingAdvisorPanel: () => null }));
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
vi.mock("@/components/HubTrendTable", () => ({ HubTrendTable: () => null }));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ patrons: [] }) })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App radius hub view", () => {
  it("filters radius rows by selected buy/sell hub and clears filter", async () => {
    localStorage.setItem("eve-flipper-active-tab", "radius");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));

    expect(await screen.findByTestId("radius-items-table")).toHaveTextContent("30000142->30002187,30000144->30000142");

    fireEvent.click(screen.getByRole("button", { name: "open-radius-buy" }));
    expect(screen.getByTestId("radius-items-table")).toHaveTextContent("30000142->30002187");

    fireEvent.click(screen.getByRole("button", { name: "open-radius-sell" }));
    expect(screen.getByTestId("radius-items-table")).toHaveTextContent("30000142->30002187");

    fireEvent.click(screen.getByRole("button", { name: /Clear hub filter/ }));
    expect(screen.getByTestId("radius-items-table")).toHaveTextContent("30000142->30002187,30000144->30000142");
  });
});

describe("App region open rows behavior", () => {
  it("keeps region buy/sell open rows behavior unchanged", async () => {
    localStorage.setItem("eve-flipper-active-tab", "region");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(mockScanRegionalDayTrader).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("region-items-table")).toHaveTextContent("30000142->30002187,30000144->30002187");

    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    fireEvent.click(screen.getByRole("button", { name: "open-region-buy-summary" }));
    expect(await screen.findByTestId("region-items-table")).toHaveTextContent("30000142->30002187");

    fireEvent.click(screen.getByRole("button", { name: "Sell" }));
    fireEvent.click(screen.getByRole("button", { name: "open-region-sell-summary" }));
    expect(await screen.findByTestId("region-items-table")).toHaveTextContent("30000142->30002187,30000144->30002187");
  });
});
