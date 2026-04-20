import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { formatISK } from "@/lib/format";
import type { RegionalBuyHubSummary } from "@/lib/types";

type SortKey = "source" | "items" | "capital" | "period_profit" | "avg_jumps";
type SortDirection = "asc" | "desc";

interface Props {
  hubs: RegionalBuyHubSummary[];
  scanning: boolean;
  progress: string;
  sourceLockSystemID?: number | null;
  onOpenItemsAtHub?: (hub: RegionalBuyHubSummary) => void;
  onSetSourceLock?: (hub: RegionalBuyHubSummary) => void;
  onCopySummary?: (hub: RegionalBuyHubSummary) => void;
}

function sortValue(hub: RegionalBuyHubSummary, key: SortKey): number | string {
  switch (key) {
    case "source": return hub.source_system_name;
    case "items": return hub.item_count;
    case "capital": return hub.capital_required;
    case "period_profit": return hub.target_period_profit;
    case "avg_jumps": return hub.avg_jumps;
    default: return 0;
  }
}

function compare(a: number | string, b: number | string, dir: SortDirection): number {
  if (typeof a === "string" && typeof b === "string") {
    return dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
  }
  return dir === "asc" ? (a as number) - (b as number) : (b as number) - (a as number);
}

export function RegionalBuyHubTable({
  hubs,
  scanning,
  progress,
  sourceLockSystemID,
  onOpenItemsAtHub,
  onSetSourceLock,
  onCopySummary,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("period_profit");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sorted = useMemo(
    () => [...hubs].sort((a, b) => compare(sortValue(a, sortKey), sortValue(b, sortKey), sortDirection)),
    [hubs, sortDirection, sortKey],
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  if (hubs.length === 0 && !scanning) {
    return <EmptyState reason="no_results" hints={["No buy hubs yet. Run a regional scan."]} />;
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full text-xs font-mono text-eve-text">
        <thead className="sticky top-0 z-10 bg-eve-panel/95 border-b border-eve-border">
          <tr>
            <th className="text-left px-2 py-1"><button type="button" onClick={() => toggleSort("source")}>Buy hub</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("items")}>Items</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("capital")}>Capital</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("period_profit")}>Period Profit</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("avg_jumps")}>Avg Jumps</button></th>
            <th className="text-left px-2 py-1">Top destinations</th>
            <th className="text-left px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((hub) => {
            const topDestinations = hub.top_destinations
              .map((destination) => `${destination.target_system_name} (${formatISK(destination.target_period_profit)})`)
              .join(", ");
            const lockActive = sourceLockSystemID === hub.source_system_id;
            return (
              <tr key={hub.source_system_id} className="border-b border-eve-border/40 hover:bg-eve-dark/20">
                <td className="px-2 py-1">
                  {hub.source_system_name}
                  <span className="text-eve-dim"> · {hub.source_region_name}</span>
                </td>
                <td className="px-2 py-1 text-right">{hub.item_count.toLocaleString()}</td>
                <td className="px-2 py-1 text-right">{formatISK(hub.capital_required)}</td>
                <td className="px-2 py-1 text-right text-emerald-300">{formatISK(hub.target_period_profit)}</td>
                <td className="px-2 py-1 text-right">{hub.avg_jumps.toFixed(2)}</td>
                <td className="px-2 py-1 text-eve-dim">{topDestinations || "-"}</td>
                <td className="px-2 py-1">
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="text-[10px] px-1 rounded border border-eve-border/50" onClick={() => onOpenItemsAtHub?.(hub)}>Open rows</button>
                    <button type="button" className={`text-[10px] px-1 rounded border ${lockActive ? "border-eve-accent text-eve-accent" : "border-eve-border/50"}`} onClick={() => onSetSourceLock?.(hub)}>Set lock</button>
                    <button type="button" className="text-[10px] px-1 rounded border border-eve-border/50" onClick={() => onCopySummary?.(hub)}>Copy summary</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {scanning && <div className="px-3 py-2 text-xs text-eve-dim">{progress || "Scanning buy hubs..."}</div>}
    </div>
  );
}
