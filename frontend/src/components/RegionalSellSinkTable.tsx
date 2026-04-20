import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { formatISK } from "@/lib/format";
import type { RegionalSellSinkSummary } from "@/lib/types";

type SortKey = "target" | "items" | "capital" | "period_profit" | "avg_jumps";
type SortDirection = "asc" | "desc";

interface Props {
  sinks: RegionalSellSinkSummary[];
  scanning: boolean;
  progress: string;
  onOpenItemsAtSink?: (sink: RegionalSellSinkSummary) => void;
  onSetSourceLockFromSink?: (sink: RegionalSellSinkSummary) => void;
  onCopySummary?: (sink: RegionalSellSinkSummary) => void;
}

function sortValue(sink: RegionalSellSinkSummary, key: SortKey): number | string {
  switch (key) {
    case "target": return sink.target_system_name;
    case "items": return sink.item_count;
    case "capital": return sink.capital_required;
    case "period_profit": return sink.target_period_profit;
    case "avg_jumps": return sink.avg_jumps;
    default: return 0;
  }
}

function compare(a: number | string, b: number | string, dir: SortDirection): number {
  if (typeof a === "string" && typeof b === "string") {
    return dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
  }
  return dir === "asc" ? (a as number) - (b as number) : (b as number) - (a as number);
}

export function RegionalSellSinkTable({
  sinks,
  scanning,
  progress,
  onOpenItemsAtSink,
  onSetSourceLockFromSink,
  onCopySummary,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("period_profit");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sorted = useMemo(
    () => [...sinks].sort((a, b) => compare(sortValue(a, sortKey), sortValue(b, sortKey), sortDirection)),
    [sinks, sortDirection, sortKey],
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  if (sinks.length === 0 && !scanning) {
    return <EmptyState reason="no_results" hints={["No sell sinks yet. Run a regional scan."]} />;
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full text-xs font-mono text-eve-text">
        <thead className="sticky top-0 z-10 bg-eve-panel/95 border-b border-eve-border">
          <tr>
            <th className="text-left px-2 py-1"><button type="button" onClick={() => toggleSort("target")}>Sell sink</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("items")}>Items</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("capital")}>Capital</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("period_profit")}>Period Profit</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("avg_jumps")}>Avg Jumps</button></th>
            <th className="text-left px-2 py-1">Top sources</th>
            <th className="text-left px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((sink) => {
            const topSources = sink.top_sources
              .map((source) => `${source.source_system_name} (${formatISK(source.target_period_profit)})`)
              .join(", ");
            return (
              <tr key={sink.target_system_id} className="border-b border-eve-border/40 hover:bg-eve-dark/20">
                <td className="px-2 py-1">{sink.target_system_name}<span className="text-eve-dim"> · {sink.target_region_name}</span></td>
                <td className="px-2 py-1 text-right">{sink.item_count.toLocaleString()}</td>
                <td className="px-2 py-1 text-right">{formatISK(sink.capital_required)}</td>
                <td className="px-2 py-1 text-right text-emerald-300">{formatISK(sink.target_period_profit)}</td>
                <td className="px-2 py-1 text-right">{sink.avg_jumps.toFixed(2)}</td>
                <td className="px-2 py-1 text-eve-dim">{topSources || "-"}</td>
                <td className="px-2 py-1">
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="text-[10px] px-1 rounded border border-eve-border/50" onClick={() => onOpenItemsAtSink?.(sink)}>Open rows</button>
                    <button type="button" className="text-[10px] px-1 rounded border border-eve-border/50" onClick={() => onSetSourceLockFromSink?.(sink)}>Set lock</button>
                    <button type="button" className="text-[10px] px-1 rounded border border-eve-border/50" onClick={() => onCopySummary?.(sink)}>Copy summary</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {scanning && <div className="px-3 py-2 text-xs text-eve-dim">{progress || "Scanning sell sinks..."}</div>}
    </div>
  );
}
