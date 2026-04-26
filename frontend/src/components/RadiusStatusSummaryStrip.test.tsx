import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadiusStatusSummaryStrip } from "@/components/RadiusStatusSummaryStrip";

describe("RadiusStatusSummaryStrip", () => {
  it("renders all chips and dispatches actions", () => {
    const handlers = {
      onToggleExecutableNow: vi.fn(),
      onToggleHideQueued: vi.fn(),
      onToggleNeedsVerify: vi.fn(),
      onToggleHiddenRows: vi.fn(),
      onClearFilters: vi.fn(),
    };

    render(
      <RadiusStatusSummaryStrip
        summary={{
          totalRowCount: 20,
          visibleRowCount: 10,
          routeCount: 5,
          executableRowCount: 4,
          queuedRowCount: 3,
          assignedRowCount: 2,
          staleRowCount: 6,
          hiddenRowCount: 8,
          activeFilterCount: 2,
        }}
        filters={{
          executableNow: false,
          hideQueued: false,
          needsVerify: false,
          showHiddenRows: false,
        }}
        {...handlers}
      />, 
    );

    fireEvent.click(screen.getByTestId("radius-summary-chip-executable"));
    fireEvent.click(screen.getByTestId("radius-summary-chip-queued"));
    fireEvent.click(screen.getByTestId("radius-summary-chip-needs-verify"));
    fireEvent.click(screen.getByTestId("radius-summary-chip-hidden"));
    fireEvent.click(screen.getByTestId("radius-summary-chip-filters-active"));

    expect(handlers.onToggleExecutableNow).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleHideQueued).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleNeedsVerify).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleHiddenRows).toHaveBeenCalledTimes(1);
    expect(handlers.onClearFilters).toHaveBeenCalledTimes(1);
  });
});
