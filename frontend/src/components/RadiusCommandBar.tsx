import type { ReactNode } from "react";

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

function commandBarButtonClass(active: boolean): string {
  return `px-2 py-0.5 rounded-sm border text-[11px] transition-colors ${
    active
      ? "border-eve-accent/60 text-eve-accent bg-eve-accent/10"
      : "border-eve-border/60 bg-eve-dark/40 text-eve-dim hover:border-eve-accent/50 hover:text-eve-accent"
  }`;
}

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
        className="flex flex-wrap items-center gap-1.5"
      >
        {sessionSection ? <div>{sessionSection}</div> : null}
        <div
          className="text-[11px] text-eve-dim"
          role="status"
          aria-live="polite"
          aria-label={metrics.ariaLabel}
          data-testid="radius-command-bar-metrics"
        >
          {metrics.scanning ? metrics.progressLabel : metrics.resultLabel}
        </div>
        <div className="flex-1" />
        {routeActionsSection ? <div>{routeActionsSection}</div> : null}
        <button
          type="button"
          onClick={actions.onVerifyPrices}
          className="rounded-sm border border-eve-accent/50 px-1.5 py-0.5 text-[10px] text-eve-accent hover:bg-eve-accent/10"
        >
          Verify Prices
        </button>
        <button
          type="button"
          onClick={actions.onExportCsv}
          title="Export CSV"
          className="rounded-sm border border-eve-border/60 bg-eve-dark/40 px-1.5 py-0.5 text-[10px] text-eve-dim hover:border-eve-accent/50 hover:text-eve-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={actions.exportDisabled}
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={actions.onCopyTable}
          title="Copy table"
          className="rounded-sm border border-eve-border/60 bg-eve-dark/40 px-1.5 py-0.5 text-[10px] text-eve-dim hover:border-eve-accent/50 hover:text-eve-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={actions.copyDisabled}
        >
          Copy Table
        </button>
      </section>

      <section
        aria-label="Table view controls"
        className="mt-1 flex flex-wrap items-center gap-1"
        data-testid="radius-toolbar-primary-controls"
      >
        <button
          type="button"
          onClick={insightsToggle.onToggle}
          className={commandBarButtonClass(insightsToggle.pressed)}
          aria-pressed={insightsToggle.pressed}
        >
          {insightsToggle.label}
        </button>
        <button
          type="button"
          onClick={tableControls.onToggleColumns}
          title="Column setup"
          className={commandBarButtonClass(tableControls.columnsActive)}
        >
          Columns
        </button>
        <button
          type="button"
          onClick={tableControls.onToggleFilters}
          className={commandBarButtonClass(tableControls.filtersActive)}
          aria-pressed={tableControls.filtersActive}
        >
          Filters
        </button>
        {tableControls.hasActiveFilters ? (
          <button
            type="button"
            onClick={tableControls.onClearFilters}
            className="inline-flex items-center gap-1 rounded-sm border border-eve-accent/60 bg-eve-accent/10 px-1.5 py-0.5 text-[10px] text-eve-accent"
            data-testid="radius-command-bar-filters-active-chip"
          >
            Active ✕
          </button>
        ) : null}
        <button
          type="button"
          onClick={tableControls.onToggleOneLeg}
          className={commandBarButtonClass(tableControls.oneLegEnabled)}
          data-testid="one-leg-mode-toggle"
          aria-pressed={tableControls.oneLegEnabled}
        >
          One-leg mode {tableControls.oneLegEnabled ? "On" : "Off"}
        </button>
      </section>

      <section
        aria-label="Collapsible ranking and advanced controls"
        className="mt-1"
        data-testid="radius-toolbar-secondary-actions"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {rankingSection ? <div>{rankingSection}</div> : null}
          <button
            type="button"
            onClick={moreControls.onToggleExpanded}
            className="px-2 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] hover:border-eve-accent/50 hover:text-eve-accent transition-colors"
            aria-expanded={moreControls.expanded}
            aria-controls={moreControls.controlsId}
            title="Toggle more controls"
          >
            More Controls {moreControls.expanded ? "▾" : "▸"}
          </button>
        </div>
        {moreControls.expanded ? (
          <div id={moreControls.controlsId} className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            {moreControls.content}
          </div>
        ) : null}
      </section>
    </div>
  );
}
