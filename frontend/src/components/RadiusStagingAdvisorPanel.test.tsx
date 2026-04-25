import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadiusStagingAdvisorPanel } from "@/components/RadiusStagingAdvisorPanel";

describe("RadiusStagingAdvisorPanel", () => {
  it("renders ranked recommendation reasons", () => {
    render(
      <RadiusStagingAdvisorPanel
        recommendations={[
          {
            characterId: 1,
            characterName: "Alpha",
            currentSystemName: "Jita",
            recommendedSystemId: 2,
            recommendedSystemName: "Amarr",
            side: "buy",
            score: 0.91,
            reason: "Amarr ranks high from 5 matching row(s). 2 avg jump(s) from current lens values.",
            supportingRows: 5,
            jumps: 2,
          },
        ]}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText(/Jita → Amarr/)).toBeInTheDocument();
    expect(screen.getByText(/matching row\(s\)/)).toBeInTheDocument();
  });
});
