import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PnLTab } from "@/components/character-popup/PnLTab";
import { addToWatchlistWithToast } from "@/components/character-popup/watchlistActions";
import type { ItemPnL, PortfolioPnL } from "@/lib/types";

const getPortfolioPnLMock = vi.fn();
const getWatchlistMock = vi.fn();
const addToWatchlistMock = vi.fn();

vi.mock("@/lib/api", () => ({
  getPortfolioPnL: (...args: unknown[]) => getPortfolioPnLMock(...args),
  getWatchlist: (...args: unknown[]) => getWatchlistMock(...args),
  addToWatchlist: (...args: unknown[]) => addToWatchlistMock(...args),
}));

afterEach(() => {
  cleanup();
  getPortfolioPnLMock.mockReset();
  getWatchlistMock.mockReset();
  addToWatchlistMock.mockReset();
});

function makePortfolioResponse({
  topStations = [],
  topItems = [],
}: {
  topStations?: PortfolioPnL["top_stations"];
  topItems?: ItemPnL[];
} = {}): PortfolioPnL {
  return {
    daily_pnl: [
      {
        date: "2026-03-20",
        buy_total: 1000,
        sell_total: 1200,
        net_pnl: 200,
        cumulative_pnl: 200,
        revenue: 1200,
        expenses: 1000,
        net_income: 200,
        cumulative: 200,
        drawdown_pct: 0,
        transactions: 2,
      },
    ],
    summary: {
      total_pnl: 200,
      avg_daily_pnl: 200,
      best_day_pnl: 200,
      best_day_date: "2026-03-20",
      worst_day_pnl: 200,
      worst_day_date: "2026-03-20",
      profitable_days: 1,
      losing_days: 0,
      total_days: 1,
      win_rate: 100,
      total_bought: 1000,
      total_sold: 1200,
      roi_percent: 20,
      sharpe_ratio: 0,
      max_drawdown_pct: 0,
      max_drawdown_isk: 0,
      max_drawdown_days: 0,
      calmar_ratio: 0,
      profit_factor: 0,
      avg_win: 200,
      avg_loss: 0,
      expectancy_per_trade: 100,
      realized_trades: 1,
      realized_quantity: 10,
      open_positions: 0,
      open_cost_basis: 0,
      total_fees: 0,
      total_taxes: 0,
    },
    top_items: topItems,
    top_stations: topStations,
    ledger: [],
    open_positions: [],
    coverage: {
      total_sell_qty: 10,
      matched_sell_qty: 10,
      unmatched_sell_qty: 0,
      total_sell_value: 1200,
      matched_sell_value: 1200,
      unmatched_sell_value: 0,
      match_rate_qty_pct: 100,
      match_rate_value_pct: 100,
    },
    settings: {
      lookback_days: 30,
      sales_tax_percent: 8,
      broker_fee_percent: 1,
      ledger_limit: 500,
      include_unmatched_sell: false,
    },
  };
}

describe("PnLTab station table", () => {
  it("renders resolved station names and only falls back to #id when unavailable", async () => {
    getWatchlistMock.mockResolvedValue([]);
    getPortfolioPnLMock.mockResolvedValue(
      makePortfolioResponse({
        topStations: [
          {
            location_id: 60003760,
            location_name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
            total_bought: 1000,
            total_sold: 1200,
            net_pnl: 200,
            transactions: 2,
          },
          {
            location_id: 60008494,
            location_name: "",
            total_bought: 500,
            total_sold: 450,
            net_pnl: -50,
            transactions: 1,
          },
        ],
      }),
    );

    render(
      <PnLTab
        formatIsk={(v) => v.toFixed(0)}
        characterScope={90000001}
        t={(key) => key}
        onAddToWatchlist={vi.fn(async () => undefined)}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /pnlStationBreakdown/i }));

    expect(await screen.findByText("Jita IV - Moon 4 - Caldari Navy Assembly Plant")).toBeInTheDocument();
    expect(screen.getByText("#60008494")).toBeInTheDocument();
  });
});

describe("PnLTab watchlist action", () => {
  it("shows tracked indicator and disables add action for already watched items", async () => {
    getWatchlistMock.mockResolvedValue([
      {
        type_id: 34,
        type_name: "Tritanium",
        added_at: "2026-03-20T00:00:00Z",
        alert_min_margin: 10,
      },
    ]);
    getPortfolioPnLMock.mockResolvedValue(
      makePortfolioResponse({
        topItems: [
          {
            type_id: 34,
            type_name: "Tritanium",
            total_bought: 1000,
            total_sold: 1300,
            net_pnl: 300,
            margin_percent: 10,
            qty_bought: 500,
            qty_sold: 480,
            avg_buy_price: 2,
            avg_sell_price: 2.7,
            transactions: 2,
          },
        ],
      }),
    );

    const onAddToWatchlist = vi.fn(async () => undefined);

    render(
      <PnLTab
        formatIsk={(v) => v.toFixed(0)}
        characterScope={90000001}
        t={(key) => key}
        onAddToWatchlist={onAddToWatchlist}
      />,
    );

    expect(await screen.findByText(/watchlistTracked/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "addToWatchlist: Tritanium" })).not.toBeInTheDocument();
    expect(onAddToWatchlist).not.toHaveBeenCalled();
  });

  it("keeps add behavior for unwatched items and shows tracked indicator after pending add resolves", async () => {
    getWatchlistMock.mockResolvedValue([]);
    getPortfolioPnLMock.mockResolvedValue(
      makePortfolioResponse({
        topItems: [
          {
            type_id: 34,
            type_name: "Tritanium",
            total_bought: 1000,
            total_sold: 1300,
            net_pnl: 300,
            margin_percent: 10,
            qty_bought: 500,
            qty_sold: 480,
            avg_buy_price: 2,
            avg_sell_price: 2.7,
            transactions: 2,
          },
        ],
      }),
    );

    let resolveRequest: (() => void) | undefined;
    const onAddToWatchlist = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(
      <PnLTab
        formatIsk={(v) => v.toFixed(0)}
        characterScope={90000001}
        t={(key) => key}
        onAddToWatchlist={onAddToWatchlist}
      />,
    );

    const button = await screen.findByRole("button", { name: "addToWatchlist: Tritanium" });
    fireEvent.click(button);

    expect(onAddToWatchlist).toHaveBeenCalledWith(34, "Tritanium");
    expect(button).toBeDisabled();

    if (resolveRequest) {
      resolveRequest();
    }
    expect(await screen.findByText(/watchlistTracked/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "addToWatchlist: Tritanium" })).not.toBeInTheDocument();
  });

  it("switches to tracked indicator after successful add callback", async () => {
    getWatchlistMock.mockResolvedValue([]);
    getPortfolioPnLMock.mockResolvedValue(
      makePortfolioResponse({
        topItems: [
          {
            type_id: 34,
            type_name: "Tritanium",
            total_bought: 1000,
            total_sold: 1300,
            net_pnl: 300,
            margin_percent: 10,
            qty_bought: 500,
            qty_sold: 480,
            avg_buy_price: 2,
            avg_sell_price: 2.7,
            transactions: 2,
          },
        ],
      }),
    );

    const onAddToWatchlist = vi.fn(async () => undefined);

    render(
      <PnLTab
        formatIsk={(v) => v.toFixed(0)}
        characterScope={90000001}
        t={(key) => key}
        onAddToWatchlist={onAddToWatchlist}
      />,
    );

    const button = await screen.findByRole("button", { name: "addToWatchlist: Tritanium" });
    fireEvent.click(button);

    await waitFor(() => expect(onAddToWatchlist).toHaveBeenCalledWith(34, "Tritanium"));
    expect(await screen.findByText(/watchlistTracked/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "addToWatchlist: Tritanium" })).not.toBeInTheDocument();
  });
});

describe("addToWatchlistWithToast", () => {
  it("shows duplicate-safe success message when item already exists", async () => {
    addToWatchlistMock.mockResolvedValue({ inserted: false, items: [] });
    const addToast = vi.fn(() => 1);
    const t = (key: string) => key;

    await addToWatchlistWithToast({
      typeId: 34,
      typeName: "Tritanium",
      t: t as any,
      addToast,
    });

    expect(addToWatchlistMock).toHaveBeenCalledWith(34, "Tritanium");
    expect(addToast).toHaveBeenCalledWith("watchlistAlready", "success", 2200);
  });

  it("shows error toast when API rejects and does not emit success toast", async () => {
    addToWatchlistMock.mockRejectedValue(new Error("boom"));
    const addToast = vi.fn(() => 1);
    const t = (key: string) => key;

    await expect(
      addToWatchlistWithToast({
        typeId: 35,
        typeName: "Pyerite",
        t: t as any,
        addToast,
      }),
    ).rejects.toThrow("watchlist-add-failed");

    expect(addToast).toHaveBeenCalledWith("watchlistError", "error", 3000);
    expect(addToast).not.toHaveBeenCalledWith("watchlistItemAdded", "success", 2200);
  });
});
