import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { CHARACTER_FEE_PREFS_STORAGE_KEY } from "@/lib/characterFeePrefs";

type AuthState = {
  logged_in: boolean;
  character_id?: number;
  character_name?: string;
  characters?: Array<{ character_id: number; character_name: string; active?: boolean }>;
};

let authState: AuthState = { logged_in: false, characters: [] };

const mockGetConfig = vi.fn(async () => ({}));
const mockUpdateConfig = vi.fn(async (_payload: unknown) => ({}));

vi.mock("@/lib/api", () => ({
  applyAppUpdate: vi.fn(),
  getUpdateCheckStatus: vi.fn(),
  getConfig: () => mockGetConfig(),
  skipAppUpdateForSession: vi.fn(async () => ({})),
  updateConfig: (payload: unknown) => mockUpdateConfig(payload),
  scan: vi.fn(),
  scanMultiRegion: vi.fn(),
  scanRegionalDayTrader: vi.fn(),
  scanContracts: vi.fn(),
  testAlertChannels: vi.fn(),
  getWatchlist: vi.fn(async () => []),
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
  ParametersPanel: ({ params, onChange }: { params: any; onChange: any }) => (
    <div>
      <output data-testid="fees-tax">{String(params.sales_tax_percent)}</output>
      <button
        onClick={() =>
          onChange((prev: any) => ({
            ...prev,
            sales_tax_percent: 11,
            broker_fee_percent: 2,
            split_trade_fees: true,
            buy_broker_fee_percent: 1,
            sell_broker_fee_percent: 3,
            buy_sales_tax_percent: 0.5,
            sell_sales_tax_percent: 10,
          }))
        }
      >
        set-fees
      </button>
    </div>
  ),
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
  authState = { logged_in: false, characters: [] };
  mockGetConfig.mockClear();
  mockUpdateConfig.mockClear();
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

describe("App character-scoped fee snapshots", () => {
  it("hydrates strategy score from config and includes it in update patches", async () => {
    mockGetConfig.mockResolvedValueOnce({
      strategy_score: {
        profit_weight: 50,
        risk_weight: 20,
        velocity_weight: 15,
        jump_weight: 10,
        capital_weight: 5,
      },
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "set-fees" }));

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalled();
    });

    const lastCallIndex = mockUpdateConfig.mock.calls.length - 1;
    const lastPayload = (
      lastCallIndex >= 0 ? mockUpdateConfig.mock.calls[lastCallIndex]?.[0] : undefined
    ) as Record<string, unknown>;
    expect(lastPayload.strategy_score).toEqual({
      profit_weight: 50,
      risk_weight: 20,
      velocity_weight: 15,
      jump_weight: 10,
      capital_weight: 5,
    });
  });

  it("restores stored fee snapshots when switching active character", async () => {
    localStorage.setItem(
      CHARACTER_FEE_PREFS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        by_character: {
          "1001": {
            sales_tax_percent: 3,
            broker_fee_percent: 1,
            split_trade_fees: false,
            buy_broker_fee_percent: 0,
            sell_broker_fee_percent: 1,
            buy_sales_tax_percent: 0,
            sell_sales_tax_percent: 3,
          },
          "2002": {
            sales_tax_percent: 6,
            broker_fee_percent: 2,
            split_trade_fees: true,
            buy_broker_fee_percent: 1,
            sell_broker_fee_percent: 2,
            buy_sales_tax_percent: 1,
            sell_sales_tax_percent: 6,
          },
        },
      }),
    );

    authState = {
      logged_in: true,
      character_id: 1001,
      character_name: "Alpha",
      characters: [
        { character_id: 1001, character_name: "Alpha", active: true },
        { character_id: 2002, character_name: "Bravo", active: false },
      ],
    };

    const view = render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("fees-tax")).toHaveTextContent("3");
    });

    authState = {
      ...authState,
      character_id: 2002,
      character_name: "Bravo",
      characters: [
        { character_id: 1001, character_name: "Alpha", active: false },
        { character_id: 2002, character_name: "Bravo", active: true },
      ],
    };
    view.rerender(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("fees-tax")).toHaveTextContent("6");
    });
  });

  it("persists fee updates only for active character", async () => {
    authState = {
      logged_in: true,
      character_id: 777,
      character_name: "Saver",
      characters: [{ character_id: 777, character_name: "Saver", active: true }],
    };

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "set-fees" }));

    await waitFor(() => {
      const raw = localStorage.getItem(CHARACTER_FEE_PREFS_STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string) as {
        version: number;
        by_character: Record<string, { sales_tax_percent: number }>;
      };
      expect(parsed.version).toBe(1);
      expect(parsed.by_character["777"].sales_tax_percent).toBe(11);
    });
  });

  it("keeps logged-out behavior safe and does not require character storage", async () => {
    authState = { logged_in: false, characters: [] };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("fees-tax")).toHaveTextContent("8");
    });

    fireEvent.click(screen.getByRole("button", { name: "set-fees" }));

    await waitFor(() => {
      expect(localStorage.getItem(CHARACTER_FEE_PREFS_STORAGE_KEY)).toBeNull();
    });
  });
});
