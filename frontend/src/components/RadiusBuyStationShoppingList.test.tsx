import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadiusBuyStationShoppingListView } from "@/components/RadiusBuyStationShoppingList";
import type { RadiusBuyStationShoppingList } from "@/lib/radiusBuyStationShoppingList";
import { makeFlipResult } from "@/lib/testFixtures";

function makeList(): RadiusBuyStationShoppingList {
  const row = makeFlipResult({ TypeName: "Tritanium", BuyStation: "Jita 4-4", SellStation: "Amarr" });
  return {
    id: "buy:600001",
    buyGroupId: 600001,
    buyStationName: "Jita 4-4",
    buySystemName: "Jita",
    buySystemId: 300001,
    routeCount: 1,
    itemCount: 1,
    units: 10,
    volumeM3: 100,
    cargoFillPercent: 50,
    capitalIsk: 1000000,
    grossSellIsk: 1200000,
    totalProfitIsk: 200000,
    capitalEfficiency: 0.2,
    bestIskPerJump: 50000,
    avgExecutionQuality: 80,
    confidence: 75,
    worstTrapRisk: 20,
    actionableScore: 88,
    primarySellStation: "Amarr",
    lines: [{
      row,
      units: 10,
      volumeM3: 100,
      capitalIsk: 1000000,
      grossSellIsk: 1200000,
      profitIsk: 200000,
      routeKey: "r1",
      executionQuality: 80,
      confidence: 75,
      trapRisk: 20,
    }],
  };
}

describe("RadiusBuyStationShoppingListView", () => {
  it("renders station metrics and destination", () => {
    render(
      <RadiusBuyStationShoppingListView
        lists={[makeList()]}
        onOpenRows={vi.fn()}
        onCopyBuyChecklist={vi.fn()}
        onCopySellChecklist={vi.fn()}
        onCopyManifest={vi.fn()}
        onOpenBatch={vi.fn()}
        onVerifyStationGroup={vi.fn()}
      />,
    );

    expect(screen.getByText("Jita 4-4")).toBeInTheDocument();
    expect(screen.getByText(/Best sell:/i)).toBeInTheDocument();
    expect(screen.getByText(/Score 88.0/)).toBeInTheDocument();
  });

  it("fires all action callbacks", () => {
    cleanup();
    const onOpenRows = vi.fn();
    const onCopyBuyChecklist = vi.fn();
    const onCopySellChecklist = vi.fn();
    const onCopyManifest = vi.fn();
    const onOpenBatch = vi.fn();
    const onVerifyStationGroup = vi.fn();
    const list = makeList();

    render(
      <RadiusBuyStationShoppingListView
        lists={[list]}
        onOpenRows={onOpenRows}
        onCopyBuyChecklist={onCopyBuyChecklist}
        onCopySellChecklist={onCopySellChecklist}
        onCopyManifest={onCopyManifest}
        onOpenBatch={onOpenBatch}
        onVerifyStationGroup={onVerifyStationGroup}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /open rows/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /copy buy checklist/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /copy sell checklist/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /copy full manifest/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /open batch/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /verify station group/i })[0]);

    expect(onOpenRows).toHaveBeenCalledWith(600001);
    expect(onCopyBuyChecklist).toHaveBeenCalledWith(list);
    expect(onCopySellChecklist).toHaveBeenCalledWith(list);
    expect(onCopyManifest).toHaveBeenCalledWith(list);
    expect(onOpenBatch).toHaveBeenCalledWith(list);
    expect(onVerifyStationGroup).toHaveBeenCalledWith(list);
  });
});
