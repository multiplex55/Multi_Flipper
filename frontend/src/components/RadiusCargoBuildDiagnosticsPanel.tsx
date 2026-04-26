import type {
  RadiusCargoBuildDiagnostics,
  RadiusRejectedCargoBuild,
} from "@/lib/radiusCargoBuilds";

type RadiusCargoBuildDiagnosticsPanelProps = {
  presetLabel: string;
  diagnostics: RadiusCargoBuildDiagnostics;
  rejectedBuilds: RadiusRejectedCargoBuild[];
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

const actionLabelMap: Record<RadiusRejectedCargoBuild["suggestedAction"], string> = {
  relax_preset: "Relax preset thresholds",
  trim_lines: "Trim invalid lines",
  increase_capital: "Increase capital budget",
  increase_cargo: "Increase cargo capacity",
  skip: "Skip this route",
};

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
      {props.rejectedBuilds.length > 0 && (
        <div className="mt-2 rounded-sm border border-eve-border/40 bg-eve-dark/20 p-2 text-[11px]">
          <div className="font-semibold text-eve-text">Near Misses</div>
          <div className="mt-1 text-eve-dim">
            {props.rejectedBuilds.length} route{props.rejectedBuilds.length === 1 ? "" : "s"} came close but failed one or more gates.
          </div>
          <ul className="mt-1 space-y-1">
            {props.rejectedBuilds.map((build) => (
              <li key={`${build.routeKey}:${build.suggestedAction}`} className="rounded-sm border border-eve-border/30 p-1.5">
                <div className="text-eve-text">
                  {build.routeLabel} · Profit {Math.round(build.totalProfitIsk).toLocaleString()} · Fill {build.cargoFillPercent.toFixed(1)}%
                </div>
                <div className="text-eve-dim">
                  Confidence {build.confidencePercent.toFixed(1)}% · Execution {build.executionQuality.toFixed(1)} · Risk {build.riskCount} ({(build.riskRate * 100).toFixed(0)}%) · ISK/jump {Math.round(build.iskPerJump).toLocaleString()}
                </div>
                <ul className="list-disc pl-4 text-eve-dim">
                  {build.blockers.map((blocker, index) => (
                    <li key={`${build.routeKey}:${blocker.kind}:${index}`}>
                      {blocker.message} (actual: {blocker.actual.toFixed(2)}, required: {blocker.required.toFixed(2)})
                    </li>
                  ))}
                </ul>
                <div className="text-[10px] uppercase tracking-wide text-eve-accent">
                  Suggested action: {actionLabelMap[build.suggestedAction]}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
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
