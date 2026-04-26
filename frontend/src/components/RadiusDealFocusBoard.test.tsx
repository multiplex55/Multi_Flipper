import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusDealFocusBoard } from "@/components/RadiusDealFocusBoard";
import type { RadiusDealFocusCandidate } from "@/lib/radiusDealFocus";

function candidate(overrides: Partial<RadiusDealFocusCandidate> = {}): RadiusDealFocusCandidate {
  return {
    kind: "best_buy_now",
    title: "Best Buy Now",
    routeKey: "route-a",
    routeLabel: "Jita → Amarr",
    buyStation: "Jita IV - Moon 4",
    sellStation: "Amarr VIII",
    itemSummary: "2 items · lead Tritanium",
    itemName: "Tritanium",
    expectedProfitIsk: 1_000_000,
    capitalIsk: 10_000_000,
    cargoM3: 500,
    iskPerJump: 500_000,
    confidenceScore: 80,
    executionQuality: 78,
    trapRisk: 20,
    verificationState: "fresh",
    recommendedAction: "buy",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("RadiusDealFocusBoard", () => {
  it("renders candidate cards with verification/action chips", () => {
    render(
      <RadiusDealFocusBoard
        candidates={[candidate({ verificationState: "stale", recommendedAction: "verify" })]}
        onOpenRouteWorkbench={vi.fn()}
      />,
    );

    expect(screen.getByText("Radius deal focus")).toBeInTheDocument();
    expect(screen.getByText("Needs Verify")).toBeInTheDocument();
expect(screen.getAllByText("Verify").length).toBeGreaterThan(0);
  });

  it("dispatches row actions", () => {
    const onVerifyRoute = vi.fn();
    const onOpenBatchBuilderForRoute = vi.fn();
    const onCopyChecklist = vi.fn();
    const onCopyManifest = vi.fn();
    const onOpenRouteWorkbench = vi.fn();

    render(
      <RadiusDealFocusBoard
        candidates={[candidate()]}
        onVerifyRoute={onVerifyRoute}
        onOpenBatchBuilderForRoute={onOpenBatchBuilderForRoute}
        onCopyChecklist={onCopyChecklist}
        onCopyManifest={onCopyManifest}
        onOpenRouteWorkbench={onOpenRouteWorkbench}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Verify" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Open Batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy checklist" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy manifest" }));
    fireEvent.click(screen.getByRole("button", { name: "Open workbench" }));

    expect(onVerifyRoute).toHaveBeenCalledWith("route-a");
    expect(onOpenBatchBuilderForRoute).toHaveBeenCalledWith("route-a");
    expect(onCopyChecklist).toHaveBeenCalledWith("route-a");
    expect(onCopyManifest).toHaveBeenCalledWith("route-a");
    expect(onOpenRouteWorkbench).toHaveBeenCalledWith("route-a");
  });
});
