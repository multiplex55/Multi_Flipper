import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BatchBuilderPopup } from "@/components/BatchBuilderPopup";
import type { FlipResult } from "@/lib/types";

const addToastMock = vi.fn();

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/Toast", () => ({
  useGlobalToast: () => ({
    addToast: addToastMock,
  }),
}));

vi.mock("@/components/Modal", () => ({
  Modal: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
}));

function makeRow(overrides: Partial<FlipResult>): FlipResult {
  return {
    TypeID: 1,
    TypeName: "Tritanium",
    Volume: 2,
    BuyPrice: 10,
    BuyStation: "Jita IV - Moon 4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 15,
    SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 5,
    MarginPercent: 50,
    UnitsToBuy: 1,
    BuyOrderRemain: 1,
    SellOrderRemain: 1,
    TotalProfit: 5,
    ProfitPerJump: 1,
    BuyJumps: 1,
    SellJumps: 1,
    TotalJumps: 2,
    DailyVolume: 1,
    Velocity: 1,
    PriceTrend: 0,
    BuyCompetitors: 1,
    SellCompetitors: 1,
    DailyProfit: 1,
    ...overrides,
  };
}

describe("BatchBuilderPopup", () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    cleanup();
  });

  const anchorRow = makeRow({
    TypeID: 101,
    TypeName: "Mega Pulse Laser I",
    UnitsToBuy: 1500,
    BuyOrderRemain: 1500,
    SellOrderRemain: 1500,
    Volume: 1.5,
    ProfitPerUnit: 1200,
    BuyPrice: 8500,
  });

  const rows: FlipResult[] = [
    anchorRow,
    makeRow({
      TypeID: 202,
      TypeName: "Nanite Repair Paste",
      UnitsToBuy: 75,
      BuyOrderRemain: 75,
      SellOrderRemain: 75,
      Volume: 0.01,
      ProfitPerUnit: 200,
      BuyPrice: 14000,
    }),
    makeRow({
      TypeID: 303,
      TypeName: "Wrong Route Item",
      BuySystemID: 31000001,
      UnitsToBuy: 999,
      BuyOrderRemain: 999,
      SellOrderRemain: 999,
    }),
  ];

  beforeEach(() => {
    addToastMock.mockReset();
    writeTextMock.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  it("copies manifest with route/summary, detailed lines, separator, and appended multibuy block", async () => {
    render(
      <BatchBuilderPopup open onClose={() => {}} anchorRow={anchorRow} rows={rows} defaultCargoM3={0} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "batchBuilderCopyManifest" }));

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));

    const manifest = String(writeTextMock.mock.calls[0][0]);

    expect(manifest).toContain(
      "Route: Jita IV - Moon 4 -> Amarr VIII (Oris) - Emperor Family Academy",
    );
    expect(manifest).toContain("Cargo m3: batchBuilderCargoUnlimited");
    expect(manifest).toContain("Items: 2");
    expect(manifest).toContain(
      "Mega Pulse Laser I | qty 1,500 | vol 2,250 m3 | profit 1,800,000 ISK",
    );
    expect(manifest).toContain(
      "Nanite Repair Paste | qty 75 | vol 0.8 m3 | profit 15,000 ISK",
    );
    expect(manifest).toMatch(/profit 15,000 ISK\n\nMega Pulse Laser I 1500/);
    expect(manifest).toContain("\nMega Pulse Laser I 1500\nNanite Repair Paste 75");
  });

  it("uses unlocalized quantities in appended lines and excludes summary/detail tokens", async () => {
    render(
      <BatchBuilderPopup open onClose={() => {}} anchorRow={anchorRow} rows={rows} defaultCargoM3={0} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "batchBuilderCopyManifest" }));

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));
    const manifest = String(writeTextMock.mock.calls[0][0]);
    const appendedBlock = manifest.split("\n\n").at(-1) ?? "";

    expect(appendedBlock).toContain("Mega Pulse Laser I 1500");
    expect(appendedBlock).not.toContain("Mega Pulse Laser I 1,500");
    expect(appendedBlock).not.toMatch(/Route:|Cargo|Total|\| qty |\| vol |\| profit /);
    expect(appendedBlock.split("\n")).toEqual([
      "Mega Pulse Laser I 1500",
      "Nanite Repair Paste 75",
    ]);
  });

  it("does not write to clipboard when there are no batch lines or no anchor row", async () => {
    const noRouteRows = [
      makeRow({
        TypeID: 909,
        TypeName: "Other Route",
        BuySystemID: 39999999,
        SellSystemID: 38888888,
        UnitsToBuy: 250,
      }),
    ];

    const { rerender } = render(
      <BatchBuilderPopup
        open
        onClose={() => {}}
        anchorRow={anchorRow}
        rows={noRouteRows}
        defaultCargoM3={0}
      />,
    );

    const copyButton = screen.getByRole("button", { name: "batchBuilderCopyManifest" });
    expect(copyButton).toBeDisabled();
    fireEvent.click(copyButton);
    expect(writeTextMock).not.toHaveBeenCalled();

    rerender(<BatchBuilderPopup open onClose={() => {}} anchorRow={null} rows={rows} defaultCargoM3={0} />);
    expect(screen.queryByRole("button", { name: "batchBuilderCopyManifest" })).not.toBeInTheDocument();
    expect(writeTextMock).not.toHaveBeenCalled();
  });
});
