import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { BANLIST_STORAGE_KEY } from "@/lib/banlist";

const {
  mockGetConfig,
  mockScan,
  captured,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn(async () => ({ system_name: "Jita" })),
  mockScan: vi.fn(async () => [
    { TypeID: 34, TypeName: "Tritanium" },
    { TypeID: 35, TypeName: "Pyerite" },
  ]),
  captured: {
    radiusTableResults: [] as Array<{ TypeID: number; TypeName: string }>,
    banlistLatestResults: [] as Array<{ TypeID: number; TypeName: string }>,
    banlistRouteResultsLength: -1,
  },
}));

vi.mock("@/lib/api", () => ({
  applyAppUpdate: vi.fn(),
  getUpdateCheckStatus: vi.fn(),
  getConfig: () => mockGetConfig(),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  updateConfig: vi.fn(async () => ({})),
  scan: mockScan,
  scanMultiRegion: vi.fn(async () => []),
  scanRegionalDayTrader: vi.fn(async () => []),
  scanContracts: vi.fn(async () => []),
  testAlertChannels: vi.fn(),
  getWatchlist: vi.fn(async () => []),
  rebootStationCache: vi.fn(async () => ({ ok: true, cleared: 1 })),
}));

vi.mock("@/lib/useAuth", () => ({
  useAuth: () => ({
    authStatus: { logged_in: false, characters: [] },
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
vi.mock("@/components/ScanResultsTable", () => ({
  ScanResultsTable: (props: { results: Array<{ TypeID: number; TypeName: string }>; tradeStateTab?: string }) => {
    if (props.tradeStateTab === "radius") {
      captured.radiusTableResults = props.results;
    }
    return null;
  },
}));
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
vi.mock("@/components/Modal", () => ({
  Modal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/CharacterPopup", () => ({ CharacterPopup: () => null }));
vi.mock("@/components/TopActionButtons", () => ({ TopActionButtons: () => null }));
vi.mock("@/components/BanlistModal", () => ({
  BanlistModal: (props: {
    latestResults: Array<{ TypeID: number; TypeName: string }>;
    routeResults: unknown[];
  }) => {
    captured.banlistLatestResults = props.latestResults;
    captured.banlistRouteResultsLength = props.routeResults.length;
    return null;
  },
}));

beforeEach(() => {
  mockGetConfig.mockClear();
  mockScan.mockClear();
  captured.radiusTableResults = [];
  captured.banlistLatestResults = [];
  captured.banlistRouteResultsLength = -1;
  localStorage.clear();
  localStorage.setItem(
    BANLIST_STORAGE_KEY,
    JSON.stringify({ entries: [{ typeId: 34, typeName: "Tritanium" }] }),
  );
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

describe("App banlist suggestion sourcing", () => {
  it("passes raw scan results to BanlistModal while ScanResultsTable stays filtered", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));

    await waitFor(() => {
      expect(mockScan).toHaveBeenCalledTimes(1);
      expect(captured.radiusTableResults.map((item) => item.TypeID)).toEqual([35]);
      expect(captured.banlistLatestResults.map((item) => item.TypeID).sort((a, b) => a - b)).toEqual([34, 35]);
      expect(captured.banlistRouteResultsLength).toBe(0);
    });
  });
});
