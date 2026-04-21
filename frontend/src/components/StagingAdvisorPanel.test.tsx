import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StagingAdvisorPanel } from "@/components/StagingAdvisorPanel";
import type { CharacterStagingRecommendation } from "@/lib/types";

const recommendation: CharacterStagingRecommendation = {
  character_id: 1,
  character_name: "Alpha",
  current_system_id: 30000142,
  current_system_name: "Jita",
  recommended_system_id: 30002187,
  recommended_system_name: "Amarr",
  recommended_role: "corridor_runner",
  jumps: 4,
  staging_score: 87,
  role_fit_score: 0.92,
  total_score: 0.88,
  reason_summary: "Amarr favors corridor runner with 4 jumps and 1 corridor(s).",
  top_metrics: {
    destinations_count: 5,
    best_destination_system_name: "Dodixie",
    corridor_count: 1,
    corridor_profit: 1200000,
  },
  top_corridor: {
    source_system_id: 30002187,
    source_system_name: "Amarr",
    target_system_id: 30002659,
    target_system_name: "Dodixie",
  },
};

describe("StagingAdvisorPanel", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders cards with metrics", () => {
    render(
      <StagingAdvisorPanel
        recommendations={[recommendation]}
        onOpenHub={vi.fn()}
        onSetSourceLock={vi.fn()}
        onOpenRouteContext={vi.fn()}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Jita → Amarr")).toBeInTheDocument();
    expect(screen.getByText("corridor_runner")).toBeInTheDocument();
    expect(screen.getByText("87.0")).toBeInTheDocument();
  });

  it("wires callback handlers", () => {
    const onOpenHub = vi.fn();
    const onSetSourceLock = vi.fn();
    const onOpenRouteContext = vi.fn();

    render(
      <StagingAdvisorPanel
        recommendations={[recommendation]}
        onOpenHub={onOpenHub}
        onSetSourceLock={onSetSourceLock}
        onOpenRouteContext={onOpenRouteContext}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open hub" }));
    fireEvent.click(screen.getByRole("button", { name: "Set source lock" }));
    fireEvent.click(screen.getByRole("button", { name: "Open corridor/route" }));

    expect(onOpenHub).toHaveBeenCalledWith(recommendation);
    expect(onSetSourceLock).toHaveBeenCalledWith(recommendation);
    expect(onOpenRouteContext).toHaveBeenCalledWith(recommendation);
  });
});
