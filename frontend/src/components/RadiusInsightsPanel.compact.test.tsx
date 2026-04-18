import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { RadiusInsightsPanel } from "@/components/RadiusInsightsPanel";
import type { ActionQueueItem, TopRoutePicks } from "@/lib/radiusMetrics";
import type { LoopOpportunity } from "@/lib/loopPlanner";

function makePicks(): TopRoutePicks {
  return {
    bestRecommendedRoutePack: {
      routeKey: "30000142:30002187",
      routeLabel: "Jita → Amarr",
      totalProfit: 2_000_000,
      dailyIskPerJump: 1_100_000,
      confidenceScore: 83,
      cargoUsePercent: 62.5,
      recommendationScore: 80,
      stopCount: 2,
      riskCount: 1,
    },
    bestQuickSingleRoute: {
      routeKey: "30002187:30002510",
      routeLabel: "Amarr → Dodixie",
      totalProfit: 1_200_000,
      dailyIskPerJump: 900_000,
      confidenceScore: 77,
      cargoUsePercent: 48,
      recommendationScore: 73,
      stopCount: 1,
      riskCount: 1,
    },
    bestSafeFillerRoute: {
      routeKey: "30000142:30004999",
      routeLabel: "Jita → Hek",
      totalProfit: 900_000,
      dailyIskPerJump: 650_000,
      confidenceScore: 70,
      cargoUsePercent: 45,
      recommendationScore: 66,
      stopCount: 2,
      riskCount: 0,
    },
  };
}

const queue: ActionQueueItem[] = [
  {
    routeKey: "30000142:30002187",
    routeLabel: "Jita → Amarr",
    action: "buy_now",
    score: 95,
    reasons: ["High confidence"],
    candidate: makePicks().bestRecommendedRoutePack!,
  },
];

const loops: LoopOpportunity[] = [
  {
    id: "loop-1",
    outbound: { rowIndex: 0, row: {} as never, profit: 100, jumps: 1, cargoM3: 1 },
    returnLeg: { rowIndex: 1, row: {} as never, profit: 100, jumps: 1, cargoM3: 1 },
    detourJumps: 0,
    outboundProfit: 100,
    returnProfit: 100,
    totalLoopProfit: 200,
    totalLoopJumps: 2,
    emptyJumpsAvoided: 1,
    deadheadRatio: 0,
    loopEfficiencyScore: 90,
  },
];

describe("RadiusInsightsPanel compact teaser", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows only teaser content and hides full-board controls", () => {
    const openRouteWorkbench = vi.fn();
    render(
      <I18nProvider>
        <RadiusInsightsPanel
          topRoutePicks={makePicks()}
          actionQueue={queue}
          loopOpportunities={loops}
          compactTeaser
          openRouteWorkbench={openRouteWorkbench}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Radius route insights")).toBeInTheDocument();
    expect(screen.getByText("Jita → Amarr")).toBeInTheDocument();
    expect(screen.getByText("Amarr → Dodixie")).toBeInTheDocument();
    expect(screen.getByText("Jita → Hek")).toBeInTheDocument();
    expect(screen.getByText(/Route queue:/)).toBeInTheDocument();
    expect(screen.getByText(/Loop candidates:/)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Expand" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Summary" })).not.toBeInTheDocument();
    expect(screen.queryByText("Action Queue")).not.toBeInTheDocument();
  });

  it("uses the CTA to open route workspace", () => {
    const onOpenRouteFromInsights = vi.fn();
    render(
      <I18nProvider>
        <RadiusInsightsPanel
          topRoutePicks={makePicks()}
          actionQueue={queue}
          loopOpportunities={loops}
          compactTeaser
          openRouteWorkbench={vi.fn()}
          onOpenRouteFromInsights={onOpenRouteFromInsights}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Route Workspace" }));
    expect(onOpenRouteFromInsights).toHaveBeenCalledWith(
      "30000142:30002187",
      "workbench",
    );
  });

  it("shows action buttons for each pick and sends matching route keys", () => {
    const onOpenRouteFromInsights = vi.fn();
    render(
      <I18nProvider>
        <RadiusInsightsPanel
          topRoutePicks={makePicks()}
          actionQueue={queue}
          loopOpportunities={loops}
          compactTeaser
          openRouteWorkbench={vi.fn()}
          onOpenRouteFromInsights={onOpenRouteFromInsights}
        />
      </I18nProvider>,
    );

    const rowButtons = screen.getAllByRole("button", { name: "Open in Build Batch" });
    expect(rowButtons).toHaveLength(3);

    fireEvent.click(rowButtons[0]);
    fireEvent.click(rowButtons[1]);
    fireEvent.click(rowButtons[2]);

    expect(onOpenRouteFromInsights).toHaveBeenNthCalledWith(
      1,
      "30000142:30002187",
      "workbench",
    );
    expect(onOpenRouteFromInsights).toHaveBeenNthCalledWith(
      2,
      "30002187:30002510",
      "workbench",
    );
    expect(onOpenRouteFromInsights).toHaveBeenNthCalledWith(
      3,
      "30000142:30004999",
      "workbench",
    );
  });
});
