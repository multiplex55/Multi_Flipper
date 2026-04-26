import { ActionButton, ControlGroup } from "@/components/ui/ControlPrimitives";
import type { RadiusSessionSummary } from "@/lib/radiusSessionSummary";

export type RadiusStatusSummaryStripProps = {
  summary: RadiusSessionSummary;
  filters: {
    executableNow: boolean;
    hideQueued: boolean;
    needsVerify: boolean;
    showHiddenRows: boolean;
  };
  onToggleExecutableNow: () => void;
  onToggleHideQueued: () => void;
  onToggleNeedsVerify: () => void;
  onToggleHiddenRows: () => void;
  onClearFilters: () => void;
};

function chipLabel(label: string, count: number): string {
  return `${label}: ${count}`;
}

export function RadiusStatusSummaryStrip({
  summary,
  filters,
  onToggleExecutableNow,
  onToggleHideQueued,
  onToggleNeedsVerify,
  onToggleHiddenRows,
  onClearFilters,
}: RadiusStatusSummaryStripProps) {
  return (
    <section
      aria-label="Radius status summary"
      className="mt-1 rounded-sm border border-eve-border/40 bg-eve-dark/20 px-1.5 py-1"
      data-testid="radius-status-summary-strip"
    >
      <ControlGroup zone="status" className="items-center">
        <ActionButton
          tone="accent"
          size="xs"
          selected={filters.executableNow}
          onClick={onToggleExecutableNow}
          title="Toggle executable now filter"
          data-testid="radius-summary-chip-executable"
        >
          {chipLabel("Executable", summary.executableRowCount)}
        </ActionButton>
        <ActionButton
          tone="indigo"
          size="xs"
          selected={filters.hideQueued}
          onClick={onToggleHideQueued}
          title="Toggle hide queued filter"
          data-testid="radius-summary-chip-queued"
        >
          {chipLabel("Queued", summary.queuedRowCount)}
        </ActionButton>
        <ActionButton
          size="xs"
          selected={filters.needsVerify}
          onClick={onToggleNeedsVerify}
          title="Toggle needs verify filter"
          data-testid="radius-summary-chip-needs-verify"
        >
          {chipLabel("Needs Verify", summary.staleRowCount)}
        </ActionButton>
        <ActionButton
          size="xs"
          selected={filters.showHiddenRows}
          onClick={onToggleHiddenRows}
          title="Toggle hidden rows"
          data-testid="radius-summary-chip-hidden"
        >
          {chipLabel("Hidden", summary.hiddenRowCount)}
        </ActionButton>
        <ActionButton
          size="xs"
          selected={summary.activeFilterCount > 0}
          disabled={summary.activeFilterCount === 0}
          onClick={onClearFilters}
          title="Clear active filters"
          data-testid="radius-summary-chip-filters-active"
        >
          {chipLabel("Filters Active", summary.activeFilterCount)}
        </ActionButton>
      </ControlGroup>
    </section>
  );
}
