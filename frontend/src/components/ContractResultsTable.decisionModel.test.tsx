import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ContractResultsTable } from "@/components/ContractResultsTable";
import type { ContractResult } from "@/lib/types";

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
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
}));

const result: ContractResult = { ContractID: 1, Title: "A", Price: 1, MarketValue: 3, Profit: 2, ExpectedProfit: 2, MarginPercent: 200, SellConfidence: 0.8, EstLiquidationDays: 2, Volume: 1, StationName: "Jita", SystemName: "Jita", RegionName: "The Forge", LiquidationSystemName: "Jita", ItemCount: 1, Jumps: 1, ProfitPerJump: 2 };

describe("ContractResultsTable decision model", () => {
  afterEach(() => cleanup());
  it("renders score explain/save/filter chips from shared helpers", async () => {
    render(<I18nProvider><ToastProvider><ContractResultsTable results={[result]} scanning={false} progress="" /></ToastProvider></I18nProvider>);
    expect(await screen.findByText("Rows: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save/Pin pattern" }));
    fireEvent.click(screen.getByRole("button", { name: "Why this recommendation?" }));
    expect(await screen.findByText("Final score")).toBeInTheDocument();
  });
});
