import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegionalCorridorTable } from "@/components/RegionalCorridorTable";
import type { RegionalTradeCorridor } from "@/lib/types";

const corridors: RegionalTradeCorridor[] = [
  {
    key: "1:2",
    source_system_id: 1,
    source_system_name: "Jita",
    target_system_id: 2,
    target_system_name: "Amarr",
    item_count: 2,
    purchase_units: 30,
    capital_required: 2_000_000,
    target_now_profit: 300_000,
    target_period_profit: 400_000,
    weighted_jumps: 3.5,
    best_item_type_id: 34,
    best_item_name: "Tritanium",
    best_item_period_profit: 250_000,
    best_item_now_profit: 200_000,
    items: [],
  },
];

describe("RegionalCorridorTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders expected columns", () => {
    render(<RegionalCorridorTable corridors={corridors} scanning={false} progress="" />);

    expect(screen.getByRole("button", { name: "Source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Target" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Items" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capital" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Period Profit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weighted Jumps" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Best Item" })).toBeInTheDocument();
  });

  it("invokes row action callbacks", () => {
    const onOpenLaneItems = vi.fn();
    const onOpenInRoute = vi.fn();
    const onCopySummary = vi.fn();

    render(
      <RegionalCorridorTable
        corridors={corridors}
        scanning={false}
        progress=""
        onOpenLaneItems={onOpenLaneItems}
        onOpenInRoute={onOpenInRoute}
        onCopySummary={onCopySummary}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open lane items" }));
    fireEvent.click(screen.getByRole("button", { name: "Open in Route" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy corridor summary" }));

    expect(onOpenLaneItems).toHaveBeenCalledWith(corridors[0]);
    expect(onOpenInRoute).toHaveBeenCalledWith(corridors[0]);
    expect(onCopySummary).toHaveBeenCalledWith(corridors[0]);
  });
});
