import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listPinnedOpportunities,
  listPinnedOpportunitySnapshots,
  openMarketInGame,
  removePinnedOpportunity,
  setWaypointInGame,
  subscribePinnedOpportunityChanges,
} from "@/lib/api";
import { formatISK, formatMargin, formatNumber } from "@/lib/format";
import type { PinnedOpportunityRecord, PinnedOpportunitySnapshotRecord } from "@/lib/types";
import { TrendIndicator } from "@/components/TrendIndicator";
import { getPinnedOpportunityLabels } from "@/lib/pinnedOpportunityLabels";
import { ContractDetailsPopup } from "@/components/ContractDetailsPopup";
import { Modal } from "@/components/Modal";

type CompareMode = "last_scan" | "h24" | "custom";
type SortField = "profit" | "margin" | "volume" | "risk" | "updated";
type SortDir = "asc" | "desc";

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
  const [selected, setSelected] = useState<PinnedOpportunityRecord | null>(null);
  const [sortField, setSortField] = useState<SortField>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

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
    return subscribePinnedOpportunityChanges(() => {
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
  }, [customOptions, customLabel]);

  const rowsWithDelta = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return rows.map((row) => {
      const current = row.payload?.metrics;
      const labels = getPinnedOpportunityLabels(row);
      const list = snapshots[row.opportunity_key] ?? [];
      const baseline =
        compareMode === "last_scan"
          ? list.find((snap) => snap.snapshot_label.startsWith("scan:"))
          : compareMode === "h24"
            ? [...list].sort((a, b) => Math.abs(new Date(a.snapshot_at).getTime() - dayAgo) - Math.abs(new Date(b.snapshot_at).getTime() - dayAgo))[0]
            : list.find((snap) => snap.snapshot_label === customLabel);
      const base = baseline?.metrics;
      return {
        row,
        labels,
        baseline,
        deltaProfit: current && base ? current.profit - base.profit : null,
        deltaMargin: current && base ? current.margin - base.margin : null,
        deltaVolume: current && base ? current.volume - base.volume : null,
        deltaRisk: current && base ? current.route_risk - base.route_risk : null,
      };
    })
      .filter((entry) => sourceFilter === "all" || entry.row.payload?.source === sourceFilter)
      .filter((entry) => entry.labels.itemLabel.toLowerCase().includes(itemFilter.toLowerCase().trim()))
      .filter((entry) => {
        const q = locationFilter.toLowerCase().trim();
        if (!q) return true;
        return entry.labels.buyLabel.toLowerCase().includes(q) || entry.labels.sellLabel.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aMetrics = a.row.payload?.metrics;
        const bMetrics = b.row.payload?.metrics;
        const n = (v: number | undefined) => v ?? 0;
        const diff =
          sortField === "profit"
            ? n(aMetrics?.profit) - n(bMetrics?.profit)
            : sortField === "margin"
              ? n(aMetrics?.margin) - n(bMetrics?.margin)
              : sortField === "volume"
                ? n(aMetrics?.volume) - n(bMetrics?.volume)
                : sortField === "risk"
                  ? n(aMetrics?.route_risk) - n(bMetrics?.route_risk)
                  : new Date(a.row.updated_at).getTime() - new Date(b.row.updated_at).getTime();
        return sortDir === "asc" ? diff : -diff;
      });
  }, [rows, snapshots, compareMode, customLabel, sourceFilter, itemFilter, locationFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("desc");
      return;
    }
    setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto text-xs">
      <div className="px-2 py-2 border-b border-eve-border flex flex-wrap items-center gap-2">
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
        <select aria-label="Filter by source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="bg-eve-input border border-eve-border rounded px-2 py-1">
          <option value="all">All sources</option>
          <option value="scan">Scan</option>
          <option value="station">Station</option>
          <option value="regional_day">Regional</option>
          <option value="contracts">Contracts</option>
        </select>
        <input aria-label="Filter by item" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} placeholder="Filter item" className="bg-eve-input border border-eve-border rounded px-2 py-1" />
        <input aria-label="Filter by location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="Filter location" className="bg-eve-input border border-eve-border rounded px-2 py-1" />
      </div>
      <table className="w-full">
        <thead className="sticky top-0 bg-eve-panel border-b border-eve-border">
          <tr className="text-eve-dim">
            <th className="text-left px-2 py-1">Opportunity</th>
            <th className="text-left px-2 py-1">Source</th>
            <th className="text-left px-2 py-1">Buy</th>
            <th className="text-left px-2 py-1">Sell</th>
            <th className="text-right px-2 py-1"><button onClick={() => toggleSort("profit")}>Profit</button></th>
            <th className="text-right px-2 py-1"><button onClick={() => toggleSort("margin")}>Margin</button></th>
            <th className="text-right px-2 py-1"><button onClick={() => toggleSort("volume")}>Volume</button></th>
            <th className="text-right px-2 py-1"><button onClick={() => toggleSort("risk")}>Risk</button></th>
            <th className="text-right px-2 py-1"><button onClick={() => toggleSort("updated")}>Updated</button></th>
            <th className="text-left px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rowsWithDelta.map(({ row, labels, baseline, deltaProfit, deltaMargin, deltaVolume, deltaRisk }) => {
            const current = row.payload?.metrics;
            const contractDisabled = !row.payload?.contract_id;
            const marketDisabled = !row.payload?.type_id;
            const waypointID = row.payload?.buy_system_id ?? row.payload?.system_id;
            return (
              <tr
                key={row.opportunity_key}
                className="border-b border-eve-border/40 focus-within:bg-eve-hover hover:bg-eve-hover"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(row);
                  }
                }}
                onClick={() => setSelected(row)}
              >
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    {row.payload?.type_id ? <img src={`https://images.evetech.net/types/${row.payload.type_id}/icon?size=32`} alt="" className="w-4 h-4" /> : null}
                    <div>{labels.itemLabel}</div>
                  </div>
                </td>
                <td className="px-2 py-1.5"><span className="px-1.5 py-0.5 border border-eve-border rounded">{labels.sourceLabel}</span></td>
                <td className="px-2 py-1.5">{labels.buyLabel}</td>
                <td className="px-2 py-1.5">{labels.sellLabel}</td>
                <td className="px-2 py-1.5 text-right"><div className={current && current.profit >= 0 ? "text-emerald-400" : "text-rose-400"} title={String(current?.profit ?? 0)}>{formatISK(current?.profit ?? 0)}</div><TrendIndicator delta={deltaProfit} metric="isk" /></td>
                <td className="px-2 py-1.5 text-right"><div title={String(current?.margin ?? 0)}>{formatMargin(current?.margin ?? 0)}</div><TrendIndicator delta={deltaMargin} metric="margin" /></td>
                <td className="px-2 py-1.5 text-right"><div title={String(current?.volume ?? 0)}>{formatNumber(current?.volume ?? 0)}</div><TrendIndicator delta={deltaVolume} metric="number" /></td>
                <td className="px-2 py-1.5 text-right"><div title={String(current?.route_risk ?? 0)}>{formatNumber(current?.route_risk ?? 0)}</div><TrendIndicator delta={deltaRisk} metric="number" /></td>
                <td className="px-2 py-1.5 text-right text-eve-dim">{new Date(row.updated_at).toLocaleString()}</td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button aria-label="View details" className="px-1 border border-eve-border rounded" onClick={() => setSelected(row)}>View</button>
                    <button aria-label="Open market" className="px-1 border border-eve-border rounded disabled:opacity-40" disabled={marketDisabled} title={marketDisabled ? "No item type for this row" : "Open market"} onClick={() => row.payload?.type_id && void openMarketInGame(row.payload.type_id)}>Open Market</button>
                    <button aria-label="Set waypoint" className="px-1 border border-eve-border rounded disabled:opacity-40" disabled={!waypointID} title={waypointID ? "Set waypoint" : "No system context for this row"} onClick={() => waypointID && void setWaypointInGame(waypointID)}>Set Waypoint</button>
                    <button aria-label="Unpin" className="px-1 border border-eve-border rounded" onClick={() => void removePinnedOpportunity(row.opportunity_key).then(reloadPinnedRows)}>Unpin</button>
                    <button aria-label="Copy identifier" className="px-1 border border-eve-border rounded" onClick={() => void navigator.clipboard?.writeText(row.opportunity_key)}>Copy ID</button>
                    <span className="text-eve-dim" title={baseline ? `${baseline.snapshot_label} · ${new Date(baseline.snapshot_at).toLocaleString()}` : "No baseline"}>ⓘ</span>
                    {contractDisabled ? null : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected?.payload?.source === "contracts" && selected.payload.contract_id ? (
        <ContractDetailsPopup
          open={!!selected}
          contractID={selected.payload.contract_id}
          contractTitle={selected.payload.type_name || selected.opportunity_key}
          contractPrice={0}
          contractMarketValue={selected.payload.metrics?.profit}
          contractProfit={selected.payload.metrics?.profit}
          pickupStationName={selected.payload.buy_station_name}
          pickupSystemName={selected.payload.buy_system_name}
          pickupRegionName={selected.payload.region_name}
          liquidationSystemName={selected.payload.sell_system_name}
          liquidationRegionName={selected.payload.region_name}
          liquidationJumps={selected.payload.metrics?.route_risk}
          onClose={() => setSelected(null)}
        />
      ) : (
        <Modal open={!!selected} onClose={() => setSelected(null)} title="Pinned Opportunity Details">
          <div className="p-4 text-sm space-y-2">
            <div><span className="text-eve-dim">Item:</span> {selected ? getPinnedOpportunityLabels(selected).itemLabel : ""}</div>
            <div><span className="text-eve-dim">Buy:</span> {selected ? getPinnedOpportunityLabels(selected).buyLabel : ""}</div>
            <div><span className="text-eve-dim">Sell:</span> {selected ? getPinnedOpportunityLabels(selected).sellLabel : ""}</div>
            <div><span className="text-eve-dim">Hidden ID:</span> <span className="font-mono">{selected?.opportunity_key}</span></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
