import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RadiusHubSummaryPanel } from "@/components/RadiusHubSummaryPanel";
import { I18nProvider } from "@/lib/i18n";
import type { RadiusHubSummary } from "@/lib/radiusHubSummaries";

const buy: RadiusHubSummary[] = [
  {
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
  },
];

const sell: RadiusHubSummary[] = [
  {
    location_id: 2,
    station_name: "Amarr VIII",
    system_id: 30002187,
    system_name: "Amarr",
    row_count: 1,
    item_count: 1,
    units: 100,
    capital_required: 500,
    period_profit: 100,
    avg_jumps: 4,
  },
];

describe("RadiusHubSummaryPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders section toggles and defaults to expanded", () => {
    render(<I18nProvider><RadiusHubSummaryPanel buyHubs={buy} sellHubs={sell} /></I18nProvider>);

    const buyToggle = screen.getByRole("button", { name: /top buy hubs/i });
    const sellToggle = screen.getByRole("button", { name: /top sell hubs/i });

    expect(buyToggle).toHaveAttribute("aria-expanded", "true");
    expect(sellToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Jita 4-4")).toBeInTheDocument();
    expect(screen.getByText("Amarr VIII")).toBeInTheDocument();
  });

  it("collapses only buy rows when buy toggle is clicked", () => {
    render(<I18nProvider><RadiusHubSummaryPanel buyHubs={buy} sellHubs={sell} /></I18nProvider>);

    const buyToggle = screen.getByRole("button", { name: /top buy hubs/i });
    const sellToggle = screen.getByRole("button", { name: /top sell hubs/i });

    fireEvent.click(buyToggle);

    expect(buyToggle).toHaveAttribute("aria-expanded", "false");
    expect(sellToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("Jita 4-4")).not.toBeInTheDocument();
    expect(screen.getByText("Amarr VIII")).toBeInTheDocument();
  });

  it("collapses only sell rows when sell toggle is clicked", () => {
    render(<I18nProvider><RadiusHubSummaryPanel buyHubs={buy} sellHubs={sell} /></I18nProvider>);

    const buyToggle = screen.getByRole("button", { name: /top buy hubs/i });
    const sellToggle = screen.getByRole("button", { name: /top sell hubs/i });

    fireEvent.click(sellToggle);

    expect(sellToggle).toHaveAttribute("aria-expanded", "false");
    expect(buyToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("Amarr VIII")).not.toBeInTheDocument();
    expect(screen.getByText("Jita 4-4")).toBeInTheDocument();
  });

  it("re-expanding restores row content and action buttons", () => {
    render(<I18nProvider><RadiusHubSummaryPanel buyHubs={buy} sellHubs={sell} /></I18nProvider>);

    const buyToggle = screen.getByRole("button", { name: /top buy hubs/i });

    fireEvent.click(buyToggle);
    expect(screen.queryByText("Jita 4-4")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open rows" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Set lock" })).toHaveLength(1);

    fireEvent.click(buyToggle);
    expect(buyToggle).toHaveAttribute("aria-expanded", "true");

    const buySection = document.getElementById("radius-buy-hubs");
    expect(buySection).toBeTruthy();
    if (buySection) {
      expect(within(buySection).getByText("Jita 4-4")).toBeInTheDocument();
      expect(within(buySection).getByRole("button", { name: "Open rows" })).toBeInTheDocument();
      expect(within(buySection).getByRole("button", { name: "Set lock" })).toBeInTheDocument();
    }
  });

  it("fires open/lock callbacks while expanded", () => {
    const onOpenHubRows = vi.fn();
    const onSetHubLock = vi.fn();
    render(
      <I18nProvider>
        <RadiusHubSummaryPanel
          buyHubs={buy}
          sellHubs={sell}
          onOpenHubRows={onOpenHubRows}
          onSetHubLock={onSetHubLock}
        />
      </I18nProvider>,
    );

    const openButtons = screen.getAllByRole("button", { name: "Open rows" });
    const lockButtons = screen.getAllByRole("button", { name: "Set lock" });

    fireEvent.click(openButtons[0]);
    fireEvent.click(lockButtons[1]);

    expect(onOpenHubRows).toHaveBeenCalledWith(buy[0], "buy");
    expect(onSetHubLock).toHaveBeenCalledWith(sell[0], "sell");
  });

  it("renders major hub insights in nested collapsible", () => {
    render(
      <I18nProvider>
        <RadiusHubSummaryPanel
          buyHubs={buy}
          sellHubs={sell}
          majorHubInsights={[
            {
              hub: { key: "jita", label: "Jita", systemName: "Jita", systemId: 30000142 },
              buy: { rowCount: 4, distinctItems: 3, totalProfit: 300_000, totalCapital: 1_000_000 },
              sell: { rowCount: 1, distinctItems: 1, totalProfit: 80_000, totalCapital: 250_000 },
              card: { buyFlipsRows: 4, sellFlipsRows: 1, distinctItemsUnion: 3, profitUnion: 380_000 },
              buyMatchIdentity: {
                mode: "system",
                systemId: 30000142,
                normalizedSystemName: "jita",
              },
              sellMatchIdentity: {
                mode: "system",
                systemId: 30000142,
                normalizedSystemName: "jita",
              },
            },
          ]}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Major hub insights")).toBeInTheDocument();
    expect(screen.getByText("Buy flips (rows):")).toBeInTheDocument();
    expect(screen.getByText("Sell flips (rows):")).toBeInTheDocument();
    expect(screen.getByText("Distinct items (buy ∪ sell):")).toBeInTheDocument();
    expect(screen.getByText("Profit (day-period, buy ∪ sell):")).toBeInTheDocument();
    expect(screen.getByText("380 K")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /major hub insights/i }));
    expect(screen.queryByText("Buy flips (rows):")).not.toBeInTheDocument();
  });
});
