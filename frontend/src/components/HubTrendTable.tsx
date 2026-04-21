import type { RegionalHubTrend } from "@/lib/types";
import { formatISK } from "@/lib/format";
import { EmptyState } from "./EmptyState";

interface Props {
  trends: RegionalHubTrend[];
  scanning: boolean;
  progress: string;
}

function formatSignedInt(value: number): string {
  if (value > 0) return `+${value.toLocaleString()}`;
  return value.toLocaleString();
}

function formatSignedISK(value: number): string {
  if (value > 0) return `+${formatISK(value)}`;
  return formatISK(value);
}

function formatSignedFloat(value: number): string {
  if (value > 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
}

export function HubTrendTable({ trends, scanning, progress }: Props) {
  if (scanning && trends.length === 0) {
    return <EmptyState reason="loading" hints={progress ? [progress] : []} />;
  }
  if (!scanning && trends.length === 0) {
    return <EmptyState reason="no_results" hints={["Run at least two regional scans to see hub trend deltas."]} />;
  }

  return (
    <div className="h-full min-h-0 overflow-auto">
      <table className="w-full text-[12px] font-mono table-fixed">
        <thead className="sticky top-0 z-10 bg-eve-dark/95 border-b border-eve-border text-eve-dim uppercase tracking-wider text-[10px]">
          <tr>
            <th className="text-left px-2 py-1.5 w-[180px]">Hub</th>
            <th className="text-left px-2 py-1.5 w-[170px]">Snapshot</th>
            <th className="text-right px-2 py-1.5 w-[90px]">Δ Items</th>
            <th className="text-right px-2 py-1.5 w-[120px]">Δ Period Profit</th>
            <th className="text-right px-2 py-1.5 w-[100px]">Δ Demand/day</th>
            <th className="text-left px-2 py-1.5">Top Item Changes</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((trend) => (
            <tr key={trend.source_system_id} className="border-b border-eve-border/30">
              <td className="px-2 py-1.5 text-eve-text">{trend.latest_snapshot.source_system_name}</td>
              <td className="px-2 py-1.5 text-eve-dim">{trend.latest_snapshot.scan_timestamp}</td>
              <td className="px-2 py-1.5 text-right">{formatSignedInt(trend.delta.item_count_delta)}</td>
              <td className="px-2 py-1.5 text-right">{formatSignedISK(trend.delta.target_period_profit_delta)}</td>
              <td className="px-2 py-1.5 text-right">{formatSignedFloat(trend.delta.demand_per_day_delta)}</td>
              <td className="px-2 py-1.5 text-eve-dim">
                {trend.delta.new_top_items.length === 0 && trend.delta.removed_top_items.length === 0
                  ? "No top-item changes"
                  : [
                      trend.delta.new_top_items.length > 0 ? `+ ${trend.delta.new_top_items.join(", ")}` : "",
                      trend.delta.removed_top_items.length > 0 ? `- ${trend.delta.removed_top_items.join(", ")}` : "",
                    ]
                      .filter(Boolean)
                      .join(" | ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
