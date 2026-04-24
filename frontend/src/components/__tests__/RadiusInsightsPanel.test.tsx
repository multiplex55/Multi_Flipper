import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { RadiusInsightsPanel } from "@/components/RadiusInsightsPanel";
import type { ActionQueueItem, TopRoutePicks } from "@/lib/radiusMetrics";
import type { LoopOpportunity } from "@/lib/loopPlanner";

const VISIBLE_KEY = "eve-radius-insights-visible:v1";
const TAB_KEY = "eve-radius-insights-tab:v1";

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
    bestSafeFillerRoute: null,
  };
}

function makeQueue(): ActionQueueItem[] {
  return [
    {
      routeKey: "30000142:30002187",
      routeLabel: "Jita → Amarr",
      action: "buy_now",
      score: 95,
      reasons: ["High confidence", "Strong demand"],
      candidate: {
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
    },
  ];
}

function makeLoops(): LoopOpportunity[] {
  return [
    {
      id: "1",
      outbound: {
        rowIndex: 0,
        row: {
          TypeID: 101,
          TypeName: "Hull Parts",
          BuySystemName: "Jita",
          SellSystemName: "Amarr",
        } as never,
        profit: 1_000_000,
        jumps: 4,
        cargoM3: 150,
      },
      returnLeg: {
        rowIndex: 1,
        row: {
          TypeID: 102,
          TypeName: "Laser Crystals",
          BuySystemName: "Amarr",
          SellSystemName: "Jita",
        } as never,
        profit: 900_000,
        jumps: 4,
        cargoM3: 120,
      },
      detourJumps: 0,
      outboundProfit: 1_000_000,
      returnProfit: 900_000,
      totalLoopProfit: 1_900_000,
      totalLoopJumps: 8,
      emptyJumpsAvoided: 2,
      deadheadRatio: 0,
      loopEfficiencyScore: 88,
    },
  ];
}

function renderPanel(overrides: {
  topRoutePicks?: TopRoutePicks;
  actionQueue?: ActionQueueItem[];
  loopOpportunities?: LoopOpportunity[];
} = {}) {
  const openRouteWorkbench = vi.fn();
  render(
    <I18nProvider>
      <RadiusInsightsPanel
        topRoutePicks={overrides.topRoutePicks ?? makePicks()}
        actionQueue={overrides.actionQueue ?? makeQueue()}
        loopOpportunities={overrides.loopOpportunities ?? makeLoops()}
        openRouteWorkbench={openRouteWorkbench}
      />
    </I18nProvider>,
  );
  return { openRouteWorkbench };
}

describe("RadiusInsightsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("renders collapsed by default with badge counts", () => {
    renderPanel();

    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("Picks 2")).toBeInTheDocument();
    expect(screen.getByText("Queue 1")).toBeInTheDocument();
    expect(screen.getByText("Loops 1")).toBeInTheDocument();
    expect(screen.queryByText("Top Picks")).not.toBeInTheDocument();
  });

  it("toggles expand/collapse", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Top Picks")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("Top Picks")).not.toBeInTheDocument();
  });

  it("switches tabs and routes content", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));

    fireEvent.click(screen.getByRole("button", { name: "Queue" }));
    expect(screen.getByText("Action Queue")).toBeInTheDocument();
    expect(screen.queryByText("Backhaul/return-leg filler opportunities")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Loops" }));
    expect(screen.getByText("Backhaul/return-leg filler opportunities")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Summary" }));
    expect(screen.getByText("Top Picks")).toBeInTheDocument();
  });

  it("restores persisted localStorage visibility and active tab", () => {
    localStorage.setItem(VISIBLE_KEY, "1");
    localStorage.setItem(TAB_KEY, "queue");

    renderPanel();

    expect(screen.getByText("Action Queue")).toBeInTheDocument();
    expect(screen.queryByText("Top Picks")).not.toBeInTheDocument();
  });

  it("invokes openRouteWorkbench from pick and queue interactions", () => {
    const { openRouteWorkbench } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));

    fireEvent.click(screen.getAllByRole("button", { name: /jump to group/i })[0]);
    expect(openRouteWorkbench).toHaveBeenCalledWith("30000142:30002187", "summary", {
      intentLabel: "Primary",
      batchEntryMode: "core",
    });

    fireEvent.click(screen.getByRole("button", { name: "Queue" }));
    fireEvent.click(screen.getByRole("button", { name: /jump to group/i }));
    expect(openRouteWorkbench).toHaveBeenCalledTimes(2);
  });

  it("passes filler launch intent and entry mode for safe filler cards", () => {
    const picks = makePicks();
    picks.bestSafeFillerRoute = {
      routeKey: "30000142:30004999",
      routeLabel: "Jita → Hek",
      totalProfit: 400_000,
      dailyIskPerJump: 200_000,
      confidenceScore: 70,
      cargoUsePercent: 35,
      recommendationScore: 72,
      stopCount: 2,
      riskCount: 0,
    };
    const { openRouteWorkbench } = renderPanel({ topRoutePicks: picks });
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    fireEvent.click(screen.getAllByRole("button", { name: /jump to group/i })[2]);
    expect(openRouteWorkbench).toHaveBeenCalledWith("30000142:30004999", "summary", {
      intentLabel: "Safe filler",
      batchEntryMode: "filler",
    });
  });

  it("opens loop entries against the expected route key", () => {
    const { openRouteWorkbench } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    fireEvent.click(screen.getByRole("button", { name: "Loops" }));
    fireEvent.click(screen.getByRole("button", { name: "Outbound" }));

    expect(openRouteWorkbench).toHaveBeenCalledWith("sys:0->sys:0", "summary");
  });
});
