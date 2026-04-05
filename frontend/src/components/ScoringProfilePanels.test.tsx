import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParametersPanel } from "@/components/ParametersPanel";
import { ContractParametersPanel } from "@/components/ContractParametersPanel";
import { StationTrading } from "@/components/StationTrading";
import type { ScanParams, StationTrade, StrategyScoreConfig } from "@/lib/types";

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
  getBanlistItems: vi.fn().mockResolvedValue([]),
  getBannedStations: vi.fn().mockResolvedValue([]),
  listPinnedOpportunities: vi.fn().mockResolvedValue([]),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
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

function makeTrade(overrides: Partial<StationTrade> = {}): StationTrade {
  return {
    TypeID: 34,
    TypeName: "Tritanium",
    Volume: 0.01,
    StationID: 60003760,
    StationName: "Jita IV - Moon 4",
    RegionID: 10000002,
    SystemID: 30000142,
    BuyPrice: 1,
    SellPrice: 2,
    Spread: 1,
    ProfitPerUnit: 1,
    MarginPercent: 10,
    DailyVolume: 1000,
    BuyOrderCount: 10,
    SellOrderCount: 10,
    BuyVolume: 1000,
    SellVolume: 1000,
    TotalProfit: 100,
    DailyProfit: 100,
    RealizableDailyProfit: 100,
    ROI: 5,
    CapitalRequired: 10000,
    BuyUnitsPerDay: 100,
    SellUnitsPerDay: 100,
    BvSRatio: 1,
    CTS: 40,
    SDS: 10,
    PVI: 10,
    OBDS: 10,
    DOS: 5,
    S2BPerDay: 100,
    BfSPerDay: 50,
    S2BBfSRatio: 2,
    PeriodROI: 3,
    NowROI: 2,
    VWAP: 1.5,
    CI: 10,
    AvgPrice: 1.4,
    PriceHigh: 1.8,
    PriceLow: 1.0,
    IsHighRiskFlag: false,
    IsExtremePriceFlag: false,
    ...overrides,
  };
}

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

  it("updates displayed station score when scoring slider changes", () => {
    function Wrapper() {
      const [value, setValue] = React.useState<StrategyScoreConfig>(strategy);
      return (
        <StationTrading
          params={params}
          onChange={vi.fn()}
          strategyScore={value}
          onStrategyScoreChange={setValue}
          loadedResults={[
            makeTrade({
              TypeID: 1,
              TypeName: "Profit Heavy",
              ExpectedProfit: 100_000_000,
              CapitalRequired: 900_000_000,
              PVI: 40,
              OBDS: 35,
            }),
            makeTrade({
              TypeID: 2,
              TypeName: "Risk Light",
              ExpectedProfit: 45_000_000,
              CapitalRequired: 120_000_000,
              PVI: 10,
              OBDS: 10,
            }),
          ]}
        />
      );
    }

    render(<Wrapper />);
    const scoreButtons = screen.getAllByLabelText("Why this score?");
    const before = scoreButtons.map((button) => button.textContent);
    fireEvent.change(screen.getByLabelText("Profit weight"), {
      target: { value: "70" },
    });
    const after = screen
      .getAllByLabelText("Why this score?")
      .map((button) => button.textContent);
    expect(after).not.toEqual(before);
  });
});
