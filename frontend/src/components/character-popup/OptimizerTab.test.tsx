import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OptimizerTab } from "@/components/character-popup/OptimizerTab";

const getPortfolioOptimizationMock = vi.fn();

vi.mock("@/lib/api", () => ({
  getPortfolioOptimization: (...args: unknown[]) => getPortfolioOptimizationMock(...args),
}));

afterEach(() => {
  cleanup();
  getPortfolioOptimizationMock.mockReset();
});

function makeOptimizerResult() {
  return {
    ok: true as const,
    data: {
      assets: [
        {
          type_id: 34,
          type_name: "Tritanium",
          avg_daily_pnl: 100,
          volatility: 10,
          sharpe_ratio: 1.2,
          current_weight: 0.5,
          total_invested: 1000,
          total_pnl: 500,
          trading_days: 12,
        },
      ],
      correlation_matrix: [[1]],
      current_weights: [0.5],
      optimal_weights: [0.7],
      min_var_weights: [0.3],
      efficient_frontier: [{ risk: 10, return: 100 }],
      diversification_ratio: 1.1,
      current_sharpe: 0.9,
      optimal_sharpe: 1.3,
      min_var_sharpe: 0.8,
      hhi: 0.2,
      suggestions: [
        {
          type_id: 35,
          type_name: "Pyerite",
          action: "increase" as const,
          current_pct: 10,
          optimal_pct: 20,
          delta_pct: 10,
          reason: "high_sharpe",
        },
      ],
    },
  };
}

describe("OptimizerTab watchlist actions", () => {
  it("calls onAddToWatchlist from AssetTable rows", async () => {
    getPortfolioOptimizationMock.mockResolvedValue(makeOptimizerResult());

    let resolveRequest: (() => void) | undefined;
    const onAddToWatchlist = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(
      <OptimizerTab
        formatIsk={(v) => v.toFixed(0)}
        characterScope={90000001}
        t={(key) => key}
        onAddToWatchlist={onAddToWatchlist}
      />,
    );

    const assetButton = await screen.findByRole("button", { name: "addToWatchlist: Tritanium" });
    fireEvent.click(assetButton);

    expect(onAddToWatchlist).toHaveBeenCalledWith(34, "Tritanium");
    expect(assetButton).toBeDisabled();

    if (resolveRequest) {
      resolveRequest();
    }
    await waitFor(() => expect(assetButton).not.toBeDisabled());
  });

  it("calls onAddToWatchlist from SuggestionsPanel rows", async () => {
    getPortfolioOptimizationMock.mockResolvedValue(makeOptimizerResult());

    const onAddToWatchlist = vi.fn(async () => undefined);

    render(
      <OptimizerTab
        formatIsk={(v) => v.toFixed(0)}
        characterScope={90000001}
        t={(key) => key}
        onAddToWatchlist={onAddToWatchlist}
      />,
    );

    const suggestionButton = await screen.findByRole("button", { name: "addToWatchlist: Pyerite" });
    fireEvent.click(suggestionButton);

    expect(onAddToWatchlist).toHaveBeenCalledWith(35, "Pyerite");
  });

  it("re-enables button after callback rejection without false-positive success state", async () => {
    getPortfolioOptimizationMock.mockResolvedValue(makeOptimizerResult());

    const onAddToWatchlist = vi.fn(async () => {
      throw new Error("failed");
    });

    render(
      <OptimizerTab
        formatIsk={(v) => v.toFixed(0)}
        characterScope={90000001}
        t={(key) => key}
        onAddToWatchlist={onAddToWatchlist}
      />,
    );

    const button = await screen.findByRole("button", { name: "addToWatchlist: Tritanium" });
    fireEvent.click(button);

    await waitFor(() => expect(button).not.toBeDisabled());
    expect(button).toHaveTextContent("addToWatchlist");
    expect(onAddToWatchlist).toHaveBeenCalledTimes(1);
  });
});
