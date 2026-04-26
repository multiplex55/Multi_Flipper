import { formatISK } from "@/lib/format";

export type RadiusRouteCompareRow = {
  routeKey: string;
  routeLabel: string;
  profit: number;
  capital: number;
  roi: number | null;
  cargoUsedPercent: number | null;
  jumps: number;
  iskPerJump: number;
  executionQuality: number;
  verification: string;
  queueStatus: string;
  assignedPilot: string;
};

type Props = {
  rows: RadiusRouteCompareRow[];
  onRemove: (routeKey: string) => void;
  onClear: () => void;
};

function fmtPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function RadiusRouteCompareDrawer({ rows, onRemove, onClear }: Props) {
  return (
    <div className="mb-2 rounded-sm border border-eve-border/70 bg-eve-dark/40 p-2" data-testid="radius-route-compare-drawer">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-eve-dim">Route Compare ({rows.length}/4)</div>
        {rows.length > 0 && <button type="button" onClick={onClear} className="text-[11px] text-eve-dim">Clear</button>}
      </div>
      {rows.length === 0 ? (
        <div className="text-[11px] text-eve-dim">Use row menu: “Add route to compare” (up to 4 routes).</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="text-eve-dim"><th className="text-left">Route</th><th>Profit</th><th>Capital</th><th>ROI</th><th>Cargo</th><th>Jumps</th><th>ISK/Jump</th><th>Exec</th><th>Verify</th><th>Queue</th><th>Pilot</th><th/></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.routeKey}>
                  <td>{row.routeLabel}</td><td>{formatISK(row.profit)}</td><td>{formatISK(row.capital)}</td><td>{fmtPct(row.roi)}</td><td>{fmtPct(row.cargoUsedPercent)}</td><td>{row.jumps}</td><td>{formatISK(row.iskPerJump)}</td><td>{row.executionQuality.toFixed(0)}</td><td>{row.verification}</td><td>{row.queueStatus}</td><td>{row.assignedPilot || "—"}</td>
                  <td><button type="button" onClick={() => onRemove(row.routeKey)} aria-label={`Remove ${row.routeLabel}`}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
