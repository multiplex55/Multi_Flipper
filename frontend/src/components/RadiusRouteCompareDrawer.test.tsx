import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadiusRouteCompareDrawer } from "@/components/RadiusRouteCompareDrawer";

describe("RadiusRouteCompareDrawer", () => {
  it("shows empty guidance", () => {
    render(<RadiusRouteCompareDrawer rows={[]} onRemove={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText(/Add route to compare/i)).toBeInTheDocument();
  });

  it("removes routes", () => {
    const onRemove = vi.fn();
    render(
      <RadiusRouteCompareDrawer
        rows={[
          {
            routeKey: "r1",
            routeLabel: "Jita → Amarr",
            profit: 100,
            capital: 50,
            roi: 12,
            cargoUsedPercent: 20,
            jumps: 3,
            iskPerJump: 30,
            executionQuality: 88,
            verification: "verified",
            queueStatus: "queued",
            assignedPilot: "Pilot",
          },
        ]}
        onRemove={onRemove}
        onClear={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Remove Jita/i }));
    expect(onRemove).toHaveBeenCalledWith("r1");
  });
});
