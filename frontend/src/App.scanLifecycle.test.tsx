import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const { mockScan, scanCalls } = vi.hoisted(() => ({
  scanCalls: [] as Array<{ onProgress: (msg: { message: string; stage?: string }) => void; signal: AbortSignal }>,
  mockScan: vi.fn((_: unknown, onProgress: (msg: { message: string; stage?: string }) => void, signal: AbortSignal) =>
    new Promise<unknown[]>((resolve, reject) => {
      scanCalls.push({ onProgress, signal });
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      (signal as AbortSignal & { __resolve?: () => void }).__resolve = () => resolve([]);
    }),
  ),
}));

vi.mock("@/lib/api", () => ({
  getConfig: vi.fn(async () => ({ system_name: "Jita" })),
  scan: mockScan,
  scanMultiRegion: vi.fn(async () => []),
  scanRegionalDayTrader: vi.fn(async () => ({ rows: [], hubs: [], trends: [], summary: { count: 0, targetRegionName: "", periodDays: 14 } })),
  scanContracts: vi.fn(async () => []),
  getActiveScan: vi.fn(async () => ({ active: false })),
  cancelActiveScan: vi.fn(async () => ({ ok: true })),
  rebootStationCache: vi.fn(async () => ({ ok: true, cleared: 1 })),
  getCharacterLocation: vi.fn(async () => ({ solar_system_name: "Jita" })),
  applyAppUpdate: vi.fn(), addPinnedOpportunity: vi.fn(async () => ({})), getUpdateCheckStatus: vi.fn(), listPinnedOpportunities: vi.fn(async () => []),
  removePinnedOpportunity: vi.fn(async () => ({})), subscribePinnedOpportunityChanges: vi.fn(() => () => {}), skipAppUpdateForSession: vi.fn(async () => ({})), updateConfig: vi.fn(async () => ({})),
  testAlertChannels: vi.fn(), getWatchlist: vi.fn(async () => []), getBanlistItems: vi.fn(async () => []), getBannedStations: vi.fn(async () => []), getSystemsList: vi.fn(async () => []), recalculateRadiusDistanceLens: vi.fn(async () => []),
}));
vi.mock("@/lib/useAuth", () => ({ useAuth: () => ({ authStatus: { logged_in: false, character_id: null, characters: [] }, loginPolling: false, handleLogin: vi.fn(), handleLogout: vi.fn(), handleSelectCharacter: vi.fn(async () => ({})), handleDeleteCharacter: vi.fn(async () => ({})), refreshAuthStatus: vi.fn(async () => ({})) }) }));
vi.mock("@/lib/useVersionCheck", () => ({ useVersionCheck: () => ({ appVersion: "x", latestVersion: "x", hasUpdate: false, dismissedForSession: false, autoUpdateSupported: false, platform: "web", releaseURL: "" }) }));
vi.mock("@/lib/useEsiStatus", () => ({ useEsiStatus: () => ({ esiAvailable: true }) }));
vi.mock("@/lib/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/components/Toast", () => ({ useGlobalToast: () => ({ addToast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (k: string) => k, language: "en", setLanguage: vi.fn() }) }));
vi.mock("@/components/ParametersPanel", () => ({ ParametersPanel: () => null }));
vi.mock("@/components/StatusBar", () => ({ StatusBar: () => null }));
vi.mock("@/components/ContractParametersPanel", () => ({ ContractParametersPanel: () => null }));
vi.mock("@/components/ScanResultsTable", () => ({ ScanResultsTable: () => null }));
vi.mock("@/components/ContractResultsTable", () => ({ ContractResultsTable: () => null }));
vi.mock("@/components/RouteBuilder", () => ({ RouteBuilder: () => null }));
vi.mock("@/components/WatchlistTab", () => ({ WatchlistTab: () => null }));
vi.mock("@/components/StationTrading", () => ({ StationTrading: () => null }));
vi.mock("@/components/IndustryTab", () => ({ IndustryTab: () => null }));
vi.mock("@/components/WarTracker", () => ({ WarTracker: () => null }));
vi.mock("@/components/PlexTab", () => ({ PlexTab: () => null }));
vi.mock("@/components/ScanHistory", () => ({ ScanHistory: () => null }));
vi.mock("@/components/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/KeyboardShortcutsHelp", () => ({ KeyboardShortcutsHelp: () => null }));
vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/components/ThemeSwitcher", () => ({ ThemeSwitcher: () => null }));
vi.mock("@/components/Modal", () => ({ Modal: () => null }));
vi.mock("@/components/CharacterPopup", () => ({ CharacterPopup: () => null }));
vi.mock("@/components/TopActionButtons", () => ({ TopActionButtons: () => null }));

describe("App scan lifecycle", () => {
  beforeEach(() => { scanCalls.length = 0; mockScan.mockClear(); });
  afterEach(() => cleanup());

  it("supports manual stop and prevents stale run progress overwrite", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "stop" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "stop" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "scan" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "scan" }));
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(2));
    scanCalls[0].onProgress({ stage: "fetch", message: "old run" });
    scanCalls[1].onProgress({ stage: "fetch", message: "new run" });
    expect(screen.queryByText(/old run/i)).not.toBeInTheDocument();
  });

  it("does not start a second scan while scan lifecycle is non-idle", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "stop" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "stop" }));
    expect(mockScan).toHaveBeenCalledTimes(1);
  });
});
