import { formatISK, formatMargin, formatNumber } from "@/lib/format";
import type { DiffTimelineResponse } from "@/lib/types";

interface DiffTimelineProps {
  timeline: DiffTimelineResponse | null;
  loading?: boolean;
  error?: string | null;
}

function renderDelta(value?: number, formatter?: (n: number) => string) {
  if (value == null || !Number.isFinite(value)) return <span className="text-eve-dim">—</span>;
  const positive = value > 0;
  const cls = positive ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-eve-dim";
  const rendered = formatter ? formatter(value) : formatNumber(value);
  return <span className={cls}>{positive ? "+" : ""}{rendered}</span>;
}

export function DiffTimeline({ timeline, loading, error }: DiffTimelineProps) {
  if (loading) return <div className="text-xs text-eve-dim">Loading diff timeline…</div>;
  if (error) return <div className="text-xs text-rose-400">{error}</div>;
  if (!timeline || timeline.items.length === 0) return <div className="text-xs text-eve-dim">No diff timeline available.</div>;

  return (
    <div className="border border-eve-border rounded mt-3 overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-eve-panel">
          <tr>
            <th className="text-left px-2 py-1">Snapshot</th>
            <th className="text-left px-2 py-1">Buy/Sell</th>
            <th className="text-right px-2 py-1">Net Profit Δ</th>
            <th className="text-right px-2 py-1">Margin Δ</th>
            <th className="text-right px-2 py-1">Volume Δ</th>
            <th className="text-right px-2 py-1">Risk Δ</th>
            <th className="text-right px-2 py-1">Confidence Δ</th>
            <th className="text-left px-2 py-1">Drivers</th>
          </tr>
        </thead>
        <tbody>
          {timeline.items.map((item) => (
            <tr key={item.timeline_key} className="border-t border-eve-border/40 align-top">
              <td className="px-2 py-1.5">
                <div>{item.label}</div>
                <div className="text-eve-dim">{new Date(item.timestamp).toLocaleString()}</div>
              </td>
              <td className="px-2 py-1.5">
                <div>{item.fields.buy ?? "—"}</div>
                <div className="text-eve-dim">→ {item.fields.sell ?? "—"}</div>
              </td>
              <td className="px-2 py-1.5 text-right">{renderDelta(item.delta.net_profit, formatISK)}</td>
              <td className="px-2 py-1.5 text-right">{renderDelta(item.delta.margin, formatMargin)}</td>
              <td className="px-2 py-1.5 text-right">{renderDelta(item.delta.daily_volume, formatNumber)}</td>
              <td className="px-2 py-1.5 text-right">{renderDelta(item.delta.route_risk, formatNumber)}</td>
              <td className="px-2 py-1.5 text-right">{renderDelta(item.delta.confidence_proxy, formatNumber)}</td>
              <td className="px-2 py-1.5">
                <details>
                  <summary className="cursor-pointer text-eve-dim">Details</summary>
                  <ul className="mt-1 space-y-0.5">
                    {(item.drivers ?? []).map((driver) => (
                      <li key={`${item.timeline_key}:${driver.key}`}>
                        <span className="text-eve-dim">{driver.label}:</span> {driver.after ?? "—"}
                      </li>
                    ))}
                  </ul>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
