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


  it("supports verify actions for cards and top routes", () => {
    const onVerifyRoute = vi.fn();
    render(
      <RadiusBestDealStrip
        bestDealCards={[
          makeCard({ routeKey: "route-a", routeLabel: "Jita → Amarr", scanAgeMinutes: 99 }),
          makeCard({ routeKey: "route-a", routeLabel: "Jita → Amarr", title: "Duplicate" }),
          makeCard({ routeKey: "route-b", routeLabel: "Dodixie → Hek" }),
        ]}
        onOpenRouteWorkbench={vi.fn()}
        onOpenInsights={vi.fn()}
        insightsOpen={false}
        onVerifyRoute={onVerifyRoute}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /verify/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Verify top" }));

    expect(onVerifyRoute).toHaveBeenCalledWith("route-a");
    expect(onVerifyRoute).toHaveBeenCalledWith("route-b");
    expect(onVerifyRoute.mock.calls.filter((call) => call[0] === "route-a").length).toBeGreaterThanOrEqual(2);
  });

  it("hides assignment quick actions by default while keeping core actions visible", () => {
    render(
      <RadiusBestDealStrip
        bestDealCards={[makeCard({ whySummary: "Why this route" })]}
        onOpenRouteWorkbench={vi.fn()}
        onOpenInsights={vi.fn()}
        insightsOpen={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Open Batch" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /verify/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Assign active" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign best" })).not.toBeInTheDocument();
  });

  it("renders assignment quick actions when explicitly enabled", () => {
    render(
      <RadiusBestDealStrip
        bestDealCards={[makeCard({ routeKey: "route-z" })]}
        onOpenRouteWorkbench={vi.fn()}
        onOpenInsights={vi.fn()}
        insightsOpen={false}
        showAssignmentActions
      />,
    );

    expect(screen.getByRole("button", { name: "Assign active" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign best" })).toBeInTheDocument();
    expect(screen.getByLabelText("Assign specific pilot route-z")).toBeInTheDocument();
    expect(screen.getByLabelText("Set staged system route-z")).toBeInTheDocument();
  });

  it("handles empty character and assignment data without layout regressions", () => {
    render(
      <RadiusBestDealStrip
        bestDealCards={[makeCard({ routeKey: "route-empty" })]}
        onOpenRouteWorkbench={vi.fn()}
        onOpenInsights={vi.fn()}
        insightsOpen={false}
        showAssignmentActions
        assignmentByRouteKey={{}}
        characters={[]}
      />,
    );

    expect(screen.getByTestId("radius-best-deal-strip")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Batch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign active" })).toBeInTheDocument();
  });
});
