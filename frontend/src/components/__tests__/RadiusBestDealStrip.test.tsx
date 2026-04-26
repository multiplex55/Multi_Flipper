import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusBestDealStrip } from "@/components/RadiusBestDealStrip";
import type { RadiusBestDealCard } from "@/lib/radiusBestDealCards";

function makeCard(overrides: Partial<RadiusBestDealCard> = {}): RadiusBestDealCard {
  return {
    kind: "best_single_item",
    title: "Best Single Item",
    routeKey: "route-a",
    routeLabel: "Jita → Amarr",
    metricLabel: "Fast single-route pick",
    hasFillerCandidates: false,
    expectedProfitIsk: 12000000,
    totalJumps: 6,
    urgencyBand: "stable",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("RadiusBestDealStrip", () => {
  it("renders multiple cards from the best-deal list", () => {
    render(
      <RadiusBestDealStrip
        bestDealCards={[
          makeCard({ routeKey: "route-a", routeLabel: "Jita → Amarr" }),
          makeCard({ routeKey: "route-b", routeLabel: "Dodixie → Hek", title: "Best Full Cargo" }),
        ]}
        onOpenRouteWorkbench={vi.fn()}
        onOpenInsights={vi.fn()}
        insightsOpen={false}
      />,
    );

    expect(screen.getByText("Jita → Amarr")).toBeInTheDocument();
    expect(screen.getByText("Dodixie → Hek")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open Batch" })).toHaveLength(2);
  });

  it("supports empty card set safely", () => {
    render(
      <RadiusBestDealStrip
        bestDealCards={[]}
        onOpenRouteWorkbench={vi.fn()}
        onOpenInsights={vi.fn()}
        insightsOpen={false}
      />,
    );

    expect(screen.getByText("No best route yet.")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Open Batch" })).toHaveLength(0);
  });

  it("shows filler actions only for cards with filler candidates", () => {
    const onOpenBatchBuilderForRoute = vi.fn();
    const onOpenRouteWorkbench = vi.fn();

    render(
      <RadiusBestDealStrip
        bestDealCards={[
          makeCard({ routeKey: "route-a", hasFillerCandidates: true, whySummary: "Great spread" }),
          makeCard({ routeKey: "route-b", hasFillerCandidates: false }),
        ]}
        onOpenBatchBuilderForRoute={onOpenBatchBuilderForRoute}
        onOpenRouteWorkbench={onOpenRouteWorkbench}
        onOpenInsights={vi.fn()}
        insightsOpen={false}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Open Batch" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Why?" })).toHaveLength(1);

    const fillCargoButtons = screen.getAllByRole("button", { name: "Fill Cargo" });
    expect(fillCargoButtons).toHaveLength(1);

    fireEvent.click(screen.getAllByRole("button", { name: "Open Batch" })[0]);
    fireEvent.click(fillCargoButtons[0]);

    expect(onOpenBatchBuilderForRoute).toHaveBeenCalledWith("route-a");
    expect(onOpenRouteWorkbench).toHaveBeenCalledWith("route-a", "filler");
  });
});
