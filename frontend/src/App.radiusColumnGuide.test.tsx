import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { radiusColumnRegistry } from "@/lib/radiusColumnRegistry";

const { mockGetConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(async () => ({ system_name: "Jita" })),
}));

vi.mock("@/lib/api", () => ({
  applyAppUpdate: vi.fn(),
  getUpdateCheckStatus: vi.fn(),
  getConfig: () => mockGetConfig(),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  updateConfig: vi.fn(async () => ({})),
  scan: vi.fn(async () => []),
  scanMultiRegion: vi.fn(async () => []),
  scanRegionalDayTrader: vi.fn(async () => []),
  scanContracts: vi.fn(async () => []),
  testAlertChannels: vi.fn(),
  getWatchlist: vi.fn(async () => []),
  listPinnedOpportunities: vi.fn(async () => []),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
  getBanlistItems: vi.fn(async () => []),
  getBannedStations: vi.fn(async () => []),
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

vi.mock("@/components/ParametersPanel", () => ({ ParametersPanel: () => null }));
vi.mock("@/components/StatusBar", () => ({ StatusBar: () => null }));
vi.mock("@/components/ContractParametersPanel", () => ({ ContractParametersPanel: () => null }));
vi.mock("@/components/ScanResultsTable", () => ({ ScanResultsTable: () => null }));
vi.mock("@/components/ContractResultsTable", () => ({ ContractResultsTable: () => null }));
vi.mock("@/components/RouteBuilder", () => ({ RouteBuilder: () => null }));
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
vi.mock("@/components/RadiusColumnGuideModal", () => ({
  RadiusColumnGuideModal: ({ open }: { open: boolean }) =>
    open ? (
      <div data-testid="radius-guide-modal">
        <h2>Radius Controls and Filters</h2>
        <h2>Flipper Radius (Route) Guide</h2>
        <p>Smart ordering vs column-only ordering</p>
        <p>Queue routes in Flipper Radius (Route)</p>
        {Array.from(
          new Set(radiusColumnRegistry.map((entry) => entry.category)),
        ).map((category) => (
          <span key={category}>{category}</span>
        ))}
      </div>
    ) : null,
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

describe("App radius column guide entry points", () => {
  it("shows the info button only on the radius tab", async () => {
    render(<App />);

    expect(await screen.findAllByRole("button", { name: "radiusGuideButtonLabel" })).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: "tabRegion" }));

    expect(screen.queryByRole("button", { name: "radiusGuideButtonLabel" })).not.toBeInTheDocument();
  });

  it("opens the guide modal from the info button", async () => {
    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: "radiusGuideButtonLabel" }))[0]);

    expect(screen.getByTestId("radius-guide-modal")).toBeInTheDocument();
  });

  it("guide includes expected registry categories", async () => {
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: "radiusGuideButtonLabel" }))[0]);

    expect(screen.getByText("Radius Controls and Filters")).toBeInTheDocument();
    expect(screen.getByText("Flipper Radius (Route) Guide")).toBeInTheDocument();
    expect(screen.getByText("Smart ordering vs column-only ordering")).toBeInTheDocument();
    expect(screen.getByText("Market Depth")).toBeInTheDocument();
    expect(screen.getByText("Route Pack Aggregates")).toBeInTheDocument();
    expect(screen.getByText("Prioritization")).toBeInTheDocument();
  });
});
