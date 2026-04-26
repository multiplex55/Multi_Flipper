import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadiusDealMovementBadge } from "@/components/RadiusDealMovementBadge";

describe("RadiusDealMovementBadge", () => {
  it("renders compact improving label with delta", () => {
    render(
      <RadiusDealMovementBadge
        movement={{
          key: "k",
          label: "improving",
          profitDeltaPct: 18,
          quantityDeltaPct: 10,
          executionDelta: 4,
          trapRiskDelta: -3,
        }}
      />,
    );
    expect(screen.getByText("Improving +18%")).toBeInTheDocument();
  });

  it("renders collapsing label with negative delta", () => {
    render(
      <RadiusDealMovementBadge
        movement={{
          key: "k",
          label: "collapsing",
          profitDeltaPct: -42,
          quantityDeltaPct: -60,
          executionDelta: -20,
          trapRiskDelta: 21,
        }}
      />,
    );
    expect(screen.getByText("Collapsing -42%")).toBeInTheDocument();
  });

  it("can hide delta text", () => {
    render(
      <RadiusDealMovementBadge
        showDelta={false}
        movement={{
          key: "k",
          label: "worse",
          profitDeltaPct: -19,
          quantityDeltaPct: -8,
          executionDelta: -10,
          trapRiskDelta: 11,
        }}
      />,
    );
    expect(screen.getByText("Worse")).toBeInTheDocument();
    expect(screen.queryByText("Worse -19%")).not.toBeInTheDocument();
  });
});
