import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoringProfileEditor } from "@/components/ScoringProfileEditor";
import { SCORING_PRESETS } from "@/lib/scoringPresets";
import type { StrategyScoreConfig } from "@/lib/types";

const baseValue: StrategyScoreConfig = {
  profit_weight: 35,
  risk_weight: 25,
  velocity_weight: 20,
  jump_weight: 10,
  capital_weight: 10,
};

afterEach(() => {
  cleanup();
});

describe("ScoringProfileEditor", () => {
  it("renders all five sliders", () => {
    render(<ScoringProfileEditor value={baseValue} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Profit weight")).toBeInTheDocument();
    expect(screen.getByLabelText("Risk weight")).toBeInTheDocument();
    expect(screen.getByLabelText("Velocity weight")).toBeInTheDocument();
    expect(screen.getByLabelText("Jumps weight")).toBeInTheDocument();
    expect(screen.getByLabelText("Capital weight")).toBeInTheDocument();
  });

  it("applies each preset with expected weights", () => {
    const onChange = vi.fn();
    render(<ScoringProfileEditor value={baseValue} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Conservative" }));
    expect(onChange).toHaveBeenLastCalledWith(SCORING_PRESETS.conservative);

    fireEvent.click(screen.getByRole("button", { name: "Balanced" }));
    expect(onChange).toHaveBeenLastCalledWith(SCORING_PRESETS.balanced);

    fireEvent.click(screen.getByRole("button", { name: "Aggressive" }));
    expect(onChange).toHaveBeenLastCalledWith(SCORING_PRESETS.aggressive);
  });

  it("emits onChange when a slider is updated", () => {
    const onChange = vi.fn();
    render(<ScoringProfileEditor value={baseValue} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Profit weight"), {
      target: { value: "42" },
    });

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, profit_weight: 42 });
  });

  it("emits selected run recipe", () => {
    const onRecipeApply = vi.fn();
    render(
      <ScoringProfileEditor
        value={baseValue}
        onChange={vi.fn()}
        onRecipeApply={onRecipeApply}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fast run" }));
    expect(onRecipeApply).toHaveBeenCalledWith("fast_run");
  });
});
