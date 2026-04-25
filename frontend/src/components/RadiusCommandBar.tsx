import type { ReactNode } from "react";
import {
  ActionButton,
  ControlGroup,
  MutedLabel,
  ToggleButton,
} from "@/components/ui/ControlPrimitives";

type RadiusCommandBarProps = {
  metrics: {
    scanning: boolean;
    progressLabel: string;
    resultLabel: string;
    ariaLabel: string;
  };
  insightsToggle: {
    pressed: boolean;
    label: string;
    onToggle: () => void;
  };
  tableControls: {
    columnsActive: boolean;
    onToggleColumns: () => void;
    filtersActive: boolean;
    hasActiveFilters: boolean;
    onToggleFilters: () => void;
    onClearFilters: () => void;
    oneLegEnabled: boolean;
    onToggleOneLeg: () => void;
  };
  actions: {
    onVerifyPrices: () => void;
    onExportCsv: () => void;
    onCopyTable: () => void;
    exportDisabled: boolean;
    copyDisabled: boolean;
  };
  moreControls: {
    expanded: boolean;
    controlsId: string;
    onToggleExpanded: () => void;
    content: ReactNode;
  };
  sessionSection?: ReactNode;
  rankingSection?: ReactNode;
  routeActionsSection?: ReactNode;
};

export function RadiusCommandBar({
  metrics,
  insightsToggle,
  tableControls,
  actions,
  moreControls,
  sessionSection,
  rankingSection,
  routeActionsSection,
}: RadiusCommandBarProps) {
  return (
    <div
      className="sticky top-0 z-20 mt-1 rounded-sm border border-eve-border/60 bg-eve-panel/95 px-2 py-1 backdrop-blur"
      data-testid="radius-toolbar-quick-bar"
    >
      <section
        aria-label="Session and execution actions"
        className="rounded-sm border border-eve-border/40 bg-eve-dark/20 px-1.5 py-1"
      >
        <ControlGroup zone="execution" className="items-center">
          {sessionSection ? <div>{sessionSection}</div> : null}
          <MutedLabel
            role="status"
            aria-live="polite"
            aria-label={metrics.ariaLabel}
            data-testid="radius-command-bar-metrics"
          >
            {metrics.scanning ? metrics.progressLabel : metrics.resultLabel}
          </MutedLabel>
          <div className="flex-1" />
          {routeActionsSection ? <div>{routeActionsSection}</div> : null}
          <ActionButton tone="accent" size="xs" onClick={actions.onVerifyPrices}>
            Verify Prices
          </ActionButton>
          <ActionButton
            tone="neutral"
            size="xs"
            onClick={actions.onExportCsv}
            title="Export CSV"
            disabled={actions.exportDisabled}
          >
            Export CSV
          </ActionButton>
          <ActionButton
            tone="neutral"
            size="xs"
            onClick={actions.onCopyTable}
            title="Copy table"
            disabled={actions.copyDisabled}
          >
            Copy Table
          </ActionButton>
        </ControlGroup>
      </section>

      <section
        aria-label="Table view controls"
        className="mt-1 rounded-sm border border-eve-border/40 bg-eve-dark/20 px-1.5 py-1"
        data-testid="radius-toolbar-primary-controls"
      >
        <ControlGroup zone="analysis">
          <ToggleButton pressed={insightsToggle.pressed} onClick={insightsToggle.onToggle}>
            {insightsToggle.label}
          </ToggleButton>
          <ActionButton selected={tableControls.columnsActive} onClick={tableControls.onToggleColumns} title="Column setup">
            Columns
          </ActionButton>
          <ToggleButton pressed={tableControls.filtersActive} onClick={tableControls.onToggleFilters}>
            Filters
          </ToggleButton>
          {tableControls.hasActiveFilters ? (
            <ActionButton
              tone="accent"
              size="xs"
              onClick={tableControls.onClearFilters}
              data-testid="radius-command-bar-filters-active-chip"
            >
              Active ✕
            </ActionButton>
          ) : null}
          <ToggleButton
            pressed={tableControls.oneLegEnabled}
            onClick={tableControls.onToggleOneLeg}
            data-testid="one-leg-mode-toggle"
          >
            One-leg mode {tableControls.oneLegEnabled ? "On" : "Off"}
          </ToggleButton>
        </ControlGroup>
      </section>

      <section
        aria-label="Collapsible ranking and advanced controls"
        className="mt-1 rounded-sm border border-eve-border/40 bg-eve-dark/20 px-1.5 py-1"
        data-testid="radius-toolbar-secondary-actions"
      >
        <ControlGroup zone="status" className="items-center">
          {rankingSection ? <div>{rankingSection}</div> : null}
          <ActionButton
            onClick={moreControls.onToggleExpanded}
            aria-expanded={moreControls.expanded}
            aria-controls={moreControls.controlsId}
            title="Toggle more controls"
          >
            More Controls {moreControls.expanded ? "▾" : "▸"}
          </ActionButton>
        </ControlGroup>
        {moreControls.expanded ? (
          <ControlGroup id={moreControls.controlsId} zone="analysis" className="mt-1.5 text-[11px]">
            {moreControls.content}
          </ControlGroup>
        ) : null}
      </section>
    </div>
  );
}
