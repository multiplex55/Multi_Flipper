import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusBatchBuyPlanner } from "@/components/RadiusBatchBuyPlanner";

const recommendation = {
  verificationState: { status: "not_verified" as const },
  id: "rec-1",
  kind: "route_group",
  action: "buy",
  title: "Route 1",
  lines: [{ typeId: 34, typeName: "Tritanium", qty: 5000, unitVolumeM3: 0.01, volumeM3: 50, buyUnitIsk: 5, sellUnitIsk: 6, profitUnitIsk: 1, buyTotalIsk: 25000, sellTotalIsk: 30000, profitTotalIsk: 5000, routeKey: "route-a", row: { BuyStation: "Jita 4-4", SellStation: "Amarr VIII" } }],
  reasons: [], warnings: [], blockers: [],
  jumpsToBuyStation: 1, jumpsBuyToSell: 4, totalJumps: 5,
  cargoCapacityM3: 1000, totalVolumeM3: 50, remainingCargoM3: 950, cargoUsedPercent: 5,
  batchProfitIsk: 5000000, batchCapitalIsk: 20000000, batchGrossSellIsk: 25000000, batchIskPerJump: 1000000, batchRoiPercent: 25,
  packageMetrics: { averageFillConfidencePct: 82, worstFillConfidencePct: 60, riskCount: 2, weightedSlippagePct: 4.2, verificationCoveragePct: 95, batchProfitIsk: 5000000, batchCapitalIsk: 20000000, batchGrossSellIsk: 25000000, batchIskPerJump: 1000000, batchRoiPercent: 25, cargoUsedPercent: 5, totalJumps: 5 },
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
    expect(screen.getByText("2 (4.2%)")).toBeInTheDocument();
  });

  it("sorts by package profit and isk/jump", () => {
    const r2 = { ...recommendation, id: "rec-2", packageMetrics: { ...recommendation.packageMetrics, batchProfitIsk: 1000000, batchIskPerJump: 2000000 } };
    render(<RadiusBatchBuyPlanner recommendations={[recommendation as never, r2 as never]} mode="balanced" onModeChange={vi.fn()} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onVerify={vi.fn()} />);
    fireEvent.click(screen.getByText("Profit"));
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("1 M");
    fireEvent.click(screen.getByText("ISK/jump"));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("1 M");
    fireEvent.click(screen.getByText("ISK/jump"));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("2 M");
  });

  it("triggers mode change callback", () => {
    const onModeChange = vi.fn();
    render(<RadiusBatchBuyPlanner recommendations={[recommendation as never]} mode="balanced" onModeChange={onModeChange} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onVerify={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("planner-mode"), { target: { value: "batch_profit" } });
    expect(onModeChange).toHaveBeenCalledWith("batch_profit");
  });

  it("selector emits BuyPlannerMode values only", () => {
    const onModeChange = vi.fn();
    render(<RadiusBatchBuyPlanner recommendations={[recommendation as never]} mode="balanced" onModeChange={onModeChange} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onVerify={vi.fn()} />);
    const options = Array.from(screen.getByLabelText("planner-mode").querySelectorAll("option")).map((opt) => opt.getAttribute("value"));
    expect(options).toEqual(["balanced", "batch_profit", "batch_isk_per_jump", "cargo_fill", "long_haul_worth", "low_capital"]);
    expect(screen.getByTestId("planner-mode-summary")).toHaveTextContent("balanced");
  });

  it("renders human-readable verification status", () => {
    const withStatus = { ...recommendation, verificationState: { status: "stale" as const } };
    render(<RadiusBatchBuyPlanner recommendations={[withStatus as never]} mode="balanced" onModeChange={vi.fn()} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onVerify={vi.fn()} />);
    expect(screen.getByTitle("Stale")).toBeInTheDocument();
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


it("verification sorting uses verificationState.status", () => {
  const verified = { ...recommendation, id: "v", verificationState: { status: "verified" as const } };
  const failed = { ...recommendation, id: "f", verificationState: { status: "failed" as const, profitDeltaIsk: -1000 } };
  render(<RadiusBatchBuyPlanner recommendations={[failed as never, verified as never]} mode="balanced" onModeChange={vi.fn()} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onVerify={vi.fn()} />);
  fireEvent.click(screen.getByText("Verification"));
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("Verified");
});

it("verification filter chips constrain visible rows", () => {
  const recs = [
    { ...recommendation, id: "v", verificationState: { status: "verified" as const } },
    { ...recommendation, id: "n", verificationState: { status: "not_verified" as const } },
    { ...recommendation, id: "s", verificationState: { status: "stale" as const } },
    { ...recommendation, id: "f", verificationState: { status: "failed" as const } },
  ];
  render(<RadiusBatchBuyPlanner recommendations={recs as never[]} mode="balanced" onModeChange={vi.fn()} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onVerify={vi.fn()} />);
  fireEvent.click(screen.getByTestId("verification-chip-verified"));
  expect(screen.getAllByRole("row")).toHaveLength(2);
  fireEvent.click(screen.getByTestId("verification-chip-failed"));
  expect(screen.getAllByRole("row")).toHaveLength(2);
});
