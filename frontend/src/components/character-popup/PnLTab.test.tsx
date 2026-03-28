import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PnLTab } from "@/components/character-popup/PnLTab";
import type { PortfolioPnL } from "@/lib/types";

const getPortfolioPnLMock = vi.fn();

vi.mock("@/lib/api", () => ({
  getPortfolioPnL: (...args: unknown[]) => getPortfolioPnLMock(...args),
}));

afterEach(() => {
  cleanup();
  getPortfolioPnLMock.mockReset();
});

function makePortfolioResponse(topStations: PortfolioPnL["top_stations"]): PortfolioPnL {
  return {
    daily_pnl: [
      {
        date: "2026-03-20",
        buy_total: 1000,
        sell_total: 1200,
        net_pnl: 200,
        cumulative_pnl: 200,
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
    top_items: [],
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
    getPortfolioPnLMock.mockResolvedValue(
      makePortfolioResponse([
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
      ]),
    );

    render(
      <PnLTab
        formatIsk={(v) => v.toFixed(0)}
        characterScope={90000001}
        t={(key) => key}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /pnlStationBreakdown/i }));

    expect(await screen.findByText("Jita IV - Moon 4 - Caldari Navy Assembly Plant")).toBeInTheDocument();
    expect(screen.getByText("#60008494")).toBeInTheDocument();
  });
});
