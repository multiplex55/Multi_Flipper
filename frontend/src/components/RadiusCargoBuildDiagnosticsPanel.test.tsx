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
});
