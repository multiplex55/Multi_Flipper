import { useMemo, useState } from "react";
import type { FlipResult } from "@/lib/types";
import type { RadiusDealMovement } from "@/lib/radiusDealMovement";
import { buildIskPerJumpHistogram, buildScatterSeries, movementColor } from "@/lib/radiusAnalytics";

type Props = {
  rows: FlipResult[];
  movementByKey: Map<string, RadiusDealMovement>;
  onApplyProfitPerJumpBin: (bin: string | null) => void;
  rolloutStage?: 1 | 2 | 3 | 4;
};

export function RadiusAnalyticsPanel({ rows, movementByKey, onApplyProfitPerJumpBin, rolloutStage = 4 }: Props) {
  const [metric, setMetric] = useState<"profit" | "count">("profit");
  const histogram = useMemo(() => buildIskPerJumpHistogram(rows), [rows]);
  const scatter = useMemo(() => buildScatterSeries(rows, movementByKey), [rows, movementByKey]);
  const heatmap = useMemo(() => {
    const m = new Map<string, { count: number; profit: number }>();
    for (const row of rows) {
      const k = `${row.BuyStation}→${row.SellStation}`;
      const e = m.get(k) ?? { count: 0, profit: 0 };
      e.count += 1; e.profit += Number(row.RealProfit ?? row.TotalProfit ?? 0);
      m.set(k, e);
    }
    return [...m.entries()].slice(0, 20);
  }, [rows]);

  return <section className="rounded border border-slate-700 p-2 text-xs">
    <div className="mb-2 font-semibold">Radius Analytics</div>
    <div className="mb-2">Histogram (ISK/jump)</div>
    <div className="grid grid-cols-5 gap-1 mb-3">{Object.entries(histogram).map(([k,v]) => (
      <button key={k} className="rounded border border-slate-700 px-1 py-1 text-left" onClick={() => onApplyProfitPerJumpBin(k)}>
        <div>{k}</div><div>{v}</div>
      </button>
    ))}</div>
    {rolloutStage >= 2 && <div className="mb-3"><div className="mb-1">Scatterplot (preview)</div>
      <div className="max-h-40 overflow-auto border border-slate-800 p-1">{scatter.slice(0, 40).map((p) => <div key={p.rowKey} title={`${p.item} | ${p.route} | ${p.realProfit}`} style={{color: movementColor(p.movement)}}>{p.item} · {Math.round(p.turnoverDays)}d · {Math.round(p.realProfit/1000)}k</div>)}</div>
    </div>}
    {rolloutStage >= 3 && <div className="mb-3">Pinned trends: uses pinned snapshot identity keys (data contract ready).</div>}
    {rolloutStage >= 4 && <div><div className="mb-1">Heatmap (top routes)</div>
      <button className="mr-2 rounded border px-1" onClick={() => setMetric("profit")}>profit</button><button className="rounded border px-1" onClick={() => setMetric("count")}>count</button>
      <div className="max-h-32 overflow-auto">{heatmap.map(([k,v]) => <div key={k}>{k}: {metric === "profit" ? Math.round(v.profit) : v.count}</div>)}</div></div>}
  </section>;
}
