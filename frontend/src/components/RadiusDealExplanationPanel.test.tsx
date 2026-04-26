import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadiusDealExplanationPanel } from "@/components/RadiusDealExplanationPanel";

describe("RadiusDealExplanationPanel", () => {
  it("renders summary and three explanation sections", () => {
    render(
      <RadiusDealExplanationPanel
        routeKey="jita-amarr"
        routeLabel="Jita → Amarr"
        executionQuality={73.2}
        queueStatus="Queued"
        assignment="Pilot One"
        explanation={{
          summary: "Strong route with manageable drag.",
          positives: ["D/J remains competitive"],
          warnings: ["High weighted slippage"],
          recommendedActions: ["Trim order size"],
        }}
      />,
    );

    expect(screen.getByText("Jita → Amarr")).toBeInTheDocument();
    expect(screen.getByText(/Route context/i)).toBeInTheDocument();
    expect(screen.getByText("Positives")).toBeInTheDocument();
    expect(screen.getByText("Warnings")).toBeInTheDocument();
    expect(screen.getByText("Recommended actions")).toBeInTheDocument();
    expect(screen.getByText(/Exec:/i)).toBeInTheDocument();
    expect(screen.getByText(/Queue:/i)).toBeInTheDocument();
    expect(screen.getByText(/Assignment:/i)).toBeInTheDocument();
  });
});
