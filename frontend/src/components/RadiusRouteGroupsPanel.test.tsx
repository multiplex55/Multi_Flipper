import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusRouteGroupsPanel } from "@/components/RadiusRouteGroupsPanel";
import type { FlipResult } from "@/lib/types";

function makeFlip(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 34,
    TypeName: "Tritanium",
    BuySystemID: 30000142,
    BuySystemName: "Jita",
    SellSystemID: 30002187,
    SellSystemName: "Amarr",
    BuyStation: "Jita IV",
    SellStation: "Amarr VIII",
    BuyLocationID: 60003760,
    SellLocationID: 60008494,
    BuyPrice: 5,
    SellPrice: 7,
    ProfitPerUnit: 2,
    UnitsToBuy: 1000,
    FilledQty: 1000,
    DailyVolume: 10000,
    DailyProfit: 2000000,
    TotalJumps: 9,
    TotalProfit: 2000,
    Volume: 0.01,
    ...overrides,
  } as FlipResult;
}

describe("RadiusRouteGroupsPanel", () => {
  afterEach(() => cleanup());
  it("renders grouped route columns and actions", () => {
    const onQueueRoute = vi.fn();
    const onValidateRoute = vi.fn();

    render(
      <RadiusRouteGroupsPanel
        results={[
          makeFlip(),
          makeFlip({ TypeID: 35, TypeName: "Pyerite", TotalProfit: 5000, UnitsToBuy: 200, urgency_band: "aging" }),
        ]}
        cargoCapacityM3={1000}
        onQueueRoute={onQueueRoute}
        onValidateRoute={onValidateRoute}
      />,
    );

    expect(screen.getByText("Route")).toBeInTheDocument();
    expect(screen.getByText("Profit")).toBeInTheDocument();
    expect(screen.getByText("Capital")).toBeInTheDocument();
    expect(screen.getByText("ROI")).toBeInTheDocument();
    expect(screen.getByText("ISK/jump")).toBeInTheDocument();
    expect(screen.getByText("Jumps")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Cargo")).toBeInTheDocument();
    expect(screen.getByText("Exec")).toBeInTheDocument();
    expect(screen.getByText("Urgency")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Pilot")).toBeInTheDocument();
    expect(screen.getByText("Verify")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));

    expect(onValidateRoute).toHaveBeenCalledWith("loc:60003760->loc:60008494");
    expect(onQueueRoute).toHaveBeenCalledWith("loc:60003760->loc:60008494", "Jita IV → Amarr VIII");

    expect(screen.getByRole("button", { name: "Open Workbench" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign Active Pilot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign Best Pilot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build Batch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Manifest" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Summary" })).toBeInTheDocument();
  });
  it("uses routeWorkspace batch open path once when both callbacks are provided", () => {
    const workspaceOpenBatchBuilder = vi.fn();
    const fallbackOpenBatchBuilder = vi.fn();

    render(
      <RadiusRouteGroupsPanel
        results={[makeFlip()]}
        routeWorkspace={{ openBatchBuilder: workspaceOpenBatchBuilder } as any}
        onOpenBatchBuilderForRoute={fallbackOpenBatchBuilder}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Build Batch" })[0]!);

    expect(workspaceOpenBatchBuilder).toHaveBeenCalledTimes(1);
    expect(workspaceOpenBatchBuilder).toHaveBeenCalledWith("loc:60003760->loc:60008494");
    expect(fallbackOpenBatchBuilder).not.toHaveBeenCalled();
  });

});
