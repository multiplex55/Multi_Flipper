import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const { mockScan } = vi.hoisted(() => ({
  mockScan: vi.fn(async () => [{ TypeID: 34, TypeName: "Tritanium" }]),
}));

vi.mock("@/lib/api", () => ({
  applyAppUpdate: vi.fn(),
  getUpdateCheckStatus: vi.fn(async () => ({ status: "idle" })),
  getConfig: vi.fn(async () => ({ system_name: "Jita", cargo_capacity: 10000 })),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  updateConfig: vi.fn(async () => ({})),
  scan: (...args: unknown[]) => mockScan(...args),
  scanMultiRegion: vi.fn(async () => []),
  scanRegionalDayTrader: vi.fn(async () => []),
  scanContracts: vi.fn(async () => []),
  testAlertChannels: vi.fn(async () => ({})),
  getWatchlist: vi.fn(async () => []),
  getBanlistItems: vi.fn(async () => []),
  getBannedStations: vi.fn(async () => []),
  rebootStationCache: vi.fn(async () => ({ ok: true, cleared: 0 })),
  getCharacterLocation: vi.fn(async () => null),
}));

vi.mock("@/lib/radiusScanSession", () => ({
  createEmptyRadiusScanSession: () => ({ hasScan: false, results: [], loopOpportunities: [] }),
  createRadiusScanSession: ({ results, cacheMeta, scanParams }: { results: unknown[]; cacheMeta: unknown; scanParams: unknown }) => ({
    hasScan: true,
    results,
    cacheMeta,
    paramsSnapshot: scanParams,
    scanCompletedAt: "2026-04-18T00:00:00.000Z",
    routeInsightsSnapshot: { routeSummaries: [], topRoutePicks: {}, actionQueue: [] },
    routeInsightsSnapshotVersion: "v1",
    loopOpportunities: [],
  }),
}));

vi.mock("@/lib/useAuth", () => ({ useAuth: () => ({ authStatus: { logged_in: false, characters: [] }, loginPolling: false, handleLogin: vi.fn(), handleLogout: vi.fn(), handleSelectCharacter: vi.fn(), handleDeleteCharacter: vi.fn(), refreshAuthStatus: vi.fn() }) }));
vi.mock("@/lib/useVersionCheck", () => ({ useVersionCheck: () => ({ appVersion: "test", latestVersion: "test", hasUpdate: false, dismissedForSession: false, autoUpdateSupported: false, platform: "web", releaseURL: "" }) }));
vi.mock("@/lib/useEsiStatus", () => ({ useEsiStatus: () => ({ esiAvailable: true }) }));
vi.mock("@/lib/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/components/Toast", () => ({ useGlobalToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, language: "en", setLanguage: vi.fn() }) }));

vi.mock("@/components/ParametersPanel", () => ({ ParametersPanel: () => null }));
vi.mock("@/components/StatusBar", () => ({ StatusBar: () => null }));
vi.mock("@/components/ContractParametersPanel", () => ({ ContractParametersPanel: () => null }));
vi.mock("@/components/ContractResultsTable", () => ({ ContractResultsTable: () => null }));
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
vi.mock("@/components/RadiusRouteWorkspace", () => ({ RadiusRouteWorkspace: ({ radiusScanSession }: { radiusScanSession?: { results?: unknown[] } }) => <div data-testid="route-session-count">route-session:{radiusScanSession?.results?.length ?? 0}</div> }));
vi.mock("@/components/ScanResultsTable", () => ({
  ScanResultsTable: ({ tradeStateTab, results }: { tradeStateTab?: string; results: unknown[] }) => (
    <div data-testid={`rows-${tradeStateTab ?? "unknown"}`}>{results.length}</div>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ patrons: [] }) })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App tab persistence", () => {
  it("scan once, switch tabs, and radius rows persist", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));

    await waitFor(() => expect(screen.getByTestId("rows-radius")).toHaveTextContent("1"));

    fireEvent.click(screen.getByRole("tab", { name: "tabRoute" }));
    expect(await screen.findByTestId("route-session-count")).toHaveTextContent("route-session:1");

    fireEvent.click(screen.getByRole("tab", { name: "tabRadius" }));
    expect(await screen.findByTestId("rows-radius")).toHaveTextContent("1");
  });
});
