import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { ScanResultsTable } from "@/components/ScanResultsTable";
import type { FlipResult } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  addToWatchlist: vi.fn(async () => undefined),
  addPinnedOpportunity: vi.fn(async () => []),
  clearStationTradeStates: vi.fn(async () => undefined),
  deleteStationTradeStates: vi.fn(async () => undefined),
  getStationTradeStates: vi.fn(async () => []),
  getGankCheck: vi.fn(async () => ({ route: [] })),
  getGankCheckBatch: vi.fn(async () => []),
  getWatchlist: vi.fn(async () => []),
  openMarketInGame: vi.fn(async () => undefined),
  listPinnedOpportunities: vi.fn(async () => []),
  rebootStationCache: vi.fn(async () => undefined),
  removeFromWatchlist: vi.fn(async () => undefined),
  removePinnedOpportunity: vi.fn(async () => ({ status: "deleted" })),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
  setStationTradeState: vi.fn(async () => undefined),
  setWaypointInGame: vi.fn(async () => undefined),
}));

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 101,
    TypeName: 'Widget "Prime", Mk2\nLine',
    Volume: 99_991,
    BuyPrice: 100,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 125,
    SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 25,
    MarginPercent: 25,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 250,
    ProfitPerJump: 20,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 0,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 50,
    ...overrides,
  };
}

function renderTable(tradeStateTab: "radius" | "region") {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ScanResultsTable
          results={[makeRow()]}
          scanning={false}
          progress=""
          tradeStateTab={tradeStateTab}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

function hideVolumeColumn() {
  fireEvent.click(screen.getByRole("button", { name: /^Columns$/i }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Volume/i }));
}

async function exportCsvText() {
  const createObjectURLMock = vi.mocked(URL.createObjectURL);
  fireEvent.click(screen.getByRole("button", { name: /^Export CSV$/i }));

  expect(createObjectURLMock).toHaveBeenCalledTimes(1);
  const blob = createObjectURLMock.mock.calls[0]?.[0] as Blob;
  expect(blob).toBeInstanceOf(Blob);

  const csvText = await blob.text();
  return csvText.replace(/^\uFEFF/, "");
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ScanResultsTable Radius CSV export column visibility", () => {
  it("exports hidden Radius columns and escapes commas/quotes/newlines", async () => {
    const createObjectURLMock = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:radius-export");
    const revokeObjectURLMock = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickMock = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    renderTable("radius");
    hideVolumeColumn();

    const csvText = await exportCsvText();

    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:radius-export");

    const [headerLine, ...dataLines] = csvText.split("\n");
    const dataText = dataLines.join("\n");

    expect(headerLine).toContain("Volume");
    expect(dataText).toContain("99991");
    expect(dataText).toContain('"Widget ""Prime"", Mk2');
    expect(dataText).toContain("Line\"");
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it("keeps non-Radius export scoped to visible columns", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:region-export");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    renderTable("region");
    hideVolumeColumn();

    const csvText = await exportCsvText();
    const [headerLine, ...dataLines] = csvText.split("\n");
    const dataText = dataLines.join("\n");

    expect(headerLine).not.toContain("Volume");
    expect(dataText).not.toContain("99991");
  });
});
