import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

vi.mock("@/lib/api", () => ({
  applyAppUpdate: vi.fn(),
  getUpdateCheckStatus: vi.fn(async () => ({ status: "idle" })),
  getConfig: vi.fn(async () => ({ system_name: "Jita", cargo_capacity: 12000 })),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  updateConfig: vi.fn(async () => ({})),
  scan: vi.fn(async () => []),
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
  createEmptyRadiusScanSession: vi.fn(() => ({
    hasScan: true,
    routeInsightsSnapshot: {
      routeSummaries: [
        {
          routeKey: "route:1",
          routeLabel: "Jita → Amarr",
          aggregate: { dailyProfit: 1000, dailyIskPerJump: 100 },
          badge: { confidence: { score: 88 } },
        },
      ],
      topRoutePicks: {
        bestRecommendedRoutePack: null,
        bestQuickSingleRoute: null,
        bestSafeFillerRoute: null,
      },
      actionQueue: [],
    },
    results: [{ TypeID: 34 }],
    loopOpportunities: [],
  })),
  createRadiusScanSession: vi.fn(() => ({
    hasScan: true,
    routeInsightsSnapshot: {
      routeSummaries: [
        {
          routeKey: "route:1",
          routeLabel: "Jita → Amarr",
          aggregate: { dailyProfit: 1000, dailyIskPerJump: 100 },
          badge: { confidence: { score: 88 } },
        },
      ],
      topRoutePicks: {
        bestRecommendedRoutePack: null,
        bestQuickSingleRoute: null,
        bestSafeFillerRoute: null,
      },
      actionQueue: [],
    },
    routeInsightsSnapshotVersion: "v1",
    paramsSnapshot: { system_name: "Jita" },
    scanCompletedAt: "2026-04-18T00:00:00.000Z",
    cacheMeta: null,
    loopOpportunities: [],
    results: [{ TypeID: 34 }],
  })),
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

vi.mock("@/components/Toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/Toast")>("@/components/Toast");
  return {
    ...actual,
    useGlobalToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
  };
});

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

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

vi.mock("@/components/ScanResultsTable", () => ({
  ScanResultsTable: (props: {
    onOpenInRoute?: (routeKey: string) => void;
    onOpenInRouteWorkbench?: (routeKey: string) => void;
    onSendToRouteQueue?: (routeKey: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => props.onOpenInRouteWorkbench?.("route:1")}>promote-valid</button>
      <button type="button" onClick={() => props.onOpenInRouteWorkbench?.("missing:key")}>promote-stale</button>
      <button type="button" onClick={() => props.onSendToRouteQueue?.("route:1")}>queue-route</button>
    </div>
  ),
}));

beforeEach(() => {
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

describe("App route promotion", () => {
  it("button click changes tab and sets route workspace state", async () => {
    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: "promote-valid" }))[0]);

    expect(await screen.findByTestId("route-workspace-workbench")).toBeInTheDocument();
    expect(screen.getByText(/Selected route: Jita → Amarr/i)).toBeInTheDocument();
    expect(screen.getByText(/Source: radius/i)).toBeInTheDocument();
  });

  it("shows fallback notice for stale route key and does not crash", async () => {
    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: "promote-stale" }))[0]);

    expect(await screen.findByTestId("route-workspace-workbench")).toBeInTheDocument();
    expect(screen.getByTestId("route-workspace-stale-key-notice")).toBeInTheDocument();
  });

  it("Send to Route Queue updates route queue state", async () => {
    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: "queue-route" }))[0]);

    expect(await screen.findByTestId("route-workspace-discover")).toBeInTheDocument();
    expect(screen.getByText(/Route queue \(1\)/i)).toBeInTheDocument();
  });
});
