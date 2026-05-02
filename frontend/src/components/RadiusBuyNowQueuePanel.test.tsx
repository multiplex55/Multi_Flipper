import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());
import { RadiusBuyNowQueuePanel } from "@/components/RadiusBuyNowQueuePanel";

const mkRec = (id: string, n: number) => ({
  id,
  kind: "cargo_build",
  action: "buy",
  title: `T${n}`,
  score: 80,
  lines: [{ typeId: 1, typeName: "Tritanium", qty: 1500, volumeM3: 10, buyTotalIsk: 1000, sellTotalIsk: 1500, profitTotalIsk: 500, row: { BuyStation: "Jita", SellStation: "Amarr", TotalJumps: 4 } }],
  reasons: ["ok"], warnings: ["warn"], blockers: [], diagnostics: [],
  jumpsToBuyStation: 1, jumpsBuyToSell: 2, totalJumps: n + 1, cargoCapacityM3: 1000, totalVolumeM3: 10, remainingCargoM3: 990, cargoUsedPercent: 1,
  batchProfitIsk: 1000 * n, batchCapitalIsk: 500 * n, batchGrossSellIsk: 1500 * n, batchIskPerJump: 200 * n, batchRoiPercent: 10,
  packageMetrics: { averageFillConfidencePct: 70, worstFillConfidencePct: 55, riskCount: 1, weightedSlippagePct: 1.5, verificationCoveragePct: 90, batchProfitIsk: 1000 * n, batchCapitalIsk: 500 * n, batchGrossSellIsk: 1500 * n, batchIskPerJump: 200 * n, batchRoiPercent: 10, cargoUsedPercent: 1, totalJumps: n + 1 },
  scoreBreakdown: { positive: { executionQuality: 0.8, fillConfidence: 0.7, movement: 0.2, longHaulWorth: 0.5 }, totalPenalty: 0.1 },
  haulWorthiness: { label: "short_efficient", reason: "test" },
  verificationState: { status: "not_verified" as const },
});

const handlers = {
  onOpenBatchBuilder: vi.fn(), onCopyManifest: vi.fn(), onCopyBuyChecklist: vi.fn(), onCopySellChecklist: vi.fn(), onVerify: vi.fn(), onPin: vi.fn(),
};

describe("RadiusBuyNowQueuePanel", () => {
  it("shows range text and paginates next/prev", () => {
    const recs = Array.from({ length: 7 }, (_, i) => mkRec(`r${i + 1}`, i + 1));
    render(<RadiusBuyNowQueuePanel recommendations={recs as never[]} pageSize={3} {...handlers} />);
    expect(screen.getByText("Showing 1–3 of 7")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Showing 4–6 of 7")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Prev"));
    expect(screen.getByText("Showing 1–3 of 7")).toBeInTheDocument();
  });

  it("renders compact/cards/table modes", () => {
    const { getAllByTestId, getByText } = render(<RadiusBuyNowQueuePanel recommendations={[mkRec("r1", 1) as never]} {...handlers} />);
    expect(getAllByTestId("cards-row")[0]).toBeInTheDocument();
    fireEvent.click(getByText("Compact"));
    expect(getAllByTestId("compact-row")[0]).toBeInTheDocument();
    fireEvent.click(getByText("Table"));
    expect(getAllByTestId("table-row")[0]).toBeInTheDocument();
  });

  it("shows action buttons in all modes and cards two-column classes", () => {
    const { rerender, container, getAllByText } = render(<RadiusBuyNowQueuePanel recommendations={[mkRec("r1", 1) as never]} layoutMode="cards" columns={2} pageSize={1} {...handlers} />);
    ["Open Batch Builder", "Manifest", "Buy list", "Sell list", "Verify", "Pin"].forEach((label) => {
      expect(getAllByText(label).length).toBeGreaterThan(0);
    });
    const grid = container.querySelector("div.grid");
    expect(grid?.className).toContain("2xl:grid-cols-2");

    fireEvent.click(screen.getAllByText("Compact")[0]);
    expect(screen.getByText("Open Batch Builder")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Table")[0]);
    expect(screen.getByText("Open Batch Builder")).toBeInTheDocument();

    rerender(<RadiusBuyNowQueuePanel recommendations={[mkRec("r1", 1) as never]} layoutMode="compact" {...handlers} />);
    expect(screen.getByText("Open Batch Builder")).toBeInTheDocument();
  });

  it("verification badge/status and show details rendering", () => {
    const rec = mkRec("r1", 1);
    rec.reasons = ["good spread"];
    rec.warnings = ["thin market"];
    rec.blockers = ["manual check"] as never;
    rec.verificationState = { status: "failed", profitDeltaIsk: -9000 } as never;
    render(<RadiusBuyNowQueuePanel recommendations={[rec as never]} {...handlers} />);
    expect(screen.getByTestId("verification-state-label")).toHaveTextContent("Failed: profit collapsed by");
    fireEvent.click(screen.getByText("Show details"));
    expect(screen.getByText("Reasons")).toBeInTheDocument();
    expect(screen.getByText("Warnings")).toBeInTheDocument();
    expect(screen.getByText("Blockers")).toBeInTheDocument();
    expect(screen.getByText("Score breakdown")).toBeInTheDocument();
    expect(screen.getByText("Package metrics")).toBeInTheDocument();
    expect(screen.getByText("Item lines")).toBeInTheDocument();
    expect(screen.getByText("Tritanium")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hide details"));
    expect(screen.queryByText("Item lines")).not.toBeInTheDocument();
  });

  it("reads displayed package metrics from recommendation package fields", () => {
    const rec = mkRec("r-metrics", 1);
    rec.lines[0].profitTotalIsk = 9999999;
    rec.lines[0].buyTotalIsk = 8888888;
    rec.packageMetrics.batchProfitIsk = 1234;
    rec.packageMetrics.batchCapitalIsk = 5678;
    rec.packageMetrics.batchGrossSellIsk = 9012;
    rec.packageMetrics.batchIskPerJump = 345;
    rec.packageMetrics.totalJumps = 77;
    rec.packageMetrics.averageFillConfidencePct = 66;
    rec.packageMetrics.worstFillConfidencePct = 44;
    rec.packageMetrics.riskCount = 3;
    rec.packageMetrics.weightedSlippagePct = 2.4;
    render(<RadiusBuyNowQueuePanel recommendations={[rec as never]} {...handlers} />);
    expect(screen.getByText(/Profit 1.2 K/i)).toBeInTheDocument();
    expect(screen.getByText(/Capital 5.7 K/i)).toBeInTheDocument();
    expect(screen.getByText(/Gross 9 K/i)).toBeInTheDocument();
    expect(screen.getByText(/ISK\/jump 345/i)).toBeInTheDocument();
    expect(screen.getByText(/Jumps 77/i)).toBeInTheDocument();
    expect(screen.getByText(/Fill 66%/i)).toBeInTheDocument();
  });
});
