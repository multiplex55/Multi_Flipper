import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlipResult } from "@/lib/types";
import type { RadiusCargoBuild } from "@/lib/radiusCargoBuilds";
import { RadiusCargoBuildCard } from "@/components/RadiusCargoBuildCard";

afterEach(() => {
  cleanup();
});

function row(name: string): FlipResult {
  return {
    TypeID: name === "Alpha" ? 1 : 2,
    TypeName: name,
  } as FlipResult;
}

function build(): RadiusCargoBuild {
  return {
    id: "route-a:viator_safe",
    routeKey: "route-a",
    routeLabel: "Jita → Amarr",
    rowCount: 2,
    totalProfitIsk: 1000,
    totalCapitalIsk: 5000,
    totalCargoM3: 20,
    totalGrossSellIsk: 6000,
    jumps: 4,
    iskPerJump: 250,
    jumpEfficiency: 0.7,
    capitalEfficiency: 0.2,
    cargoFillPercent: 20,
    confidencePercent: 60,
    executionQuality: 55,
    riskCount: 2,
    riskRate: 0.2,
    riskCue: "moderate",
    executionCue: "watch",
    finalScore: 75,
    rows: [row("Alpha"), row("Beta")],
    lines: [
      { row: row("Alpha"), units: 5, volumeM3: 10, capitalIsk: 100, profitIsk: 50, grossSellIsk: 150, partial: true },
      { row: row("Beta"), units: 3, volumeM3: 10, capitalIsk: 100, profitIsk: 50, grossSellIsk: 150, partial: false },
    ],
  };
}

describe("RadiusCargoBuildCard", () => {
  it("renders partial badge in expanded rows", () => {
    render(
      <RadiusCargoBuildCard
        build={build()}
        onCopyManifest={vi.fn()}
        onCopyBuyChecklist={vi.fn()}
        onCopySellChecklist={vi.fn()}
        onVerify={vi.fn()}
        onQueue={vi.fn()}
        onOpenWorkbench={vi.fn()}
        onOpenBatch={vi.fn()}
      />, 
    );

    fireEvent.click(screen.getByRole("button", { name: /show lines/i }));
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("propagates routeKey in action callbacks", () => {
    const onVerify = vi.fn();
    const onQueue = vi.fn();
    const onWorkbench = vi.fn();
    const onBatch = vi.fn();

    render(
      <RadiusCargoBuildCard
        build={build()}
        onCopyManifest={vi.fn()}
        onCopyBuyChecklist={vi.fn()}
        onCopySellChecklist={vi.fn()}
        onVerify={onVerify}
        onQueue={onQueue}
        onOpenWorkbench={onWorkbench}
        onOpenBatch={onBatch}
      />, 
    );

    fireEvent.click(screen.getByRole("button", { name: /verify/i }));
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));
    fireEvent.click(screen.getByRole("button", { name: "Open workbench" }));
    fireEvent.click(screen.getByRole("button", { name: "Open batch" }));

    expect(onVerify).toHaveBeenCalledWith("route-a");
    expect(onQueue).toHaveBeenCalledWith("route-a");
    expect(onWorkbench).toHaveBeenCalledWith("route-a");
    expect(onBatch).toHaveBeenCalledWith("route-a");
  });

  it("hides assignment quick actions by default and keeps copy/verify actions visible", () => {
    render(
      <RadiusCargoBuildCard
        build={build()}
        onCopyManifest={vi.fn()}
        onCopyBuyChecklist={vi.fn()}
        onCopySellChecklist={vi.fn()}
        onVerify={vi.fn()}
        onQueue={vi.fn()}
        onOpenWorkbench={vi.fn()}
        onOpenBatch={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy manifest" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy checklist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign active" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign best" })).not.toBeInTheDocument();
  });

  it("renders assignment quick actions when explicitly enabled", () => {
    render(
      <RadiusCargoBuildCard
        build={build()}
        onCopyManifest={vi.fn()}
        onCopyBuyChecklist={vi.fn()}
        onCopySellChecklist={vi.fn()}
        onVerify={vi.fn()}
        onQueue={vi.fn()}
        onOpenWorkbench={vi.fn()}
        onOpenBatch={vi.fn()}
        showAssignmentActions
      />,
    );

    expect(screen.getByRole("button", { name: "Assign active" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign best" })).toBeInTheDocument();
    expect(screen.getByLabelText("Assign specific pilot route-a")).toBeInTheDocument();
    expect(screen.getByLabelText("Set staged system route-a")).toBeInTheDocument();
  });

  it("does not break layout with empty assignment data when quick actions are enabled", () => {
    render(
      <RadiusCargoBuildCard
        build={build()}
        onCopyManifest={vi.fn()}
        onCopyBuyChecklist={vi.fn()}
        onCopySellChecklist={vi.fn()}
        onVerify={vi.fn()}
        onQueue={vi.fn()}
        onOpenWorkbench={vi.fn()}
        onOpenBatch={vi.fn()}
        showAssignmentActions
        assignmentByRouteKey={{}}
        characters={[]}
      />,
    );

    expect(screen.getByTestId("radius-cargo-build-card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy manifest" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign active" })).toBeInTheDocument();
  });
});
