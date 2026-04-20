import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegionalDayTraderTable } from "@/components/RegionalDayTraderTable";
import type { RegionalDayTradeHub } from "@/lib/types";

function makeHubs(): RegionalDayTradeHub[] {
  return [
    {
      source_system_id: 1,
      source_system_name: "Alpha",
      source_region_id: 10,
      source_region_name: "Source",
      source_jumps_from_current: 8,
      source_jumps_from_home: 5,
      security: 0.8,
      purchase_units: 30,
      source_units: 400,
      target_demand_per_day: 20,
      target_supply_units: 200,
      target_dos: 10,
      assets: 0,
      active_orders: 0,
      target_now_profit: 6_000_000,
      target_period_profit: 10_000_000,
      capital_required: 20_000_000,
      shipping_cost: 500_000,
      staging_score: 45,
      destinations_count: 2,
      best_destination_system_name: "Jita",
      best_destination_profit: 7_500_000,
      item_count: 1,
      items: [],
    },
    {
      source_system_id: 2,
      source_system_name: "Beta",
      source_region_id: 10,
      source_region_name: "Source",
      source_jumps_from_current: 2,
      source_jumps_from_home: 1,
      security: 0.9,
      purchase_units: 25,
      source_units: 300,
      target_demand_per_day: 25,
      target_supply_units: 100,
      target_dos: 4,
      assets: 0,
      active_orders: 0,
      target_now_profit: 4_000_000,
      target_period_profit: 9_000_000,
      capital_required: 15_000_000,
      shipping_cost: 250_000,
      staging_score: 80,
      destinations_count: 1,
      best_destination_system_name: "Amarr",
      best_destination_profit: 9_000_000,
      item_count: 1,
      items: [],
    },
  ];
}

describe("RegionalDayTraderTable", () => {
  it("renders new hub context columns", () => {
    render(<RegionalDayTraderTable hubs={makeHubs()} scanning={false} progress="" />);

    expect(screen.getByText("Jumps Current")).toBeInTheDocument();
    expect(screen.getByText("Staging Score")).toBeInTheDocument();
    expect(screen.getByText("Destinations")).toBeInTheDocument();
    expect(screen.getByText("Best Destination")).toBeInTheDocument();
    expect(screen.getByLabelText("Hub sort preset")).toBeInTheDocument();
  });

  it("sorts by staging score preset and by jumps from current", () => {
    render(<RegionalDayTraderTable hubs={makeHubs()} scanning={false} progress="" />);

    const rows = screen.getAllByText(/Alpha|Beta/);
    expect(rows[0]).toHaveTextContent("Beta");

    fireEvent.click(screen.getAllByText("Jumps Current")[0]);
    const sortedByJumps = screen.getAllByText(/Alpha|Beta/);
    expect(sortedByJumps[0]).toHaveTextContent("Alpha");

    fireEvent.click(screen.getAllByText("Jumps Current")[0]);
    const reversed = screen.getAllByText(/Alpha|Beta/);
    expect(reversed[0]).toHaveTextContent("Beta");
  });
});
