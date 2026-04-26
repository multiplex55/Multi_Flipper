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
});
