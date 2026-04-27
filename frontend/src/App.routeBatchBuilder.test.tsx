import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import type { FlipResult } from "@/lib/types";

const routeKey = "loc:60003760->loc:60008494";

const { mockScan } = vi.hoisted(() => ({
  mockScan: vi.fn(async () => [
    {
      TypeID: 34,
      TypeName: "Tritanium",
      BuySystemID: 30000142,
      BuySystemName: "Jita",
      SellSystemID: 30002187,
      SellSystemName: "Amarr",
      BuyStation: "Jita IV",
      SellStation: "Amarr VIII",
      BuyLocationID: 60003760,
      SellLocationID: 60008494,
      BuyPrice: 5,
      SellPrice: 7,
      ProfitPerUnit: 2,
      UnitsToBuy: 1000,
      FilledQty: 1000,
      DailyVolume: 10000,
      DailyProfit: 2000000,
      TotalJumps: 9,
      Volume: 0.01,
    } as FlipResult,
  ]),
}));

vi.mock("@/lib/api", () => ({
  addPinnedOpportunity: vi.fn(async () => []),
  applyAppUpdate: vi.fn(),
  getUpdateCheckStatus: vi.fn(async () => ({ status: "idle" })),
  getConfig: vi.fn(async () => ({ system_name: "Jita", cargo_capacity: 12000 })),
  listPinnedOpportunities: vi.fn(async () => []),
  removePinnedOpportunity: vi.fn(async () => ({ status: "deleted" })),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
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
  getSystemsList: vi.fn(async () => []),
  recalculateRadiusDistanceLens: vi.fn(async () => ({ results: [] })),
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
vi.mock("@/lib/useVersionCheck", () => ({ useVersionCheck: () => ({ appVersion: "test", latestVersion: "test", hasUpdate: false, dismissedForSession: false, autoUpdateSupported: false, platform: "web", releaseURL: "" }) }));
vi.mock("@/lib/useEsiStatus", () => ({ useEsiStatus: () => ({ esiAvailable: true }) }));
vi.mock("@/lib/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/components/Toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/Toast")>("@/components/Toast");
  return { ...actual, useGlobalToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }) };
});
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

vi.mock("@/components/RadiusRouteWorkspace", () => ({
  RadiusRouteWorkspace: (props: { onOpenBatchBuilderForRoute?: (routeKey: string) => void }) => (
    <div data-testid="route-workspace-mock">
      <button type="button" onClick={() => props.onOpenBatchBuilderForRoute?.(routeKey)}>workspace-open-valid</button>
      <button type="button" onClick={() => props.onOpenBatchBuilderForRoute?.("route:missing")}>workspace-open-missing</button>
    </div>
  ),
}));

vi.mock("@/components/ScanResultsTable", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    ScanResultsTable: (props: {
      tradeStateTab?: string;
      results: unknown[];
      onOpenBatchBuilderForRoute?: (routeKey: string) => void;
      batchBuilderRouteRequest?: { routeKey: string; requestId: number } | null;
      onBatchBuilderRouteRequestConsumed?: (requestId: number) => void;
    }) => {
      const consumedRef = React.useRef<number | null>(null);
      const [openCount, setOpenCount] = React.useState(0);
      const [lastRoute, setLastRoute] = React.useState("");
      const [isOpen, setIsOpen] = React.useState(false);

      React.useEffect(() => {
        if (!props.batchBuilderRouteRequest) return;
        if (consumedRef.current === props.batchBuilderRouteRequest.requestId) return;
        consumedRef.current = props.batchBuilderRouteRequest.requestId;
        setOpenCount((prev) => prev + 1);
        setLastRoute(props.batchBuilderRouteRequest.routeKey);
        setIsOpen(true);
        props.onBatchBuilderRouteRequestConsumed?.(props.batchBuilderRouteRequest.requestId);
      }, [props.batchBuilderRouteRequest, props.onBatchBuilderRouteRequestConsumed]);

      return (
        <div data-testid={`rows-${props.tradeStateTab ?? "unknown"}`}>
          {props.results.length}
          <button data-testid={`open-route-batch-${props.tradeStateTab ?? "unknown"}`} type="button" onClick={() => props.onOpenBatchBuilderForRoute?.(routeKey)}>open-route-batch</button>
          <button data-testid={`open-missing-route-batch-${props.tradeStateTab ?? "unknown"}`} type="button" onClick={() => props.onOpenBatchBuilderForRoute?.("route:missing")}>open-missing-route-batch</button>
          <button data-testid={`close-batch-${props.tradeStateTab ?? "unknown"}`} type="button" onClick={() => setIsOpen(false)}>close-batch</button>
          <span data-testid={`batch-open-count-${props.tradeStateTab ?? "unknown"}`}>{openCount}</span>
          <span data-testid={`batch-last-route-${props.tradeStateTab ?? "unknown"}`}>{lastRoute}</span>
          <span data-testid={`batch-open-state-${props.tradeStateTab ?? "unknown"}`}>{String(isOpen)}</span>
        </div>
      );
    },
  };
});



beforeEach(() => {
  localStorage.clear();
  (globalThis as any).__openCount = 0;
  (globalThis as any).__lastRoute = "";
  (globalThis as any).__isOpen = false;
  (globalThis as any).__consumedRef = { current: null };
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ patrons: [] }) })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App route batch builder flow", () => {
  it("keeps Route tab active, consumes requests once, and reopens on a second click", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByTestId("rows-radius")).toHaveTextContent("1"));

    fireEvent.click(screen.getByRole("tab", { name: "tabRadiusRoute" }));
    expect(screen.getByRole("tab", { name: "tabRadiusRoute" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "workspace-open-valid" }));
    expect(screen.getByTestId("batch-open-count-radius")).toHaveTextContent("1");
    expect(screen.getByTestId("batch-last-route-radius")).toHaveTextContent(routeKey);
    expect(screen.getByRole("tab", { name: "tabRadiusRoute" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByTestId("close-batch-radius"));
    expect(screen.getByTestId("batch-open-state-radius")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("tab", { name: "tabRadius" }));
    fireEvent.click(screen.getByRole("tab", { name: "tabRadiusRoute" }));
    expect(screen.getByTestId("batch-open-count-radius")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "workspace-open-valid" }));
    expect(screen.getByTestId("batch-open-count-radius")).toHaveTextContent("2");
  });

  it("does not open a wrong fallback route when explicit route key is missing", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "scan" }));
    await waitFor(() => expect(screen.getByTestId("rows-radius")).toHaveTextContent("1"));

    fireEvent.click(screen.getByRole("button", { name: "workspace-open-missing" }));
    expect(screen.getByTestId("batch-open-count-radius")).toHaveTextContent("0");
    expect(screen.getByTestId("batch-last-route-radius")).toHaveTextContent("");
  });
});
