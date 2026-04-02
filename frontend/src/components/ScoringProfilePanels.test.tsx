import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParametersPanel } from "@/components/ParametersPanel";
import { ContractParametersPanel } from "@/components/ContractParametersPanel";
import { StationTrading } from "@/components/StationTrading";
import type { ScanParams, StrategyScoreConfig } from "@/lib/types";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "en" }),
}));

vi.mock("@/components/Toast", () => ({
  useGlobalToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  getStations: vi.fn().mockResolvedValue([]),
  getStructures: vi.fn().mockResolvedValue([]),
  getCharacterInfo: vi.fn().mockResolvedValue({ skills: { skills: [] } }),
  clearStationTradeStates: vi.fn().mockResolvedValue(undefined),
  deleteStationTradeStates: vi.fn().mockResolvedValue(undefined),
  getStationCommand: vi.fn().mockResolvedValue({ rows: [], summary: null }),
  getStationTradeStates: vi.fn().mockResolvedValue([]),
  rebootStationCache: vi.fn().mockResolvedValue(undefined),
  scanStation: vi.fn().mockResolvedValue({ data: [] }),
  setStationTradeState: vi.fn().mockResolvedValue(undefined),
  getWatchlist: vi.fn().mockResolvedValue([]),
  addToWatchlist: vi.fn().mockResolvedValue(undefined),
  removeFromWatchlist: vi.fn().mockResolvedValue(undefined),
  openMarketInGame: vi.fn().mockResolvedValue(undefined),
  setWaypointInGame: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
});

const params: ScanParams = {
  system_name: "Jita",
  cargo_capacity: 5000,
  buy_radius: 5,
  sell_radius: 10,
  min_margin: 5,
  sales_tax_percent: 8,
  broker_fee_percent: 3,
};

const strategy: StrategyScoreConfig = {
  profit_weight: 35,
  risk_weight: 25,
  velocity_weight: 20,
  jump_weight: 10,
  capital_weight: 10,
};

describe("ScoringProfile integration", () => {
  it("renders in ParametersPanel and emits strategy updates", () => {
    const onStrategyScoreChange = vi.fn();
    render(
      <ParametersPanel
        params={params}
        onChange={vi.fn()}
        strategyScore={strategy}
        onStrategyScoreChange={onStrategyScoreChange}
      />,
    );

    expect(screen.getByText("Scoring Profile")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Profit weight"), {
      target: { value: "50" },
    });
    expect(onStrategyScoreChange).toHaveBeenCalledWith({
      ...strategy,
      profit_weight: 50,
    });
  });

  it("renders in ContractParametersPanel and emits strategy updates", () => {
    const onStrategyScoreChange = vi.fn();
    render(
      <ContractParametersPanel
        params={params}
        onChange={vi.fn()}
        strategyScore={strategy}
        onStrategyScoreChange={onStrategyScoreChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /contractFilters/i }));
    expect(screen.getByText("Scoring Profile")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Risk weight"), {
      target: { value: "30" },
    });
    expect(onStrategyScoreChange).toHaveBeenCalledWith({
      ...strategy,
      risk_weight: 30,
    });
  });

  it("renders in StationTrading settings and emits strategy updates", () => {
    const onStrategyScoreChange = vi.fn();
    render(
      <StationTrading
        params={params}
        onChange={vi.fn()}
        strategyScore={strategy}
        onStrategyScoreChange={onStrategyScoreChange}
      />,
    );

    expect(screen.getByText("Scoring Profile")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Velocity weight"), {
      target: { value: "15" },
    });
    expect(onStrategyScoreChange).toHaveBeenCalledWith({
      ...strategy,
      velocity_weight: 15,
    });
  });
});
