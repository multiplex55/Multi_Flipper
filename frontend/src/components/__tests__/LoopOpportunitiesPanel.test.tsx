import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { LoopOpportunitiesPanel } from "@/components/LoopOpportunitiesPanel";
import { RadiusInsightsPanel } from "@/components/RadiusInsightsPanel";
import type { LoopOpportunity } from "@/lib/loopPlanner";
import type { ActionQueueItem, TopRoutePicks } from "@/lib/radiusMetrics";

function makeLoops(count = 4): LoopOpportunity[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `loop-${idx + 1}`,
    outbound: {
      rowIndex: idx,
      row: {
        TypeID: 100 + idx,
        TypeName: `Outbound Item ${idx + 1}`,
        BuySystemName: idx % 2 === 0 ? "Jita" : "Amarr",
        SellSystemName: idx % 2 === 0 ? "Amarr" : "Jita",
      } as never,
      profit: 1_000_000 + idx * 100_000,
      jumps: 4,
      cargoM3: 100,
    },
    returnLeg: {
      rowIndex: idx + 1,
      row: {
        TypeID: 200 + idx,
        TypeName: `Return Item ${idx + 1}`,
        BuySystemName: idx % 2 === 0 ? "Amarr" : "Jita",
        SellSystemName: idx % 2 === 0 ? "Jita" : "Amarr",
      } as never,
      profit: 900_000 + idx * 100_000,
      jumps: 4,
      cargoM3: 120,
    },
    detourJumps: 1,
    outboundProfit: 1_000_000 + idx * 100_000,
    returnProfit: 900_000 + idx * 100_000,
    totalLoopProfit: 1_900_000 + idx * 200_000,
    totalLoopJumps: 8,
    emptyJumpsAvoided: 2,
    deadheadRatio: 0.1,
    loopEfficiencyScore: 80 + idx,
  }));
}

function makeQueue(): ActionQueueItem[] {
  return Array.from({ length: 4 }, (_, idx) => ({
    routeKey: `route-${idx + 1}`,
    routeLabel: `Very Long Route Label ${idx + 1} Jita → Amarr → Dodixie`,
    action: idx % 2 === 0 ? "buy_now" : "filler",
    score: 90 - idx,
    reasons: ["High confidence", "Strong demand", "Low deadhead"],
    candidate: {
      routeKey: `route-${idx + 1}`,
      routeLabel: `Route ${idx + 1}`,
      totalProfit: 2_000_000,
      dailyIskPerJump: 1_200_000,
      confidenceScore: 80,
      cargoUsePercent: 55,
      recommendationScore: 78,
      stopCount: 2,
      riskCount: 1,
    },
  }));
}

const picks: TopRoutePicks = {
  bestRecommendedRoutePack: null,
  bestQuickSingleRoute: null,
  bestSafeFillerRoute: null,
};

describe("LoopOpportunitiesPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows compact summary and limited loop items by default", () => {
    render(<LoopOpportunitiesPanel loops={makeLoops(4)} collapsed />);

    expect(screen.getByTestId("loop-compact-summary")).toBeInTheDocument();
    expect(screen.getAllByTestId("loop-card")).toHaveLength(2);
    expect(screen.getAllByTestId("loop-compact-metrics")).toHaveLength(2);
    expect(screen.queryByTestId("loop-full-metrics-grid")).not.toBeInTheDocument();
  });

  it("shows full details in expanded mode", () => {
    render(
      <LoopOpportunitiesPanel
        loops={makeLoops(4)}
        collapsed
        defaultExpanded
      />,
    );

    expect(screen.queryByTestId("loop-compact-summary")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("loop-card")).toHaveLength(4);
    expect(screen.getAllByTestId("loop-full-metrics-grid")).toHaveLength(4);
    expect(screen.queryByTestId("loop-compact-metrics")).not.toBeInTheDocument();
  });

  it("renders metric chips in compact mode instead of the full metrics grid", () => {
    render(<LoopOpportunitiesPanel loops={makeLoops(2)} collapsed />);

    expect(screen.getAllByTestId("loop-compact-metrics")).toHaveLength(2);
    expect(screen.queryByTestId("loop-full-metrics-grid")).not.toBeInTheDocument();
  });

  it("slices queue in compact mode and expands with show all", () => {
    render(
      <I18nProvider>
        <RadiusInsightsPanel
          topRoutePicks={picks}
          actionQueue={makeQueue()}
          loopOpportunities={[]}
          openRouteWorkbench={() => {}}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));

    expect(screen.getAllByText("Buy now").length + screen.getAllByText("Filler").length).toBe(3);
    expect(screen.getByRole("button", { name: "Show all queue items" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all queue items" }));

    expect(screen.getAllByText("High confidence")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Show fewer queue items" })).toBeInTheDocument();
  });
});
