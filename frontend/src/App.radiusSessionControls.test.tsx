import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const { mockScan, mockRecalculateRadiusDistanceLens } = vi.hoisted(() => ({
  mockScan: vi.fn(async () => [
    {
      TypeID: 34,
      TypeName: "Tritanium",
      Volume: 1,
      BuyPrice: 1,
      SellPrice: 2,
      BuyStation: "Jita 4-4",
      BuySystemName: "Jita",
      BuySystemID: 30000142,
      SellStation: "Amarr",
      SellSystemName: "Amarr",
      SellSystemID: 30002187,
      ProfitPerUnit: 1,
      MarginPercent: 10,
      UnitsToBuy: 1,
      BuyOrderRemain: 1,
      SellOrderRemain: 1,
      TotalProfit: 1,
      ProfitPerJump: 1,
      BuyJumps: 0,
      SellJumps: 1,
      TotalJumps: 1,
      DailyVolume: 1,
      Velocity: 1,
      PriceTrend: 0,
      BuyCompetitors: 0,
      SellCompetitors: 0,
      DailyProfit: 1,
    },
  ]),
  mockRecalculateRadiusDistanceLens: vi.fn(async () => [
    { row_key: "34:30000142:30002187", buy_jumps: 0, sell_jumps: 1, total_jumps: 1 },
  ]),
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
  scanRegionalDayTrader: vi.fn(async () => ({ rows: [], hubs: [], summary: { count: 0, targetRegionName: "", periodDays: 14 } })),
  scanContracts: vi.fn(async () => []),
  testAlertChannels: vi.fn(),
  getWatchlist: vi.fn(async () => []),
  getBanlistItems: vi.fn(async () => []),
  getBannedStations: vi.fn(async () => []),
  rebootStationCache: vi.fn(async () => ({ ok: true, cleared: 1 })),
  getCharacterLocation: vi.fn(async () => ({ solar_system_id: 30000142, solar_system_name: "Jita" })),
  getSystemsList: vi.fn(async () => [{ id: 30000142, name: "Jita" }]),
  recalculateRadiusDistanceLens: mockRecalculateRadiusDistanceLens,
}));

vi.mock("@/lib/useAuth", () => ({ useAuth: () => ({ authStatus: { logged_in: false, character_id: null, character_name: "", characters: [] }, loginPolling: false, handleLogin: vi.fn(), handleLogout: vi.fn(), handleSelectCharacter: vi.fn(async () => ({})), handleDeleteCharacter: vi.fn(async () => ({})), refreshAuthStatus: vi.fn(async () => ({})) }) }));
vi.mock("@/lib/useVersionCheck", () => ({ useVersionCheck: () => ({ appVersion: "test", latestVersion: "test", hasUpdate: false, dismissedForSession: false, autoUpdateSupported: false, platform: "web", releaseURL: "" }) }));
vi.mock("@/lib/useEsiStatus", () => ({ useEsiStatus: () => ({ esiAvailable: true }) }));
vi.mock("@/lib/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/components/Toast", () => ({ useGlobalToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, language: "en", setLanguage: vi.fn() }) }));
vi.mock("@/components/ParametersPanel", () => ({ ParametersPanel: () => null }));
vi.mock("@/components/StatusBar", () => ({ StatusBar: () => null }));
vi.mock("@/components/ContractParametersPanel", () => ({ ContractParametersPanel: () => null }));
vi.mock("@/components/ScanResultsTable", () => ({
  ScanResultsTable: ({ radiusSessionControls, tradeStateTab }: { radiusSessionControls?: ReactNode; tradeStateTab?: string }) => (
    <div data-testid={`${tradeStateTab}-table`}>
      {tradeStateTab === "radius" ? (
        <div data-testid="radius-command-area">{radiusSessionControls}</div>
      ) : null}
    </div>
  ),
}));
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
vi.mock("@/components/RegionalDayTraderTable", () => ({ RegionalDayTraderTable: () => null }));
vi.mock("@/components/RegionalCorridorTable", () => ({ RegionalCorridorTable: () => null }));
vi.mock("@/components/RegionalBuyHubTable", () => ({ RegionalBuyHubTable: () => null }));
vi.mock("@/components/RegionalSellSinkTable", () => ({ RegionalSellSinkTable: () => null }));
vi.mock("@/components/StagingAdvisorPanel", () => ({ StagingAdvisorPanel: () => null }));
vi.mock("@/components/HubTrendTable", () => ({ HubTrendTable: () => null }));

beforeEach(() => {
  localStorage.clear();
  mockScan.mockClear();
  mockRecalculateRadiusDistanceLens.mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ patrons: [] }) })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App radius session controls wiring", () => {
  it("renders session controls in the radius command area, supports recalc/lens, and avoids duplicates", async () => {
    render(<App />);

    const commandArea = await screen.findByTestId("radius-command-area");
    expect(within(commandArea).getByRole("button", { name: "Reset session" })).toBeInTheDocument();
    expect(within(commandArea).getByRole("button", { name: "Recalc" })).toBeDisabled();

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));
    expect(within(commandArea).getByRole("button", { name: "Recalc" })).toBeEnabled();

    fireEvent.click(within(commandArea).getByRole("button", { name: "Recalc" }));
    await waitFor(() => expect(mockRecalculateRadiusDistanceLens).toHaveBeenCalledTimes(1));
    expect(await within(commandArea).findByText(/Lens Jita/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "tabRegion" }));
    fireEvent.click(screen.getByRole("tab", { name: "tabRadius" }));
    expect(within(commandArea).getAllByRole("button", { name: "Reset session" })).toHaveLength(1);

    fireEvent.click(within(commandArea).getByRole("button", { name: "Reset session" }));
    expect(within(commandArea).queryByText(/Lens Jita/)).not.toBeInTheDocument();
  });
});
