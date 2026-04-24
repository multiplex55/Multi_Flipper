import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const {
  authState,
  mockGetCharacterLocation,
  mockGetConfig,
  mockScan,
  mockRebootStationCache,
} = vi.hoisted(() => ({
  authState: {
    logged_in: false,
    character_id: null as number | null,
    characters: [] as Array<{ character_id: number; character_name: string }>,
  },
  mockGetCharacterLocation: vi.fn(async () => ({ solar_system_name: "Amarr" })),
  mockGetConfig: vi.fn(async () => ({ system_name: "Jita" })),
  mockScan: vi.fn(async () => []),
  mockRebootStationCache: vi.fn(async () => ({ ok: true, cleared: 1 })),
}));

vi.mock("@/lib/api", () => ({
  applyAppUpdate: vi.fn(),
  addPinnedOpportunity: vi.fn(async () => ({})),
  getUpdateCheckStatus: vi.fn(),
  getConfig: () => mockGetConfig(),
  listPinnedOpportunities: vi.fn(async () => []),
  removePinnedOpportunity: vi.fn(async () => ({})),
  subscribePinnedOpportunityChanges: vi.fn(() => () => {}),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  updateConfig: vi.fn(async () => ({})),
  scan: mockScan,
  scanMultiRegion: vi.fn(async () => []),
  scanRegionalDayTrader: vi.fn(async () => []),
  scanContracts: vi.fn(async () => []),
  testAlertChannels: vi.fn(),
  getWatchlist: vi.fn(async () => []),
  rebootStationCache: mockRebootStationCache,
  getCharacterLocation: mockGetCharacterLocation,
}));

vi.mock("@/lib/useAuth", () => ({
  useAuth: () => ({
    authStatus: authState,
    loginPolling: false,
    handleLogin: vi.fn(),
    handleLogout: vi.fn(),
    handleSelectCharacter: vi.fn(async () => ({})),
    handleDeleteCharacter: vi.fn(async () => ({})),
    refreshAuthStatus: vi.fn(async () => ({})),
  }),
}));

vi.mock("@/lib/useVersionCheck", () => ({
  useVersionCheck: () => ({
    appVersion: "test",
    latestVersion: "test",
    hasUpdate: false,
    dismissedForSession: false,
    autoUpdateSupported: false,
    platform: "web",
    releaseURL: "",
  }),
}));

vi.mock("@/lib/useEsiStatus", () => ({
  useEsiStatus: () => ({ esiAvailable: true }),
}));

vi.mock("@/lib/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("@/components/Toast", () => ({
  useGlobalToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

vi.mock("@/components/ParametersPanel", () => ({
  ParametersPanel: () => null,
}));

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

beforeEach(() => {
  mockGetConfig.mockClear();
  mockGetCharacterLocation.mockClear();
  mockScan.mockClear();
  mockRebootStationCache.mockClear();
  authState.logged_in = false;
  authState.character_id = null;
  authState.characters = [];
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ patrons: [] }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App scan and refresh controls", () => {
  it("renders Scan and Refresh next to Scan", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "scan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "scanAndRefresh" })).toBeInTheDocument();
  });

  it("calls cache reboot, location refresh, and then scan in order", async () => {
    const callOrder: string[] = [];
    mockRebootStationCache.mockImplementation(async () => {
      callOrder.push("reboot");
      return { ok: true, cleared: 1 };
    });
    mockGetCharacterLocation.mockImplementation(async () => {
      callOrder.push("location");
      return { solar_system_name: "Amarr" };
    });
    mockScan.mockImplementation(async () => {
      callOrder.push("scan");
      return [];
    });
    authState.logged_in = true;
    authState.character_id = 9001;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scanAndRefresh" }));

    await waitFor(() => {
      expect(callOrder).toEqual(["reboot", "location", "scan"]);
    });
    expect(mockScan).toHaveBeenCalledWith(
      expect.objectContaining({ system_name: "Amarr" }),
      expect.any(Function),
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

  it("falls back to existing scan params when location refresh fails", async () => {
    mockGetCharacterLocation.mockRejectedValueOnce(new Error("boom"));
    authState.logged_in = true;
    authState.character_id = 9001;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scanAndRefresh" }));

    await waitFor(() => {
      expect(mockScan).toHaveBeenCalled();
    });
    expect(mockScan).toHaveBeenCalledWith(
      expect.objectContaining({ system_name: "Jita" }),
      expect.any(Function),
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

  it("disables controls and shows loading label while scan-and-refresh is in flight", async () => {
    let releaseScan: (() => void) | undefined;
    mockScan.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseScan = () => resolve([]);
        }),
    );

    render(<App />);

    const scanButton = await screen.findByRole("button", { name: "scan" });
    const scanAndRefreshButton = screen.getByRole("button", { name: "scanAndRefresh" });

    fireEvent.click(scanAndRefreshButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "scanAndRefreshProcessing" })).toBeDisabled();
      expect(scanButton).toBeDisabled();
    });

    if (releaseScan) releaseScan();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "scanAndRefresh" })).toBeEnabled();
      expect(scanButton).toBeEnabled();
    });
  });

  it("shows scan-and-refresh only on radius tab", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "scanAndRefresh" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "tabRegion" }));

    expect(screen.queryByRole("button", { name: "scanAndRefresh" })).not.toBeInTheDocument();
  });
});
