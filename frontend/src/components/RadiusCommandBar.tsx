import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActionButton,
  ControlGroup,
  MutedLabel,
  ToggleButton,
} from "@/components/ui/ControlPrimitives";
import { RadiusWorkflowHelpDrawer } from "@/components/RadiusWorkflowHelpDrawer";

type RadiusCommandBarProps = {
  shortcutScopeActive?: boolean;
  metrics: {
    scanning: boolean;
    progressLabel: string;
    resultLabel: string;
    ariaLabel: string;
  };
  insightsVisibilityToggle: {
    hidden: boolean;
    label: string;
    onToggle: () => void;
  };
  compactLayoutToggle?: {
    compact: boolean;
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
    onRecalcLens?: () => void;
    exportDisabled: boolean;
    copyDisabled: boolean;
    recalcDisabled?: boolean;
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
  decisionModeControl?: {
    value: string;
    options: Array<{ id: string; label: string; description: string }>;
    onChange: (modeId: string) => void;
  };
};

const RADIUS_COMMAND_INTENT_MAP = {
  verify: { key: "v", label: "Verify prices" },
  copy: { key: "c", label: "Copy table" },
  export: { key: "e", label: "Export CSV" },
  filters: { key: "f", label: "Toggle filters" },
  insights: { key: "i", label: "Toggle insights" },
  recalc: { key: "r", label: "Recalculate lens" },
} as const;

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    target.getAttribute("contenteditable") === "true" ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

export function RadiusCommandBar({
  shortcutScopeActive = true,
  metrics,
  insightsVisibilityToggle,
  compactLayoutToggle,
  tableControls,
  actions,
  moreControls,
  sessionSection,
  rankingSection,
  routeActionsSection,
  decisionModeControl,
}: RadiusCommandBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const intentHandlers = useMemo(
    () => ({
      [RADIUS_COMMAND_INTENT_MAP.verify.key]: () => actions.onVerifyPrices(),
      [RADIUS_COMMAND_INTENT_MAP.copy.key]: () => {
        if (!actions.copyDisabled) actions.onCopyTable();
      },
      [RADIUS_COMMAND_INTENT_MAP.export.key]: () => {
        if (!actions.exportDisabled) actions.onExportCsv();
      },
      [RADIUS_COMMAND_INTENT_MAP.filters.key]: () => tableControls.onToggleFilters(),
      [RADIUS_COMMAND_INTENT_MAP.insights.key]: () =>
        insightsVisibilityToggle.onToggle(),
      [RADIUS_COMMAND_INTENT_MAP.recalc.key]: () => {
        if (!actions.recalcDisabled) actions.onRecalcLens?.();
      },
    }),
    [actions, insightsVisibilityToggle, tableControls],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!shortcutScopeActive) return;
      const root = rootRef.current;
      if (!root || root.closest(".hidden")) return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTextEntryTarget(event.target)) return;
      const intent = event.key.toLowerCase();
      const execute = intentHandlers[intent as keyof typeof intentHandlers];
      if (!execute) return;
      event.preventDefault();
      execute();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [intentHandlers, shortcutScopeActive]);

  return (
    <div
      ref={rootRef}
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
          {decisionModeControl ? (
            <label className="inline-flex items-center gap-1 rounded-sm border border-eve-border/60 bg-eve-dark/40 px-1.5 py-0.5 text-[10px] text-eve-dim">
              Mode
              <select
                aria-label="Decision mode"
                value={decisionModeControl.value}
                onChange={(event) => decisionModeControl.onChange(event.target.value)}
                className="rounded-sm border border-eve-border/60 bg-eve-dark px-1 py-0.5 text-eve-text"
              >
                {decisionModeControl.options.map((option) => (
                  <option key={option.id} value={option.id} title={option.description}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <ActionButton
            tone="accent"
            size="xs"
            onClick={actions.onVerifyPrices}
            title="Verify Prices (V)"
          >
            Verify Prices
          </ActionButton>
          <ActionButton
            tone="neutral"
            size="xs"
            onClick={actions.onExportCsv}
            title="Export CSV (E)"
            disabled={actions.exportDisabled}
          >
            Export CSV
          </ActionButton>
          <ActionButton
            tone="neutral"
            size="xs"
            onClick={actions.onCopyTable}
            title="Copy table (C)"
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
          <ToggleButton
            pressed={!insightsVisibilityToggle.hidden}
            onClick={insightsVisibilityToggle.onToggle}
            title={`${insightsVisibilityToggle.label} (I)`}
          >
            {insightsVisibilityToggle.label}
          </ToggleButton>
          {compactLayoutToggle ? (
            <ToggleButton
              pressed={compactLayoutToggle.compact}
              onClick={compactLayoutToggle.onToggle}
              title={compactLayoutToggle.label}
            >
              {compactLayoutToggle.label}
            </ToggleButton>
          ) : null}
          <ActionButton selected={tableControls.columnsActive} onClick={tableControls.onToggleColumns} title="Column setup">
            Columns
          </ActionButton>
          <ActionButton
            onClick={() => setHelpOpen((previous) => !previous)}
            title="How to use Radius"
          >
            {helpOpen ? "Close Help" : "Help"}
          </ActionButton>
          <ToggleButton
            pressed={tableControls.filtersActive}
            onClick={tableControls.onToggleFilters}
            title="Filters (F)"
          >
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
      <RadiusWorkflowHelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />

      <section
        aria-label="Collapsible ranking and advanced controls"
        className="mt-1 rounded-sm border border-eve-border/40 bg-eve-dark/20 px-1.5 py-1"
        data-testid="radius-toolbar-secondary-actions"
      >
        <ControlGroup zone="status" className="items-center">
          {rankingSection ? <div>{rankingSection}</div> : null}
          <ActionButton
            onClick={actions.onRecalcLens}
            title="Recalculate lens (R)"
            disabled={actions.recalcDisabled}
          >
            Recalc Lens
          </ActionButton>
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
