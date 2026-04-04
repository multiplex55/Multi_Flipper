import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listPinnedOpportunities,
  listPinnedOpportunitySnapshots,
  subscribePinnedOpportunityChanges,
} from "@/lib/api";
import { formatISK, formatMargin, formatNumber } from "@/lib/format";
import type { PinnedOpportunityRecord, PinnedOpportunitySnapshotRecord } from "@/lib/types";
import { TrendIndicator } from "@/components/TrendIndicator";

type CompareMode = "last_scan" | "h24" | "custom";

function getModeFromURL(): CompareMode {
  const raw = new URLSearchParams(window.location.search).get("pinned_compare");
  if (raw === "last_scan" || raw === "h24" || raw === "custom") return raw;
  return "last_scan";
}

export function PinnedOpportunitiesTab() {
  const [rows, setRows] = useState<PinnedOpportunityRecord[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, PinnedOpportunitySnapshotRecord[]>>({});
  const [compareMode, setCompareMode] = useState<CompareMode>(getModeFromURL);
  const [customLabel, setCustomLabel] = useState("");
  const reloadPinnedRows = useCallback(async () => {
    const items = await listPinnedOpportunities();
    setRows(items);
    const byKey = await Promise.all(
      items.map(async (item) => [item.opportunity_key, await listPinnedOpportunitySnapshots(item.opportunity_key, 100)] as const),
    );
    setSnapshots(Object.fromEntries(byKey));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("pinned_compare", compareMode);
    if (compareMode === "custom" && customLabel) params.set("pinned_snapshot", customLabel);
    else params.delete("pinned_snapshot");
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, [compareMode, customLabel]);

  useEffect(() => {
    void reloadPinnedRows();
    return subscribePinnedOpportunityChanges((detail) => {
      if (import.meta.env.DEV) {
        console.debug("[PinnedOpportunitiesTab] pin change received", detail);
      }
      void reloadPinnedRows();
    });
  }, [reloadPinnedRows]);

  const customOptions = useMemo(() => {
    const all = Object.values(snapshots).flat();
    const unique = new Map<string, string>();
    for (const snap of all) {
      if (!unique.has(snap.snapshot_label)) unique.set(snap.snapshot_label, snap.snapshot_at);
    }
    return [...unique.entries()].sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime());
  }, [snapshots]);

  useEffect(() => {
    const fromURL = new URLSearchParams(window.location.search).get("pinned_snapshot") ?? "";
    if (fromURL) setCustomLabel(fromURL);
    else if (!customLabel && customOptions.length > 0) setCustomLabel(customOptions[0][0]);
  }, [customOptions]);

  const rowsWithDelta = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return rows.map((row) => {
      const current = row.payload?.metrics;
      const list = snapshots[row.opportunity_key] ?? [];
      const baseline =
        compareMode === "last_scan"
          ? list.find((snap) => snap.snapshot_label.startsWith("scan:"))
          : compareMode === "h24"
            ? [...list].sort((a, b) => Math.abs(new Date(a.snapshot_at).getTime() - dayAgo) - Math.abs(new Date(b.snapshot_at).getTime() - dayAgo))[0]
            : list.find((snap) => snap.snapshot_label === customLabel);
      const base = baseline?.metrics;
      const deltaProfit = current && base ? current.profit - base.profit : null;
      const deltaMargin = current && base ? current.margin - base.margin : null;
      const deltaVolume = current && base ? current.volume - base.volume : null;
      const deltaRisk = current && base ? current.route_risk - base.route_risk : null;
      return { row, baseline, deltaProfit, deltaMargin, deltaVolume, deltaRisk };
    });
  }, [rows, snapshots, compareMode, customLabel]);

  return (
    <div className="flex-1 min-h-0 overflow-auto text-xs">
      <div className="px-2 py-2 border-b border-eve-border flex items-center gap-2">
        <span className="text-eve-dim">Compare to</span>
        <select value={compareMode} onChange={(e) => setCompareMode(e.target.value as CompareMode)} className="bg-eve-input border border-eve-border rounded px-2 py-1">
          <option value="last_scan">Last scan</option>
          <option value="h24">24h</option>
          <option value="custom">Custom snapshot</option>
        </select>
        {compareMode === "custom" && (
          <select value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} className="bg-eve-input border border-eve-border rounded px-2 py-1">
            {customOptions.map(([label, at]) => (
              <option value={label} key={label}>{label} · {new Date(at).toLocaleString()}</option>
            ))}
          </select>
        )}
      </div>
      <table className="w-full">
        <thead className="sticky top-0 bg-eve-panel border-b border-eve-border">
          <tr className="text-eve-dim">
            <th className="text-left px-2 py-1">Opportunity</th>
            <th className="text-right px-2 py-1">Profit</th>
            <th className="text-right px-2 py-1">Margin</th>
            <th className="text-right px-2 py-1">Volume</th>
            <th className="text-right px-2 py-1">Route risk</th>
            <th className="text-left px-2 py-1">Baseline</th>
          </tr>
        </thead>
        <tbody>
          {rowsWithDelta.map(({ row, baseline, deltaProfit, deltaMargin, deltaVolume, deltaRisk }) => {
            const current = row.payload?.metrics;
            const profitPct = current && baseline?.metrics && baseline.metrics.profit !== 0 ? ((current.profit - baseline.metrics.profit) / Math.abs(baseline.metrics.profit)) * 100 : null;
            const marginPct = current && baseline?.metrics && baseline.metrics.margin !== 0 ? ((current.margin - baseline.metrics.margin) / Math.abs(baseline.metrics.margin)) * 100 : null;
            return (
              <tr key={row.opportunity_key} className="border-b border-eve-border/40">
                <td className="px-2 py-1.5">
                  <div className="font-mono">{row.opportunity_key}</div>
                </td>
                <td className="px-2 py-1.5 text-right"><div>{formatISK(current?.profit ?? 0)}</div><TrendIndicator delta={deltaProfit} percentDelta={profitPct} metric="isk" /></td>
                <td className="px-2 py-1.5 text-right"><div>{formatMargin(current?.margin ?? 0)}</div><TrendIndicator delta={deltaMargin} percentDelta={marginPct} metric="margin" /></td>
                <td className="px-2 py-1.5 text-right"><div>{formatNumber(current?.volume ?? 0)}</div><TrendIndicator delta={deltaVolume} metric="number" /></td>
                <td className="px-2 py-1.5 text-right"><div>{formatNumber(current?.route_risk ?? 0)}</div><TrendIndicator delta={deltaRisk} metric="number" /></td>
                <td className="px-2 py-1.5 text-eve-dim">{baseline ? `${baseline.snapshot_label} · ${new Date(baseline.snapshot_at).toLocaleString()}` : "No baseline"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
