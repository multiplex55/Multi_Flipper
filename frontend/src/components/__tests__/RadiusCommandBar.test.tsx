import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusCommandBar } from "@/components/RadiusCommandBar";

afterEach(() => {
  cleanup();
});

function renderBar(overrides: Partial<ComponentProps<typeof RadiusCommandBar>> = {}) {
  const props: ComponentProps<typeof RadiusCommandBar> = {
    metrics: {
      scanning: true,
      progressLabel: "Scanning 3/10",
      resultLabel: "Found 42",
      ariaLabel: "Scan progress: 3 of 10",
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
      groups: [{ id: "filters", label: "Filters", content: <div>Filter settings</div> }],
      activeGroupId: null,
    },
    activeControlChips: [{ id: "filters", label: "Filters: 2", sectionId: "filters" }],
    onOpenControlSection: vi.fn(),
  };
  return render(<RadiusCommandBar {...props} {...overrides} />);
}

describe("RadiusCommandBar", () => {
  it("renders single top command row with deduplicated core actions", () => {
    renderBar();
    expect(screen.getAllByRole("button", { name: "Verify Prices" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Export CSV" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Copy Table" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Columns" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Filters" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Help" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Compact Dashboard" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /More Controls/ })).toHaveLength(1);
  });

  it("opens control section when active chip is clicked", () => {
    const onToggleExpanded = vi.fn();
    const onOpenControlSection = vi.fn();
    renderBar({
      moreControls: {
        expanded: false,
        controlsId: "more-controls",
        onToggleExpanded,
        groups: [{ id: "filters", label: "Filters", content: <div>Filter settings</div> }],
        activeGroupId: null,
      },
      onOpenControlSection,
    });

    fireEvent.click(screen.getByTestId("radius-active-control-chip:filters"));
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(onOpenControlSection).toHaveBeenCalledWith("filters");
  });

  it("renders grouped menu sections when more controls are expanded", () => {
    renderBar({
      moreControls: {
        expanded: true,
        controlsId: "more-controls",
        onToggleExpanded: vi.fn(),
        groups: [
          { id: "session", label: "Session", content: <div>Session controls</div> },
          { id: "filters", label: "Filters", content: <div>Filter settings</div> },
        ],
        activeGroupId: "filters",
      },
    });

    expect(screen.getByTestId("radius-control-menu-group:session")).toBeInTheDocument();
    expect(screen.getByTestId("radius-control-menu-group:filters")).toBeInTheDocument();
    expect(screen.getByText("Filter settings")).toBeInTheDocument();
  });
});
