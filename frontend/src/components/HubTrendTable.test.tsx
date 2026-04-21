import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HubTrendTable } from "@/components/HubTrendTable";
import type { RegionalHubTrend } from "@/lib/types";

const trends: RegionalHubTrend[] = [
  {
    source_system_id: 30000142,
    latest_snapshot: {
      scan_timestamp: "2026-04-21T10:00:00Z",
      source_system_id: 30000142,
      source_system_name: "Jita",
      item_count: 7,
      target_period_profit: 1500000,
      capital_required: 8000000,
      demand_per_day: 35,
      top_item_summary: "Tritanium, Mexallon",
    },
    prior_snapshot: {
      scan_timestamp: "2026-04-20T10:00:00Z",
      source_system_id: 30000142,
      source_system_name: "Jita",
      item_count: 5,
      target_period_profit: 1100000,
      capital_required: 7500000,
      demand_per_day: 25,
      top_item_summary: "Tritanium, Pyerite",
    },
    delta: {
      item_count_delta: 2,
      target_period_profit_delta: 400000,
      demand_per_day_delta: 10,
      new_top_items: ["Mexallon"],
      removed_top_items: ["Pyerite"],
    },
  },
];

describe("HubTrendTable", () => {
  it("renders signed deltas and top-item changes", () => {
    render(<HubTrendTable trends={trends} scanning={false} progress="" />);

    expect(screen.getByText("Jita")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText(/\+ .*Mexallon/)).toBeInTheDocument();
    expect(screen.getByText(/- .*Pyerite/)).toBeInTheDocument();
  });
});
