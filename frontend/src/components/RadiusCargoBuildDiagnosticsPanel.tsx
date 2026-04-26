import type { RadiusCargoBuildDiagnostics } from "@/lib/radiusCargoBuilds";

type RadiusCargoBuildDiagnosticsPanelProps = {
  presetLabel: string;
  diagnostics: RadiusCargoBuildDiagnostics;
  onSwitchPreset: () => void;
  onRelaxPreset: () => void;
  onClearFilters: () => void;
  onShowPartialRows: () => void;
};

const blockerLabelMap: Array<[keyof RadiusCargoBuildDiagnostics, string]> = [
  ["skippedExecutionQuality", "Execution quality"],
  ["skippedConfidence", "Confidence"],
  ["skippedJumpEfficiency", "Jump efficiency"],
  ["skippedRisk", "Risk"],
  ["skippedCargoFull", "Cargo full"],
  ["skippedCapitalFull", "Capital full"],
  ["skippedNoUnits", "Missing units"],
  ["skippedNoVolume", "Missing volume"],
  ["skippedNoCapital", "Missing capital"],
];

export function RadiusCargoBuildDiagnosticsPanel(props: RadiusCargoBuildDiagnosticsPanelProps) {
  const ranked = blockerLabelMap
    .map(([key, label]) => ({
      key,
      label,
      count: props.diagnostics[key],
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  return (
    <div className="rounded-sm border border-eve-border/50 bg-eve-dark/30 p-4 text-eve-dim" data-testid="radius-cargo-build-diagnostics-panel">
      <div className="font-semibold text-eve-text">
        No cargo builds matched the <span className="text-eve-accent">{props.presetLabel}</span> preset.
      </div>
      <ul className="mt-2 list-disc pl-4 text-[11px]">
        {ranked.length > 0 ? ranked.map((entry) => <li key={entry.key}>{entry.label} ({entry.count})</li>) : <li>No exclusion diagnostics available.</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
        <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text" onClick={props.onSwitchPreset}>Switch preset</button>
        <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text" onClick={props.onRelaxPreset}>Relax preset</button>
        <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text" onClick={props.onClearFilters}>Clear filters</button>
        <button type="button" className="rounded-sm border border-blue-500/60 px-1.5 py-0.5 text-blue-200" onClick={props.onShowPartialRows}>Show partial rows ({props.diagnostics.partialRowsAvailable})</button>
      </div>
    </div>
  );
}
