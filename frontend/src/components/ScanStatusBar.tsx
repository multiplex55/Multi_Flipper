import { useMemo } from "react";

export type ActiveScanState = {
  active: boolean;
  scan_id?: string;
  kind?: string;
  started_at?: string;
  last_progress_at?: string;
  stage?: string;
  terminal_status?: string;
};

type Props = {
  state: ActiveScanState | null;
  reconciling: boolean;
  onCancel: () => void;
  onStartAnyway?: () => void;
  allowStartAnyway?: boolean;
};

const STALL_MS = 20_000;

export function ScanStatusBar({ state, reconciling, onCancel, onStartAnyway, allowStartAnyway }: Props) {
  const now = Date.now();
  const started = state?.started_at ? Date.parse(state.started_at) : NaN;
  const lastProgress = state?.last_progress_at ? Date.parse(state.last_progress_at) : NaN;
  const elapsedSec = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const lastSec = Number.isFinite(lastProgress) ? Math.max(0, Math.floor((now - lastProgress) / 1000)) : 0;
  const stalled = Boolean(state?.active && Number.isFinite(lastProgress) && now - lastProgress > STALL_MS);
  const label = useMemo(() => {
    if (reconciling) return "Reconciling scan state with backend…";
    if (!state) return "No known scan state.";
    if (stalled) return `Scan appears stalled (${lastSec}s since progress)`;
    return state.active ? `Active scan (${state.kind || "scan"})` : `Last scan ${state.terminal_status || "finished"}`;
  }, [lastSec, reconciling, stalled, state]);

  return <div className="text-xs px-2 py-1 border border-eve-border rounded-sm mb-2 flex items-center gap-2">
    <span>{label}</span>
    {state?.stage && <span className="text-eve-dim">stage: {state.stage}</span>}
    {state?.active && <span className="text-eve-dim">elapsed: {elapsedSec}s</span>}
    {state?.active && <button className="px-2 py-0.5 border border-eve-border rounded" onClick={onCancel}>Cancel Scan</button>}
    {allowStartAnyway && onStartAnyway && <button className="px-2 py-0.5 border border-eve-border rounded" title="Cancels the active scan before starting a new one." onClick={onStartAnyway}>Cancel and Start New</button>}
  </div>;
}
