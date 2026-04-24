import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { RadiusInsightsPanel } from "@/components/RadiusInsightsPanel";
import type { ActionQueueItem, TopRoutePicks } from "@/lib/radiusMetrics";
import type { RadiusHubSummary } from "@/lib/radiusHubSummaries";

const picks: TopRoutePicks = {
  bestRecommendedRoutePack: {
    routeKey: "a:b",
    routeLabel: "A → B",
    totalProfit: 2_000_000,
    dailyIskPerJump: 1_100_000,
    confidenceScore: 83,
    cargoUsePercent: 62.5,
    recommendationScore: 80,
    stopCount: 2,
    riskCount: 1,
  },
  bestQuickSingleRoute: null,
  bestSafeFillerRoute: null,
};

const queue: ActionQueueItem[] = [];
const buyHubs: RadiusHubSummary[] = [{
  location_id: 1,
  station_name: "Jita 4-4",
  system_id: 30000142,
  system_name: "Jita",
  row_count: 2,
  item_count: 2,
  units: 150,
  capital_required: 1_000,
  period_profit: 250,
  avg_jumps: 5,
}];

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("RadiusInsightsPanel tabs", () => {
  it("switches tabs and persists active tab", () => {
    const { rerender } = render(
      <I18nProvider>
        <RadiusInsightsPanel topRoutePicks={picks} actionQueue={queue} openRouteWorkbench={vi.fn()} defaultExpanded />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hubs" }));
    expect(localStorage.getItem("eve-radius-insights-tab:v1")).toBe("hubs");

    rerender(
      <I18nProvider>
        <RadiusInsightsPanel topRoutePicks={picks} actionQueue={queue} openRouteWorkbench={vi.fn()} defaultExpanded />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: "Hubs" })).toHaveClass("border-eve-accent/60");
  });

  it("persists hub section collapse state", () => {
    render(
      <I18nProvider>
        <RadiusInsightsPanel
          topRoutePicks={picks}
          actionQueue={queue}
          buyHubs={buyHubs}
          openRouteWorkbench={vi.fn()}
          defaultExpanded
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hubs" }));
    fireEvent.click(screen.getByRole("button", { name: /Top Buy/i }));

    const raw = localStorage.getItem("eve-radius-insights-sections:v1");
    expect(raw).toBeTruthy();
    expect(raw).toContain('"topBuy":false');
  });
});
