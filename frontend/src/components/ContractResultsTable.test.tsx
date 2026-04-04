import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ContractResultsTable } from "@/components/ContractResultsTable";
import type { ContractResult } from "@/lib/types";
import { addPinnedOpportunity, removePinnedOpportunity } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  addPinnedOpportunity: vi.fn(async () => []),
  clearStationTradeStates: vi.fn(async () => undefined),
  deleteStationTradeStates: vi.fn(async () => undefined),
  getContractDetails: vi.fn(async () => ({ contract_id: 1, items: [] })),
  getStationTradeStates: vi.fn(async () => []),
  openContractInGame: vi.fn(async () => undefined),
  listPinnedOpportunities: vi.fn(async () => []),
  rebootStationCache: vi.fn(async () => ({ cleared: 0 })),
  removePinnedOpportunity: vi.fn(async () => ({ status: "deleted" })),
  setStationTradeState: vi.fn(async () => undefined),
}));

function row(overrides: Partial<ContractResult> = {}): ContractResult {
  return {
    ContractID: 1,
    Title: "Contract",
    Price: 100_000_000,
    MarketValue: 120_000_000,
    Profit: 20_000_000,
    ExpectedProfit: 20_000_000,
    MarginPercent: 20,
    SellConfidence: 0.8,
    EstLiquidationDays: 8,
    Volume: 1000,
    StationName: "Jita",
    SystemName: "Jita",
    RegionName: "The Forge",
    LiquidationSystemName: "Jita",
    ItemCount: 3,
    Jumps: 2,
    ProfitPerJump: 10_000_000,
    ...overrides,
  };
}

function renderTable(results: ContractResult[]) {
  render(
    <I18nProvider>
      <ToastProvider>
        <ContractResultsTable results={results} scanning={false} progress="" />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("ContractResultsTable opportunity score", () => {
  afterEach(() => cleanup());

  it("renders score and shows explanation popover", async () => {
    renderTable([row()]);
    expect(screen.getAllByText("Score").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("Why this score?"));
    expect(await screen.findByText("Final score")).toBeInTheDocument();
    expect(screen.getByText("Factor")).toBeInTheDocument();
  });
});

describe("ContractResultsTable pinning", () => {
  it("renders pin and calls add/remove pinned opportunity", async () => {
    renderTable([row()]);
    const pinBtn = await screen.findByLabelText("Pin row");
    fireEvent.click(pinBtn);
    expect(addPinnedOpportunity).toHaveBeenCalled();
    const key = vi.mocked(addPinnedOpportunity).mock.calls[0][0].opportunity_key;
    fireEvent.click(await screen.findByLabelText("Unpin row"));
    expect(removePinnedOpportunity).toHaveBeenCalledWith(key);
  });
});
