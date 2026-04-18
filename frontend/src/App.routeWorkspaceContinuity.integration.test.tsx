import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import {
  mixedRouteScanResults,
  routeWorkspaceInsightsFixture,
} from "@/test/fixtures/routeWorkspaceMixedData";

const { mockScan } = vi.hoisted(() => ({
  mockScan: vi.fn(async () => mixedRouteScanResults),
}));

vi.mock("@/lib/api", () => ({
  applyAppUpdate: vi.fn(),
  getUpdateCheckStatus: vi.fn(async () => ({ status: "idle" })),
  getConfig: vi.fn(async () => ({ system_name: "Jita", cargo_capacity: 12000 })),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  updateConfig: vi.fn(async () => ({})),
  scan: mockScan,
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
    routeInsightsSnapshot: routeWorkspaceInsightsFixture,
    routeInsightsSnapshotVersion: "v1",
    loopOpportunities: [{ routeKey: "loop:jita-amarr-jita" }],
  }),
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
vi.mock("@/lib/useEsiStatus", () => ({ useEsiStatus: () => ({ esiAvailable: true }) }));
vi.mock("@/lib/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/components/Toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/Toast")>("@/components/Toast");
  return {
    ...actual,
    useGlobalToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
  };
});
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, language: "en", setLanguage: vi.fn() }),
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
vi.mock("@/components/RouteBuilder", () => ({
  RouteBuilder: () => <div data-testid="route-builder-sentinel">RouteBuilder sentinel</div>,
}));
vi.mock("@/components/ScanResultsTable", () => ({
  ScanResultsTable: (props: {
    results: unknown[];
    tradeStateTab?: string;
    onOpenInRoute?: (routeKey: string) => void;
    onOpenInRouteWorkbench?: (routeKey: string) => void;
    onSendToRouteQueue?: (routeKey: string) => void;
  }) => (
    <div>
      <div data-testid={`rows-${props.tradeStateTab ?? "unknown"}`}>{props.results.length}</div>
      <button type="button" onClick={() => props.onOpenInRouteWorkbench?.("route:jita-amarr")}>open-promoted-route</button>
      <button type="button" onClick={() => props.onOpenInRouteWorkbench?.("route:jita-amarr")}>open-route-workspace-cta</button>
      <button type="button" onClick={() => props.onOpenInRouteWorkbench?.("route:jita-amarr")}>open-compact-insight-cta</button>
      <button type="button" onClick={() => props.onOpenInRoute?.("route:jita-amarr")}>open-in-route</button>
      <button type="button" onClick={() => props.onSendToRouteQueue?.("route:jita-amarr")}>selected-row-batch-action</button>
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

describe("App route workspace continuity", () => {
  it("scans in Radius, opens workbench route item, and keeps data when switching back", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByTestId("rows-radius")).toHaveTextContent("3"));

    fireEvent.click(screen.getAllByRole("button", { name: "open-promoted-route" })[0]);
    expect(await screen.findByTestId("route-workspace-workbench")).toBeInTheDocument();
    expect(screen.getByText(/Selected route: Jita → Amarr/i)).toBeInTheDocument();
    expect(screen.getByText(/Source: radius/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "tabRadius" }));
    expect(await screen.findByTestId("rows-radius")).toHaveTextContent("3");
  });

  it("opens Route tab and workbench from compact insight CTA in Radius context", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByTestId("rows-radius")).toHaveTextContent("3"));

    fireEvent.click(screen.getAllByRole("button", { name: "open-compact-insight-cta" })[0]);

    expect(await screen.findByTestId("route-workspace-workbench")).toBeInTheDocument();
    expect(screen.getByText(/Selected route: Jita → Amarr/i)).toBeInTheDocument();
  });

  it("keeps Open Route Workspace CTA active in Radius context", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByTestId("rows-radius")).toHaveTextContent("3"));

    fireEvent.click(screen.getAllByRole("button", { name: "open-route-workspace-cta" })[0]);

    expect(await screen.findByTestId("route-workspace-workbench")).toBeInTheDocument();
    expect(screen.getByText(/Selected route: Jita → Amarr/i)).toBeInTheDocument();
  });

  it("continues selected-row batch actions after returning from route workspace", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByTestId("rows-radius")).toHaveTextContent("3"));

    fireEvent.click(screen.getAllByRole("button", { name: "selected-row-batch-action" })[0]);
    fireEvent.click(screen.getByRole("tab", { name: "tabRoute" }));
    expect(await screen.findByTestId("route-workspace-discover")).toBeInTheDocument();
    expect(screen.getByText(/Route queue \(1\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "tabRadius" }));
    fireEvent.click(screen.getAllByRole("button", { name: "selected-row-batch-action" })[0]);

    fireEvent.click(screen.getByRole("tab", { name: "tabRoute" }));
    expect(await screen.findByTestId("route-workspace-discover")).toBeInTheDocument();
    expect(screen.getByText(/Route queue \(1\)/i)).toBeInTheDocument();
  });

  it("keeps promoted route continuity across discover/workbench and keeps Finder independent", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByTestId("rows-radius")).toHaveTextContent("3"));

    fireEvent.click(screen.getAllByRole("button", { name: "open-promoted-route" })[0]);
    expect(await screen.findByTestId("route-workspace-workbench")).toBeInTheDocument();
    expect(screen.getByText(/Selected route: Jita → Amarr/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Discover" }));
    expect(await screen.findByTestId("route-workspace-discover")).toBeInTheDocument();
    expect(screen.getByText("Jita → Amarr")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Finder" }));
    expect(await screen.findByTestId("route-workspace-finder")).toBeInTheDocument();
    expect(screen.getByTestId("route-builder-sentinel")).toHaveTextContent("RouteBuilder sentinel");
  });

  it("preserves state on tab switch and only clears on explicit reset", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByTestId("rows-radius")).toHaveTextContent("3"));

    fireEvent.click(screen.getByRole("tab", { name: "tabRoute" }));
    expect(await screen.findByTestId("route-workspace-discover")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "tabRadius" }));
    expect(await screen.findByTestId("rows-radius")).toHaveTextContent("3");

    fireEvent.click(screen.getByRole("button", { name: /Reset session/i }));
    expect(await screen.findByTestId("rows-radius")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("tab", { name: "tabRoute" }));
    expect(await screen.findByTestId("route-workspace-discover")).toBeInTheDocument();
    expect(screen.getByText(/Grouped routes/i)).toBeInTheDocument();
    expect(screen.queryByText(/Jita → Amarr/i)).not.toBeInTheDocument();
  });
});
