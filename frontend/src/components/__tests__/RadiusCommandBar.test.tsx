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
  };
  return render(<RadiusCommandBar {...props} {...overrides} />);
}

describe("RadiusCommandBar", () => {
  it("renders progress and result counts with accessible labels", () => {
    const { rerender } = renderBar();
    expect(screen.getByRole("status", { name: "Scan progress: 3 of 10" })).toHaveTextContent(
      "Scanning 3/10",
    );

    rerender(
      <RadiusCommandBar
        metrics={{
          scanning: false,
          progressLabel: "Scanning 3/10",
          resultLabel: "Showing 8 of 20",
          ariaLabel: "Scan results: 8 visible from 20 total",
        }}
        insightsVisibilityToggle={{
          hidden: false,
          label: "Hide Route Insights",
          onToggle: vi.fn(),
        }}
        compactLayoutToggle={{
          compact: false,
          label: "Compact Dashboard",
          onToggle: vi.fn(),
        }}
        tableControls={{
          columnsActive: false,
          onToggleColumns: vi.fn(),
          filtersActive: false,
          hasActiveFilters: false,
          onToggleFilters: vi.fn(),
          onClearFilters: vi.fn(),
          oneLegEnabled: false,
          onToggleOneLeg: vi.fn(),
        }}
        actions={{
          onVerifyPrices: vi.fn(),
          onExportCsv: vi.fn(),
          onCopyTable: vi.fn(),
          exportDisabled: false,
          copyDisabled: false,
        }}
        moreControls={{
          expanded: false,
          controlsId: "more-controls",
          onToggleExpanded: vi.fn(),
          content: <div>Advanced controls</div>,
        }}
      />,
    );
    expect(
      screen.getByRole("status", { name: "Scan results: 8 visible from 20 total" }),
    ).toHaveTextContent("Showing 8 of 20");
  });

  it("shows filter active chip when filters are active", () => {
    renderBar({
      tableControls: {
        columnsActive: false,
        onToggleColumns: vi.fn(),
        filtersActive: true,
        hasActiveFilters: true,
        onToggleFilters: vi.fn(),
        onClearFilters: vi.fn(),
        oneLegEnabled: false,
        onToggleOneLeg: vi.fn(),
      },
    });
    expect(screen.getByTestId("radius-command-bar-filters-active-chip")).toBeInTheDocument();
  });

  it("supports More Controls expand and collapse with disclosure attributes", () => {
    const onToggleExpanded = vi.fn();
    renderBar({
      moreControls: {
        expanded: false,
        controlsId: "more-controls",
        onToggleExpanded,
        content: <div>Advanced controls</div>,
      },
    });

    const toggle = screen.getByRole("button", { name: /more controls ▸/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "more-controls");
    fireEvent.click(toggle);
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);

    cleanup();
    renderBar({
      moreControls: {
        expanded: true,
        controlsId: "more-controls",
        onToggleExpanded: vi.fn(),
        content: <div>Advanced controls</div>,
      },
    });
    expect(screen.getByRole("button", { name: /more controls ▾/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Advanced controls")).toBeInTheDocument();
  });

  it("invokes verify/export/copy/filters/columns handlers", () => {
    const onToggleColumns = vi.fn();
    const onToggleFilters = vi.fn();
    const onVerifyPrices = vi.fn();
    const onExportCsv = vi.fn();
    const onCopyTable = vi.fn();
    renderBar({
      tableControls: {
        columnsActive: false,
        onToggleColumns,
        filtersActive: false,
        hasActiveFilters: false,
        onToggleFilters,
        onClearFilters: vi.fn(),
        oneLegEnabled: false,
        onToggleOneLeg: vi.fn(),
      },
      actions: {
        onVerifyPrices,
        onExportCsv,
        onCopyTable,
        exportDisabled: false,
        copyDisabled: false,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify Prices" }));
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Table" }));

    expect(onToggleColumns).toHaveBeenCalledTimes(1);
    expect(onToggleFilters).toHaveBeenCalledTimes(1);
    expect(onVerifyPrices).toHaveBeenCalledTimes(1);
    expect(onExportCsv).toHaveBeenCalledTimes(1);
    expect(onCopyTable).toHaveBeenCalledTimes(1);
  });

  it("disables export and copy when no rows are available", () => {
    renderBar({
      actions: {
        onVerifyPrices: vi.fn(),
        onExportCsv: vi.fn(),
        onCopyTable: vi.fn(),
        exportDisabled: true,
        copyDisabled: true,
      },
    });

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy Table" })).toBeDisabled();
  });

  it("sets aria-pressed states for toggle controls", () => {
    renderBar({
      insightsVisibilityToggle: {
        hidden: false,
        label: "Hide Route Insights",
        onToggle: vi.fn(),
      },
      compactLayoutToggle: {
        compact: true,
        label: "Compact Dashboard",
        onToggle: vi.fn(),
      },
      tableControls: {
        columnsActive: false,
        onToggleColumns: vi.fn(),
        filtersActive: true,
        hasActiveFilters: false,
        onToggleFilters: vi.fn(),
        onClearFilters: vi.fn(),
        oneLegEnabled: true,
        onToggleOneLeg: vi.fn(),
      },
    });

    expect(screen.getByRole("button", { name: "Hide Route Insights" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Compact Dashboard" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("one-leg-mode-toggle")).toHaveAttribute("aria-pressed", "true");
  });
});
