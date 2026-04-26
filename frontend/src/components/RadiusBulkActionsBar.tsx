import type { FlipResult } from "@/lib/types";

type Props = {
  selectedRows: FlipResult[];
  selectedRouteKeys: string[];
  onClear: () => void;
  onVerifyRoutes: () => void;
  onQueueRoutes: () => void;
  onAssignRoutes: () => void;
  onHideRows: () => void;
  onTrackRows: () => void;
  onExportRows: () => void;
  onCopyRows: () => void;
};

export function RadiusBulkActionsBar({
  selectedRows,
  selectedRouteKeys,
  onClear,
  onVerifyRoutes,
  onQueueRoutes,
  onAssignRoutes,
  onHideRows,
  onTrackRows,
  onExportRows,
  onCopyRows,
}: Props) {
  if (selectedRows.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1 rounded-sm border border-eve-accent/50 bg-eve-accent/10 p-2 text-[11px]" data-testid="radius-bulk-actions-bar">
      <span className="mr-1 font-semibold text-eve-accent">
        {selectedRows.length} rows · {selectedRouteKeys.length} routes
      </span>
      <button type="button" onClick={onVerifyRoutes} className="rounded-sm border border-purple-500/60 px-1.5 py-0.5 text-purple-200">Verify</button>
      <button type="button" onClick={onQueueRoutes} className="rounded-sm border border-blue-500/60 px-1.5 py-0.5 text-blue-200">Queue</button>
      <button type="button" onClick={onAssignRoutes} className="rounded-sm border border-indigo-500/60 px-1.5 py-0.5 text-indigo-200">Assign</button>
      <button type="button" onClick={onHideRows} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim">Hide</button>
      <button type="button" onClick={onTrackRows} className="rounded-sm border border-emerald-500/60 px-1.5 py-0.5 text-emerald-200">Track</button>
      <button type="button" onClick={onExportRows} className="rounded-sm border border-cyan-500/60 px-1.5 py-0.5 text-cyan-200">Export</button>
      <button type="button" onClick={onCopyRows} className="rounded-sm border border-fuchsia-500/60 px-1.5 py-0.5 text-fuchsia-200">Copy</button>
      <button type="button" onClick={onClear} className="ml-auto rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim">Clear</button>
    </div>
  );
}
