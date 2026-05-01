import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadiusBuyNowQueuePanel } from "@/components/RadiusBuyNowQueuePanel";

const rec = {
  id: "r1", kind: "cargo_build", action: "buy", title: "T", score: 80,
  lines: [{ typeId: 1, typeName: "Tritanium", qty: 1500, volumeM3: 0, buyTotalIsk: 1000, sellTotalIsk: 1500, profitTotalIsk: 500, row: { BuyStation: "Jita", SellStation: "Amarr", TotalJumps: 4 } }],
  reasons: ["ok"], warnings: ["warn"], blockers: [], diagnostics: [],
  scoreBreakdown: { profit: 1, iskPerJump: 1, cargoEfficiency: 1, roi: 1, executionQuality: 0.8, fillConfidence: 0.7, dailyProfitTurnover: 0.1, movement: 0.2, watchlistBonus: 0, penalties: 0.1 },
};

describe("RadiusBuyNowQueuePanel", () => {
  it("renders recommendation badges/metrics and details toggle", () => {
    render(<RadiusBuyNowQueuePanel recommendations={[rec as never]} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onCopyBuyChecklist={vi.fn()} onCopySellChecklist={vi.fn()} onVerify={vi.fn()} onPin={vi.fn()} />);
    expect(screen.getByText("buy")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Show details"));
    expect(screen.getByText(/Reasons:/)).toBeInTheDocument();
  });

  it("invokes handlers and shows clear empty state count", () => {
    const onOpen = vi.fn();
    render(<RadiusBuyNowQueuePanel recommendations={[rec as never]} onOpenBatchBuilder={onOpen} onCopyManifest={vi.fn()} onCopyBuyChecklist={vi.fn()} onCopySellChecklist={vi.fn()} onVerify={vi.fn()} onPin={vi.fn()} onMarkQueued={vi.fn()} onHideSimilar={vi.fn()} />);
    fireEvent.click(screen.getByText("Open Batch Builder"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" }));
    render(<RadiusBuyNowQueuePanel recommendations={[]} onOpenBatchBuilder={vi.fn()} onCopyManifest={vi.fn()} onCopyBuyChecklist={vi.fn()} onCopySellChecklist={vi.fn()} onVerify={vi.fn()} onPin={vi.fn()} />);
    expect(screen.getByText(/Buy-Now Queue: 0/)).toBeInTheDocument();
  });
});
