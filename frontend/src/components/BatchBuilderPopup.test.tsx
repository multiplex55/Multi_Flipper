import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlipResult } from "@/lib/types";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { BatchBuilderPopup } from "@/components/BatchBuilderPopup";

function makeRow(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Item",
    Volume: 1,
    BuyPrice: 100,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 120,
    SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 20,
    MarginPercent: 20,
    UnitsToBuy: 10,
    BuyOrderRemain: 10,
    SellOrderRemain: 10,
    TotalProfit: 200,
    ProfitPerJump: 20,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 0,
    DailyVolume: 1000,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 100,
    ...overrides,
  };
}

function renderPopup({ anchorRow, rows }: { anchorRow: FlipResult | null; rows: FlipResult[] }) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <BatchBuilderPopup open onClose={() => undefined} anchorRow={anchorRow} rows={rows} />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe("BatchBuilderPopup copy manifest", () => {
  const writeText = vi.fn<(_: string) => Promise<void>>(() => Promise.resolve());

  const anchorRow = makeRow({
    TypeID: 11,
    TypeName: "Anchor Paste",
    Volume: 1,
    ProfitPerUnit: 100,
    UnitsToBuy: 1500,
  });

  const rows = [
    anchorRow,
    makeRow({
      TypeID: 22,
      TypeName: "Dense Isogen",
      Volume: 2,
      ProfitPerUnit: 300,
      UnitsToBuy: 2000,
    }),
    makeRow({
      TypeID: 33,
      TypeName: "Medium Mexallon",
      Volume: 4,
      ProfitPerUnit: 300,
      UnitsToBuy: 2500,
    }),
  ];

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("writes summary, detailed lines, blank separator, and appended multibuy block", async () => {
    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Copy manifest" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const manifest = writeText.mock.calls[0][0];

    expect(manifest).toContain("Route: Jita IV - Moon 4 -> Amarr VIII (Oris) - Emperor Family Academy");
    expect(manifest).toContain("Items: 3");
    expect(manifest).toContain("Anchor Paste | qty 1,500 | vol 1,500 m3 | profit 150,000 ISK");
    expect(manifest).toContain("Dense Isogen | qty 2,000 | vol 4,000 m3 | profit 600,000 ISK");
    expect(manifest).toContain("\n\nAnchor Paste 1500\nDense Isogen 2000\nMedium Mexallon 2500");
  });

  it("appends quantities without commas and only multibuy fields", async () => {
    renderPopup({ anchorRow, rows });

    fireEvent.click(await screen.findByRole("button", { name: "Copy manifest" }));

    const manifest = writeText.mock.calls[0][0];
    const appended = manifest.split("\n\n").at(-1) ?? "";

    expect(appended).toContain("Anchor Paste 1500");
    expect(appended).not.toContain("Anchor Paste 1,500");
    expect(appended).not.toContain("Route:");
    expect(appended).not.toContain("Total");
    expect(appended).not.toContain("qty");
    expect(appended).not.toContain("vol");
    expect(appended).not.toContain("profit");
    expect(appended).not.toContain("ISK");
  });

  it("keeps appended item order aligned with displayed batch order", async () => {
    renderPopup({ anchorRow, rows });

    const table = await screen.findByRole("table");
    const dataRows = within(table).getAllByRole("row").slice(1);
    const displayedOrder = dataRows.map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");

    fireEvent.click(await screen.findByRole("button", { name: "Copy manifest" }));

    const manifest = writeText.mock.calls[0][0];
    const appendedNames = (manifest.split("\n\n").at(-1) ?? "")
      .split("\n")
      .filter(Boolean)
      .map((line) => line.replace(/\s\d+$/, ""));

    expect(appendedNames).toEqual(displayedOrder);
  });

  it("does not call clipboard when there are no batch lines or no anchor", async () => {

    const mismatchRender = renderPopup({
      anchorRow,
      rows: [
        makeRow({
          TypeID: 99,
          TypeName: "Different Route",
          BuySystemID: 30002510,
          BuyStation: "Dodixie IX - Moon 20",
        }),
      ],
    });

    const noCandidatesButton = await screen.findByRole("button", { name: "Copy manifest" });
    expect(noCandidatesButton).toBeDisabled();
    fireEvent.click(noCandidatesButton);
    expect(writeText).not.toHaveBeenCalled();

    mismatchRender.unmount();

    renderPopup({ anchorRow: null, rows });
    expect(screen.queryByRole("button", { name: "Copy manifest" })).not.toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
  });
});
