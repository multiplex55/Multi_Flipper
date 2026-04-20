import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { formatISK } from "@/lib/format";
import type { RegionalTradeCorridor } from "@/lib/types";

type SortKey =
  | "source"
  | "target"
  | "item_count"
  | "capital"
  | "period_profit"
  | "weighted_jumps"
  | "best_item";

type SortDirection = "asc" | "desc";

interface Props {
  corridors: RegionalTradeCorridor[];
  scanning: boolean;
  progress: string;
  onOpenLaneItems?: (corridor: RegionalTradeCorridor) => void;
  onOpenInRoute?: (corridor: RegionalTradeCorridor) => void;
  onCopySummary?: (corridor: RegionalTradeCorridor) => void;
}

function valueForSort(corridor: RegionalTradeCorridor, sortKey: SortKey): number | string {
  switch (sortKey) {
    case "source":
      return corridor.source_system_name;
    case "target":
      return corridor.target_system_name;
    case "item_count":
      return corridor.item_count;
    case "capital":
      return corridor.capital_required;
    case "period_profit":
      return corridor.target_period_profit;
    case "weighted_jumps":
      return corridor.weighted_jumps;
    case "best_item":
      return corridor.best_item_name;
    default:
      return 0;
  }
}

function compareValues(a: number | string, b: number | string, direction: SortDirection): number {
  if (typeof a === "string" && typeof b === "string") {
    return direction === "asc" ? a.localeCompare(b) : b.localeCompare(a);
  }
  return direction === "asc" ? (a as number) - (b as number) : (b as number) - (a as number);
}

export function RegionalCorridorTable({
  corridors,
  scanning,
  progress,
  onOpenLaneItems,
  onOpenInRoute,
  onCopySummary,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("period_profit");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedCorridors = useMemo(() => {
    return [...corridors].sort((a, b) => compareValues(valueForSort(a, sortKey), valueForSort(b, sortKey), sortDirection));
  }, [corridors, sortDirection, sortKey]);

  const toggleSort = (nextKey: SortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("desc");
  };

  if (corridors.length === 0 && !scanning) {
    return (
      <EmptyState
        reason="no_results"
        hints={["Run regional day trader scan to build source → destination lanes."]}
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full text-xs font-mono text-eve-text">
        <thead className="sticky top-0 z-10 bg-eve-panel/95 backdrop-blur border-b border-eve-border">
          <tr>
            <th className="text-left px-2 py-1"><button type="button" onClick={() => toggleSort("source")}>Source</button></th>
            <th className="text-left px-2 py-1"><button type="button" onClick={() => toggleSort("target")}>Target</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("item_count")}>Items</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("capital")}>Capital</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("period_profit")}>Period Profit</button></th>
            <th className="text-right px-2 py-1"><button type="button" onClick={() => toggleSort("weighted_jumps")}>Weighted Jumps</button></th>
            <th className="text-left px-2 py-1"><button type="button" onClick={() => toggleSort("best_item")}>Best Item</button></th>
            <th className="text-left px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedCorridors.map((corridor) => (
            <tr key={corridor.key} className="border-b border-eve-border/40 hover:bg-eve-dark/20">
              <td className="px-2 py-1">{corridor.source_system_name}</td>
              <td className="px-2 py-1">{corridor.target_system_name}</td>
              <td className="px-2 py-1 text-right">{corridor.item_count.toLocaleString()}</td>
              <td className="px-2 py-1 text-right">{formatISK(corridor.capital_required)}</td>
              <td className="px-2 py-1 text-right text-emerald-300">{formatISK(corridor.target_period_profit)}</td>
              <td className="px-2 py-1 text-right">{corridor.weighted_jumps.toFixed(2)}</td>
              <td className="px-2 py-1">
                <span className="text-eve-accent">{corridor.best_item_name}</span>
                <span className="text-eve-dim"> · {formatISK(corridor.best_item_period_profit)}</span>
              </td>
              <td className="px-2 py-1">
                <div className="flex flex-wrap items-center gap-1">
                  <button type="button" className="text-[10px] px-1 rounded border border-eve-border/50" onClick={() => onOpenLaneItems?.(corridor)}>Open lane items</button>
                  <button type="button" className="text-[10px] px-1 rounded border border-eve-border/50" onClick={() => onOpenInRoute?.(corridor)}>Open in Route</button>
                  <button type="button" className="text-[10px] px-1 rounded border border-eve-border/50" onClick={() => onCopySummary?.(corridor)}>Copy corridor summary</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {scanning && <div className="px-3 py-2 text-xs text-eve-dim">{progress || "Scanning corridors..."}</div>}
    </div>
  );
}
