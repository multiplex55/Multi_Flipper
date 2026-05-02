import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusBatchBuyPlanner } from "@/components/RadiusBatchBuyPlanner";

const recommendation = {
  id: "rec-1",
  kind: "route_group",
  action: "buy",
  title: "Route 1",
  lines: [{ typeId: 34, typeName: "Tritanium", qty: 5000, unitVolumeM3: 0.01, volumeM3: 50, buyUnitIsk: 5, sellUnitIsk: 6, profitUnitIsk: 1, buyTotalIsk: 25000, sellTotalIsk: 30000, profitTotalIsk: 5000, routeKey: "route-a", row: { BuyStation: "Jita 4-4", SellStation: "Amarr VIII" } }],
  reasons: [], warnings: [], blockers: [],
  jumpsToBuyStation: 1, jumpsBuyToSell: 4, totalJumps: 5,
  cargoCapacityM3: 1000, totalVolumeM3: 50, remainingCargoM3: 950, cargoUsedPercent: 5,
  batchProfitIsk: 5000000, batchCapitalIsk: 20000000, batchGrossSellIsk: 25000000, batchIskPerJump: 1000000, batchRoiPercent: 25,
  verificationSlots: ["market"], scoreBreakdown: { fillConfidence: 0.82, penalties: 0.11 },
};

afterEach(() => cleanup());

describe("RadiusBatchBuyPlanner", () => {
  it("renders columns and formatted key cells", () => {
    render(<RadiusBatchBuyPlanner recommendations={[recommendation as never]} mode="balanced" onModeChange={vi.fn()} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onVerify={vi.fn()} />);
    expect(screen.getByText("Rank")).toBeInTheDocument();
    expect(screen.getByText("ISK/jump")).toBeInTheDocument();
    expect(screen.getByText("Jita 4-4 → Amarr VIII")).toBeInTheDocument();
    expect(screen.getByText("5.0%")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("triggers mode change callback", () => {
    const onModeChange = vi.fn();
    render(<RadiusBatchBuyPlanner recommendations={[recommendation as never]} mode="balanced" onModeChange={onModeChange} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onVerify={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("planner-mode"), { target: { value: "throughput" } });
    expect(onModeChange).toHaveBeenCalledWith("throughput");
  });

  it("row actions call handlers with exact recommendation", () => {
    const onOpenBatchBuilder = vi.fn();
    const onCopyManifest = vi.fn();
    const onVerify = vi.fn();
    render(<RadiusBatchBuyPlanner recommendations={[recommendation as never]} mode="balanced" onModeChange={vi.fn()} onOpenBatchBuilder={onOpenBatchBuilder} onCopyManifest={onCopyManifest} onVerify={onVerify} />);
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(screen.getByText("Manifest"));
    fireEvent.click(screen.getByText("Verify"));
    expect(onOpenBatchBuilder).toHaveBeenCalledWith(recommendation);
    expect(onCopyManifest).toHaveBeenCalledWith(recommendation);
    expect(onVerify).toHaveBeenCalledWith(recommendation);
  });
});
