import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BatchBuilderFillerAdvisor } from "@/components/BatchBuilderFillerAdvisor";

const suggestion = { lineKey: "1:100:200", type_id: 1, type_name: "Tritanium", units: 1, unit_volume_m3: 1, buy_system_id: 10, buy_location_id: 100, sell_system_id: 20, sell_location_id: 200, volume_m3: 4, added_profit_isk: 1000, added_capital_isk: 100, fill_confidence: 0.8, stale_risk: 0.1, suggested_role: "safe_filler", filler_score: 80, iskPerM3: 250, roiPct: 10, score: 10, sameLeg: true, safetyLabel: "safe" as const, profitLabel: "best_safe" as const, warnings: [], reasons: [] };

describe("BatchBuilderFillerAdvisor", () => {
  it("renders suggestions and wires actions", () => {
    const onAddOne = vi.fn();
    const onAddAllSafe = vi.fn();
    const onReplaceWeakLine = vi.fn();
    render(<BatchBuilderFillerAdvisor remainingCargoM3={10} suggestions={[suggestion]} onAddOne={onAddOne} onAddAllSafe={onAddAllSafe} onReplaceWeakLine={onReplaceWeakLine} />);
    fireEvent.click(screen.getByText("Add one"));
    fireEvent.click(screen.getByText("Add all safe"));
    fireEvent.click(screen.getByText("Replace weak"));
    expect(onAddOne).toHaveBeenCalledWith("1:100:200");
    expect(onAddAllSafe).toHaveBeenCalled();
    expect(onReplaceWeakLine).toHaveBeenCalledWith("1:100:200");
  });
});
