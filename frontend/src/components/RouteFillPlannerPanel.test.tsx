import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteFillPlannerPanel } from "@/components/RouteFillPlannerPanel";
import type { RouteFillPlannerSections } from "@/lib/routeFillPlanner";

const sections: RouteFillPlannerSections = {
  sameEndpointFiller: [
    {
      id: "filler:1",
      title: "Same endpoint",
      type: "filler",
      incrementalProfitIsk: 100000,
      addedJumps: 0,
      addedM3: 10,
      confidencePercent: 80,
      rationale: "Endpoint match",
      sourceLineKeys: ["1:100:200"],
    },
  ],
  alongTheWayDetourFiller: [
    {
      id: "core:2",
      title: "Detour",
      type: "core",
      incrementalProfitIsk: 90000,
      addedJumps: 2,
      addedM3: 12,
      confidencePercent: 70,
      rationale: "Detour",
      sourceLineKeys: ["2:100:250"],
    },
  ],
  backhaulReturnLegFiller: [
    {
      id: "loop:3",
      title: "Backhaul",
      type: "loop_backhaul",
      incrementalProfitIsk: 200000,
      addedJumps: 1,
      addedM3: 15,
      confidencePercent: 85,
      rationale: "Loop",
      sourceLineKeys: ["3:100:200", "4:200:100"],
    },
  ],
};

describe("RouteFillPlannerPanel", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders all three sections", () => {
    render(
      <RouteFillPlannerPanel
        sections={sections}
        onAddToRoutePack={() => undefined}
        onOpenBatchBuilderSelection={() => undefined}
      />,
    );

    expect(screen.getByTestId("route-fill-section-same-endpoint")).toBeInTheDocument();
    expect(screen.getByTestId("route-fill-section-detour")).toBeInTheDocument();
    expect(screen.getByTestId("route-fill-section-backhaul")).toBeInTheDocument();
  });

  it("fires add-to-pack and open-batch-builder actions", () => {
    const onAdd = vi.fn();
    const onOpen = vi.fn();
    render(
      <RouteFillPlannerPanel
        sections={sections}
        onAddToRoutePack={onAdd}
        onOpenBatchBuilderSelection={onOpen}
      />,
    );

    const firstSuggestion = screen.getAllByTestId("route-fill-suggestion:filler:1")[0];
    fireEvent.click(within(firstSuggestion).getByRole("button", { name: "Add" }));
    fireEvent.click(within(firstSuggestion).getByRole("button", { name: "Open" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].id).toBe("filler:1");
    expect(onOpen.mock.calls[0][0].id).toBe("filler:1");
  });

  it("renders planner metrics and deterministic table columns", () => {
    render(
      <RouteFillPlannerPanel
        sections={sections}
        metrics={{
          selectedCargoM3: 40,
          cargoCapacityM3: 100,
          remainingCargoM3: 60,
          selectedCapitalIsk: 500000,
          selectedProfitIsk: 90000,
        }}
        onAddToRoutePack={() => undefined}
        onOpenBatchBuilderSelection={() => undefined}
      />,
    );

    expect(screen.getByTestId("route-fill-planner-metrics")).toHaveTextContent("40.00 / 100.00 m³");
    expect(screen.getAllByText("incrementalProfitIsk").length).toBeGreaterThan(0);
    expect(screen.getAllByText("profitPerM3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("profitPerAddedJump").length).toBeGreaterThan(0);
    expect(screen.getAllByText("sourceLineKeys").length).toBeGreaterThan(0);
    expect(screen.getByTestId("route-fill-suggestion:filler:1")).toHaveTextContent("1:100:200");
  });
});
