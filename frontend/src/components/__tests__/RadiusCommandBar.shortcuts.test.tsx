import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadiusCommandBar } from "@/components/RadiusCommandBar";

afterEach(() => {
  cleanup();
});

function buildProps(
  overrides: Partial<ComponentProps<typeof RadiusCommandBar>> = {},
): ComponentProps<typeof RadiusCommandBar> {
  return {
    shortcutScopeActive: true,
    metrics: {
      scanning: false,
      progressLabel: "Scanning 2/10",
      resultLabel: "Found 12",
      ariaLabel: "Scan results",
    },
    insightsToggle: {
      pressed: false,
      label: "Compact Insights",
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
      onRecalcLens: vi.fn(),
      exportDisabled: false,
      copyDisabled: false,
      recalcDisabled: false,
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

describe("RadiusCommandBar shortcuts", () => {
  it("triggers each Radius shortcut handler when scope is active", () => {
    const props = buildProps();
    render(<RadiusCommandBar {...props} />);

    fireEvent.keyDown(document, { key: "v" });
    fireEvent.keyDown(document, { key: "c" });
    fireEvent.keyDown(document, { key: "e" });
    fireEvent.keyDown(document, { key: "f" });
    fireEvent.keyDown(document, { key: "i" });
    fireEvent.keyDown(document, { key: "r" });

    expect(props.actions.onVerifyPrices).toHaveBeenCalledTimes(1);
    expect(props.actions.onCopyTable).toHaveBeenCalledTimes(1);
    expect(props.actions.onExportCsv).toHaveBeenCalledTimes(1);
    expect(props.tableControls.onToggleFilters).toHaveBeenCalledTimes(1);
    expect(props.insightsToggle.onToggle).toHaveBeenCalledTimes(1);
    expect(props.actions.onRecalcLens).toHaveBeenCalledTimes(1);
  });

  it("does not trigger shortcuts when Radius scope is inactive", () => {
    const props = buildProps({ shortcutScopeActive: false });
    render(<RadiusCommandBar {...props} />);

    fireEvent.keyDown(document, { key: "v" });
    fireEvent.keyDown(document, { key: "c" });
    fireEvent.keyDown(document, { key: "e" });
    fireEvent.keyDown(document, { key: "f" });
    fireEvent.keyDown(document, { key: "i" });
    fireEvent.keyDown(document, { key: "r" });

    expect(props.actions.onVerifyPrices).not.toHaveBeenCalled();
    expect(props.actions.onCopyTable).not.toHaveBeenCalled();
    expect(props.actions.onExportCsv).not.toHaveBeenCalled();
    expect(props.tableControls.onToggleFilters).not.toHaveBeenCalled();
    expect(props.insightsToggle.onToggle).not.toHaveBeenCalled();
    expect(props.actions.onRecalcLens).not.toHaveBeenCalled();
  });

  it("ignores shortcuts while focus is in text entry fields", () => {
    const props = buildProps();
    render(
      <>
        <input aria-label="text input" />
        <textarea aria-label="text area" />
        <div aria-label="rich text" contentEditable />
        <RadiusCommandBar {...props} />
      </>,
    );

    fireEvent.keyDown(screen.getByLabelText("text input"), { key: "v" });
    fireEvent.keyDown(screen.getByLabelText("text area"), { key: "c" });
    fireEvent.keyDown(screen.getByLabelText("rich text"), { key: "e" });
    fireEvent.keyDown(screen.getByLabelText("text input"), { key: "f" });
    fireEvent.keyDown(screen.getByLabelText("text area"), { key: "i" });
    fireEvent.keyDown(screen.getByLabelText("rich text"), { key: "r" });

    expect(props.actions.onVerifyPrices).not.toHaveBeenCalled();
    expect(props.actions.onCopyTable).not.toHaveBeenCalled();
    expect(props.actions.onExportCsv).not.toHaveBeenCalled();
    expect(props.tableControls.onToggleFilters).not.toHaveBeenCalled();
    expect(props.insightsToggle.onToggle).not.toHaveBeenCalled();
    expect(props.actions.onRecalcLens).not.toHaveBeenCalled();
  });

  it("treats disabled shortcut actions as no-ops", () => {
    const props = buildProps({
      actions: {
        onVerifyPrices: vi.fn(),
        onExportCsv: vi.fn(),
        onCopyTable: vi.fn(),
        onRecalcLens: vi.fn(),
        exportDisabled: true,
        copyDisabled: true,
        recalcDisabled: true,
      },
    });

    render(<RadiusCommandBar {...props} />);

    fireEvent.keyDown(document, { key: "c" });
    fireEvent.keyDown(document, { key: "e" });
    fireEvent.keyDown(document, { key: "r" });

    expect(props.actions.onCopyTable).not.toHaveBeenCalled();
    expect(props.actions.onExportCsv).not.toHaveBeenCalled();
    expect(props.actions.onRecalcLens).not.toHaveBeenCalled();
  });

  it("keeps primary command controls in predictable focus order with shortcut hints", () => {
    render(<RadiusCommandBar {...buildProps()} />);

    const primaryButtons =
      screen
        .getByTestId("radius-toolbar-quick-bar")
        .querySelectorAll<HTMLButtonElement>('section[aria-label="Session and execution actions"] button');

    expect(Array.from(primaryButtons).map((button) => button.textContent?.trim())).toEqual([
      "Verify Prices",
      "Export CSV",
      "Copy Table",
    ]);

    expect(screen.getByRole("button", { name: "Verify Prices" })).toHaveAttribute(
      "title",
      "Verify Prices (V)",
    );
    expect(screen.getByRole("button", { name: "Export CSV" })).toHaveAttribute(
      "title",
      "Export CSV (E)",
    );
    expect(screen.getByRole("button", { name: "Copy Table" })).toHaveAttribute(
      "title",
      "Copy table (C)",
    );
    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
      "title",
      "Filters (F)",
    );
    expect(screen.getByRole("button", { name: "Compact Insights" })).toHaveAttribute(
      "title",
      "Compact Insights (I)",
    );
    expect(screen.getByRole("button", { name: "Recalc Lens" })).toHaveAttribute(
      "title",
      "Recalculate lens (R)",
    );

    const orderedFocusTargets = [
      screen.getByRole("button", { name: "Verify Prices" }),
      screen.getByRole("button", { name: "Export CSV" }),
      screen.getByRole("button", { name: "Copy Table" }),
      screen.getByRole("button", { name: "Compact Insights" }),
      screen.getByRole("button", { name: "Filters" }),
      screen.getByRole("button", { name: "Recalc Lens" }),
    ];

    for (const button of orderedFocusTargets) {
      button.focus();
      expect(document.activeElement).toBe(button);
    }
  });
});
