import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusRouteGroupsPanel } from "@/components/RadiusRouteGroupsPanel";
import type { FlipResult } from "@/lib/types";

function makeFlip(routeIndex: number, overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 34 + routeIndex,
    TypeName: `Item ${routeIndex}`,
    BuySystemID: 30000142,
    BuySystemName: "Jita",
    SellSystemID: 30002187,
    SellSystemName: "Amarr",
    BuyStation: `Start ${routeIndex}`,
    SellStation: `End ${routeIndex}`,
    BuyLocationID: 60000000 + routeIndex,
    SellLocationID: 70000000 + routeIndex,
    BuyPrice: 5,
    SellPrice: 7,
    ProfitPerUnit: 2,
    UnitsToBuy: 1000,
    FilledQty: 1000,
    DailyVolume: 10000,
    DailyProfit: 2000000,
    TotalJumps: routeIndex % 10 === 0 ? 5 : 10,
    TotalProfit: routeIndex * 100,
    Volume: 0.01,
    ...overrides,
  } as FlipResult;
}

describe("RadiusRouteGroupsPanel", () => {
  afterEach(() => cleanup());

  it("renders sticky table header classes", () => {
    render(<RadiusRouteGroupsPanel results={[makeFlip(1), makeFlip(2)]} cargoCapacityM3={1000} />);
    const thead = screen.getByTestId("radius-route-groups-thead");
    expect(thead.className).toContain("sticky");
    expect(thead.className).toContain("top-0");
  });

  it("toggles sorting via header click", () => {
    render(<RadiusRouteGroupsPanel results={[makeFlip(1), makeFlip(2), makeFlip(3)]} cargoCapacityM3={1000} />);

    fireEvent.click(screen.getByRole("button", { name: "ISK/jump" }));
    const ascLabels = screen.getAllByText(/Start .* → End .*/).map((node) => node.textContent);
    expect(ascLabels[0]).toBe("Start 1 → End 1");

    fireEvent.click(screen.getByRole("button", { name: "ISK/jump ↑" }));
    const descLabels = screen.getAllByText(/Start .* → End .*/).map((node) => node.textContent);
    expect(descLabels[0]).toBe("Start 3 → End 3");
  });

  it("applies text and numeric filters", () => {
    render(<RadiusRouteGroupsPanel results={[makeFlip(1), makeFlip(20), makeFlip(30)]} cargoCapacityM3={1000} />);

    fireEvent.click(screen.getByRole("button", { name: "Show filters" }));
    fireEvent.change(screen.getByLabelText("Route filter"), { target: { value: "start 2" } });
    expect(screen.getByText("Start 20 → End 20")).toBeInTheDocument();
    expect(screen.queryByText("Start 1 → End 1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Route filter"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Profit filter"), { target: { value: ">=2500" } });
    expect(screen.getByText("Start 30 → End 30")).toBeInTheDocument();
    expect(screen.queryByText("Start 20 → End 20")).not.toBeInTheDocument();
  });

  it("renders only rows for current page", () => {
    render(<RadiusRouteGroupsPanel results={Array.from({ length: 30 }, (_, index) => makeFlip(index + 1))} cargoCapacityM3={1000} />);

    fireEvent.change(screen.getByLabelText("Page size"), { target: { value: "25" } });
    expect(screen.getByText("Start 30 → End 30")).toBeInTheDocument();
    expect(screen.queryByText("Start 5 → End 5")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Start 5 → End 5")).toBeInTheDocument();
    expect(screen.queryByText("Start 30 → End 30")).not.toBeInTheDocument();
  });

  it("resets page to zero on page-size change", () => {
    render(<RadiusRouteGroupsPanel results={Array.from({ length: 80 }, (_, index) => makeFlip(index + 1))} cargoCapacityM3={1000} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 / 2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Page size"), { target: { value: "25" } });
    expect(screen.getByText("Page 1 / 4")).toBeInTheDocument();
  });

  it("keeps grouped route actions wired", () => {
    const onQueueRoute = vi.fn();
    const onValidateRoute = vi.fn();

    render(<RadiusRouteGroupsPanel results={[makeFlip(1)]} cargoCapacityM3={1000} onQueueRoute={onQueueRoute} onValidateRoute={onValidateRoute} />);

    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));

    expect(onValidateRoute).toHaveBeenCalledWith("loc:60000001->loc:70000001");
    expect(onQueueRoute).toHaveBeenCalledWith("loc:60000001->loc:70000001", "Start 1 → End 1");

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
        results={[makeFlip(1)]}
        routeWorkspace={{ openBatchBuilder: workspaceOpenBatchBuilder } as any}
        onOpenBatchBuilderForRoute={fallbackOpenBatchBuilder}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Build Batch" })[0]!);

    expect(workspaceOpenBatchBuilder).toHaveBeenCalledTimes(1);
    expect(workspaceOpenBatchBuilder).toHaveBeenCalledWith("loc:60000001->loc:70000001");
    expect(fallbackOpenBatchBuilder).not.toHaveBeenCalled();
  });
});
