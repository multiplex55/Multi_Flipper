import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusToolbar } from "@/components/RadiusToolbar";
import { RadiusToolbarPanel } from "@/components/RadiusToolbarPanel";

afterEach(() => {
  cleanup();
});

describe("RadiusToolbar layout", () => {
  it("renders sticky quick controls and pinned panel slot", () => {
    render(
      <RadiusToolbar
        primaryControls={<button type="button" title="Column setup">Columns</button>}
        quickActions={<button type="button">Verifier</button>}
        utilityToggle={<button type="button">Utilities ▸</button>}
        pinnedPanel={<div>Pinned utility</div>}
      />,
    );

    expect(screen.getByTestId("radius-toolbar-quick-bar")).toBeInTheDocument();
    expect(screen.getByTestId("radius-toolbar-primary-controls")).toContainElement(
      screen.getByTitle("Column setup"),
    );
    expect(screen.getByTestId("radius-toolbar-secondary-actions")).toContainElement(
      screen.getByRole("button", { name: "Verifier" }),
    );
    expect(screen.getByTestId("radius-toolbar-pinned-panel-slot")).toHaveTextContent(
      "Pinned utility",
    );
  });

  it("shows popover utilities when opened", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <RadiusToolbarPanel open={false} onToggle={onToggle}>
        <div>Utility content</div>
      </RadiusToolbarPanel>,
    );

    fireEvent.click(screen.getByRole("button", { name: /utilities ▸/i }));
    expect(onToggle).toHaveBeenCalled();
    expect(screen.queryByText("Utility content")).not.toBeInTheDocument();

    rerender(
      <RadiusToolbarPanel open onToggle={onToggle}>
        <div>Utility content</div>
      </RadiusToolbarPanel>,
    );

    expect(screen.getByTestId("radius-toolbar-utilities-panel")).toBeInTheDocument();
    expect(screen.getByText("Utility content")).toBeInTheDocument();
  });
});
