import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { RadiusInsightsPanel } from "@/components/RadiusInsightsPanel";
import type { ActionQueueItem, TopRoutePicks } from "@/lib/radiusMetrics";
import type { LoopOpportunity } from "@/lib/loopPlanner";
import type { RadiusMajorHubMetrics } from "@/lib/radiusMajorHubInsights";
import { filterRadiusResultsByHub } from "@/lib/radiusHubFilter";
import type { FlipResult } from "@/lib/types";

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

    fireEvent.click(screen.getByRole("button", { name: "Picks" }));
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

  it("uses exact major-hub action identity for Perimeter TTT actions", () => {
    const onOpenHubRows = vi.fn();
    const onSetHubLock = vi.fn();
    const majorHubInsights: RadiusMajorHubMetrics[] = [
      {
        hub: {
          key: "perimeter_ttt",
          label: "Perimeter / TTT",
          systemName: "Perimeter",
          systemId: 30000144,
          structureName: "Tranquility Trading Tower",
        },
        buy: { rowCount: 2, distinctItems: 2, totalProfit: 10_000, totalCapital: 20_000 },
        sell: { rowCount: 1, distinctItems: 1, totalProfit: 5_000, totalCapital: 10_000 },
        card: { buyFlipsRows: 2, sellFlipsRows: 1, distinctItemsUnion: 2, profitUnion: 15_000 },
        buyRowIds: ["buy:1", "buy:2"],
        sellRowIds: ["sell:1"],
        buyMatchIdentity: {
          mode: "structure_contains",
          systemId: 30000144,
          normalizedSystemName: "perimeter",
          normalizedStationContains: "tranquility trading tower",
        },
        sellMatchIdentity: {
          mode: "structure_contains",
          systemId: 30000144,
          normalizedSystemName: "perimeter",
          normalizedStationContains: "tranquility trading tower",
        },
      },
    ];

    render(
      <I18nProvider>
        <RadiusInsightsPanel
          topRoutePicks={makePicks()}
          actionQueue={makeQueue()}
          loopOpportunities={makeLoops()}
          openRouteWorkbench={vi.fn()}
          onOpenHubRows={onOpenHubRows}
          onSetHubLock={onSetHubLock}
          majorHubInsights={majorHubInsights}
          compactTeaser
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /major trade hubs/i }));
    expect(screen.getByText("Buy flips (rows):")).toBeInTheDocument();
    expect(screen.getByText("Sell flips (rows):")).toBeInTheDocument();
    expect(screen.getByText("Distinct items (buy ∪ sell):")).toBeInTheDocument();
    expect(screen.getByText("Profit (day-period, buy ∪ sell):")).toBeInTheDocument();
    expect(screen.getByText("15 K")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open buy rows" }));
    fireEvent.click(screen.getByRole("button", { name: "Buy lock" }));
    fireEvent.click(screen.getByRole("button", { name: "Open sell rows" }));
    fireEvent.click(screen.getByRole("button", { name: "Sell lock" }));

    expect(onOpenHubRows).toHaveBeenCalledTimes(2);
    expect(onSetHubLock).toHaveBeenCalledTimes(2);

    const hubArg = onOpenHubRows.mock.calls[0][0];
    expect(hubArg.major_hub_match?.mode).toBe("structure_contains");
    expect(hubArg.major_hub_match?.normalizedStationContains).toBe("tranquility trading tower");
    expect(onOpenHubRows.mock.calls[0][2]).toEqual({ rowIds: ["buy:1", "buy:2"] });
    expect(onSetHubLock.mock.calls[0][2]).toEqual({ rowIds: ["buy:1", "buy:2"] });
    expect(onOpenHubRows.mock.calls[1][2]).toEqual({ rowIds: ["sell:1"] });
    expect(onSetHubLock.mock.calls[1][2]).toEqual({ rowIds: ["sell:1"] });

    const rows = [
      {
        TypeID: 1,
        BuySystemID: 30000144,
        BuyStation: "Perimeter - Tranquility Trading Tower",
      },
      {
        TypeID: 2,
        BuySystemID: 30000144,
        BuyStation: "Perimeter - Caldari Business Tribunal",
      },
    ] as FlipResult[];
    const filtered = filterRadiusResultsByHub(rows, {
      side: "buy",
      systemId: hubArg.system_id,
      normalizedStationContains: hubArg.major_hub_match?.mode === "structure_contains"
        ? hubArg.major_hub_match.normalizedStationContains
        : undefined,
    });
    expect(filtered).toEqual([rows[0]]);
  });

  it("disables directional buttons when corresponding count is zero", () => {
    const onOpenHubRows = vi.fn();
    const onSetHubLock = vi.fn();
    const majorHubInsights: RadiusMajorHubMetrics[] = [
      {
        hub: {
          key: "jita",
          label: "Jita",
          systemName: "Jita",
          systemId: 30000142,
        },
        buy: { rowCount: 0, distinctItems: 0, totalProfit: 0, totalCapital: 0 },
        sell: { rowCount: 1, distinctItems: 1, totalProfit: 1000, totalCapital: 2000 },
        card: { buyFlipsRows: 0, sellFlipsRows: 1, distinctItemsUnion: 1, profitUnion: 1000 },
        buyRowIds: [],
        sellRowIds: ["sell:only"],
        buyMatchIdentity: { mode: "system", systemId: 30000142, normalizedSystemName: "jita" },
        sellMatchIdentity: { mode: "system", systemId: 30000142, normalizedSystemName: "jita" },
      },
    ];

    render(
      <I18nProvider>
        <RadiusInsightsPanel
          topRoutePicks={makePicks()}
          actionQueue={makeQueue()}
          loopOpportunities={makeLoops()}
          openRouteWorkbench={vi.fn()}
          onOpenHubRows={onOpenHubRows}
          onSetHubLock={onSetHubLock}
          majorHubInsights={majorHubInsights}
          compactTeaser
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /major trade hubs/i }));
    expect(screen.getByRole("button", { name: "Open buy rows" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buy lock" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open sell rows" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Sell lock" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Open buy rows" }));
    fireEvent.click(screen.getByRole("button", { name: "Buy lock" }));
    expect(onOpenHubRows).toHaveBeenCalledTimes(0);
    expect(onSetHubLock).toHaveBeenCalledTimes(0);
  });
});
