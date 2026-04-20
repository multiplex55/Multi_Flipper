import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RadiusHubSummaryPanel } from "@/components/RadiusHubSummaryPanel";
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
  it("renders buy and sell sections", () => {
    render(<RadiusHubSummaryPanel buyHubs={buy} sellHubs={sell} />);

    expect(screen.getByText("Top buy hubs")).toBeInTheDocument();
    expect(screen.getByText("Top sell hubs")).toBeInTheDocument();
    expect(screen.getByText("Jita 4-4")).toBeInTheDocument();
    expect(screen.getByText("Amarr VIII")).toBeInTheDocument();
  });

  it("fires open/lock callbacks", () => {
    const onOpenHubRows = vi.fn();
    const onSetHubLock = vi.fn();
    render(
      <RadiusHubSummaryPanel
        buyHubs={buy}
        sellHubs={sell}
        onOpenHubRows={onOpenHubRows}
        onSetHubLock={onSetHubLock}
      />,
    );

    const openButtons = screen.getAllByRole("button", { name: "Open rows" });
    const lockButtons = screen.getAllByRole("button", { name: "Set lock" });

    fireEvent.click(openButtons[0]);
    fireEvent.click(lockButtons[1]);

    expect(onOpenHubRows).toHaveBeenCalledWith(buy[0], "buy");
    expect(onSetHubLock).toHaveBeenCalledWith(sell[0], "sell");
  });
});
