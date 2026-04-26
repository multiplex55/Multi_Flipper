import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusCommandBar } from "@/components/RadiusCommandBar";
import { RadiusWorkflowHelpDrawer } from "@/components/RadiusWorkflowHelpDrawer";

function buildCommandBarProps(
  overrides: Partial<ComponentProps<typeof RadiusCommandBar>> = {},
): ComponentProps<typeof RadiusCommandBar> {
  return {
    metrics: {
      scanning: false,
      progressLabel: "Scanning 2/10",
      resultLabel: "Found 12",
      ariaLabel: "Scan results",
    },
    insightsVisibilityToggle: {
      hidden: false,
      label: "Hide Route Insights",
      onToggle: vi.fn(),
    },
    compactLayoutToggle: {
      compact: false,
      label: "Compact Dashboard",
      onToggle: vi.fn(),
    },
    tableControls: {
      columnsActive: false,
      onToggleColumns: vi.fn(),
      filtersActive: false,
      hasActiveFilters: false,
      onToggleFilters: vi.fn(),
      onClearFilters: vi.fn(),
      oneLegEnabled: false,
      onToggleOneLeg: vi.fn(),
    },
    actions: {
      onVerifyPrices: vi.fn(),
      onExportCsv: vi.fn(),
      onCopyTable: vi.fn(),
      exportDisabled: false,
      copyDisabled: false,
    },
    moreControls: {
      expanded: false,
      controlsId: "more-controls",
      onToggleExpanded: vi.fn(),
      content: <div>Advanced controls</div>,
    },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("RadiusWorkflowHelpDrawer", () => {
  it("opens from command bar trigger and shows workflow guidance", () => {
    render(<RadiusCommandBar {...buildCommandBarProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Help" }));

    expect(screen.getByTestId("radius-workflow-help-drawer")).toBeInTheDocument();
    expect(screen.getByText("Recommended workflow")).toBeInTheDocument();
    expect(screen.getByText("Price verification before undock")).toBeInTheDocument();
  });

  it("closes via close control", () => {
    render(<RadiusCommandBar {...buildCommandBarProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(within(screen.getByTestId("radius-workflow-help-drawer")).getByRole("button", { name: "Close" }));

    expect(screen.queryByTestId("radius-workflow-help-drawer")).not.toBeInTheDocument();
  });

  it("renders static help content without scan data", () => {
    render(<RadiusWorkflowHelpDrawer open onClose={vi.fn()} />);

    const drawer = screen.getByTestId("radius-workflow-help-drawer");
    expect(within(drawer).getByText("Recommended workflow")).toBeInTheDocument();
    expect(within(drawer).getByText("Finding trades")).toBeInTheDocument();
    expect(within(drawer).getByText("Price verification before undock")).toBeInTheDocument();
  });
});
