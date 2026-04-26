import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusCargoBuildDiagnosticsPanel } from "@/components/RadiusCargoBuildDiagnosticsPanel";

afterEach(() => {
  cleanup();
});

describe("RadiusCargoBuildDiagnosticsPanel", () => {
  it("ranks blockers by count and hides zero-count reasons", () => {
    render(
      <RadiusCargoBuildDiagnosticsPanel
        presetLabel="Viator Safe"
        diagnostics={{
          totalRows: 10,
          skippedNoUnits: 0,
          skippedNoVolume: 2,
          skippedNoCapital: 0,
          skippedCargoFull: 1,
          skippedCapitalFull: 0,
          skippedExecutionQuality: 5,
          skippedConfidence: 3,
          skippedJumpEfficiency: 0,
          skippedRisk: 4,
          partialRowsAvailable: 2,
        }}
        rejectedBuilds={[]}
        onSwitchPreset={vi.fn()}
        onRelaxPreset={vi.fn()}
        onClearFilters={vi.fn()}
        onShowPartialRows={vi.fn()}
      />,
    );

    const items = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(items[0]).toContain("Execution quality (5)");
    expect(items[1]).toContain("Risk (4)");
    expect(items[2]).toContain("Confidence (3)");
    expect(screen.queryByText(/Missing units/i)).not.toBeInTheDocument();
  });

  it("wires actionable controls", () => {
    const onSwitchPreset = vi.fn();
    const onRelaxPreset = vi.fn();
    const onClearFilters = vi.fn();
    const onShowPartialRows = vi.fn();

    render(
      <RadiusCargoBuildDiagnosticsPanel
        presetLabel="Viator Safe"
        diagnostics={{
          totalRows: 0,
          skippedNoUnits: 0,
          skippedNoVolume: 0,
          skippedNoCapital: 0,
          skippedCargoFull: 0,
          skippedCapitalFull: 0,
          skippedExecutionQuality: 0,
          skippedConfidence: 0,
          skippedJumpEfficiency: 0,
          skippedRisk: 0,
          partialRowsAvailable: 6,
        }}
        rejectedBuilds={[]}
        onSwitchPreset={onSwitchPreset}
        onRelaxPreset={onRelaxPreset}
        onClearFilters={onClearFilters}
        onShowPartialRows={onShowPartialRows}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /switch preset/i }));
    fireEvent.click(screen.getByRole("button", { name: /relax preset/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    fireEvent.click(screen.getByRole("button", { name: /show partial rows/i }));

    expect(onSwitchPreset).toHaveBeenCalledTimes(1);
    expect(onRelaxPreset).toHaveBeenCalledTimes(1);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(onShowPartialRows).toHaveBeenCalledTimes(1);
  });

  it("renders near misses only when rejected builds are provided", () => {
    const rejectedBuilds = [
      {
        routeKey: "1:2",
        routeLabel: "Jita → Amarr",
        totalProfitIsk: 3_000_000,
        totalCapitalIsk: 200_000_000,
        totalCargoM3: 5_000,
        cargoFillPercent: 50,
        confidencePercent: 48,
        executionQuality: 52,
        jumps: 8,
        iskPerJump: 375_000,
        riskCount: 1,
        riskRate: 0.1,
        blockers: [
          {
            kind: "confidence" as const,
            actual: 48,
            required: 55,
            message: "Confidence is below the required fill confidence gate.",
            severity: 2,
          },
          {
            kind: "jump_efficiency" as const,
            actual: 375_000,
            required: 400_000,
            message: "Route ISK per jump is below the configured floor.",
            severity: 1,
          },
        ],
        suggestedAction: "relax_preset" as const,
      },
    ];
    const { rerender } = render(
      <RadiusCargoBuildDiagnosticsPanel
        presetLabel="Viator Safe"
        diagnostics={{
          totalRows: 10,
          skippedNoUnits: 1,
          skippedNoVolume: 0,
          skippedNoCapital: 0,
          skippedCargoFull: 0,
          skippedCapitalFull: 0,
          skippedExecutionQuality: 1,
          skippedConfidence: 1,
          skippedJumpEfficiency: 1,
          skippedRisk: 0,
          partialRowsAvailable: 0,
        }}
        rejectedBuilds={rejectedBuilds}
        onSwitchPreset={vi.fn()}
        onRelaxPreset={vi.fn()}
        onClearFilters={vi.fn()}
        onShowPartialRows={vi.fn()}
      />,
    );
    expect(screen.getByText(/Near Misses/i)).toBeInTheDocument();
    expect(screen.getByText(/Suggested action: Relax preset thresholds/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence is below/i)).toBeInTheDocument();

    rerender(
      <RadiusCargoBuildDiagnosticsPanel
        presetLabel="Viator Safe"
        diagnostics={{
          totalRows: 10,
          skippedNoUnits: 1,
          skippedNoVolume: 0,
          skippedNoCapital: 0,
          skippedCargoFull: 0,
          skippedCapitalFull: 0,
          skippedExecutionQuality: 1,
          skippedConfidence: 1,
          skippedJumpEfficiency: 1,
          skippedRisk: 0,
          partialRowsAvailable: 0,
        }}
        rejectedBuilds={[]}
        onSwitchPreset={vi.fn()}
        onRelaxPreset={vi.fn()}
        onClearFilters={vi.fn()}
        onShowPartialRows={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Near Misses/i)).not.toBeInTheDocument();
  });
});
