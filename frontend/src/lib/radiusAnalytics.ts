import { turnoverDays } from "@/lib/radiusMetrics";
import { buildRadiusDealSnapshotKey, type RadiusDealMovementLabel } from "@/lib/radiusDealMovement";
import type { FlipResult, PinnedOpportunitySnapshotRecord } from "@/lib/types";

export type AnalyticsScatterPoint = {
  rowKey: string;
  item: string;
  route: string;
  turnoverDays: number;
  realProfit: number;
  cargoM3: number;
  movement: RadiusDealMovementLabel | "unknown";
};

export type IskPerJumpBinKey = "0-100k" | "100k-250k" | "250k-500k" | "500k-1m" | "1m+";

export function iskPerJumpBin(value: number): IskPerJumpBinKey {
  if (value < 100_000) return "0-100k";
  if (value < 250_000) return "100k-250k";
  if (value < 500_000) return "250k-500k";
  if (value < 1_000_000) return "500k-1m";
  return "1m+";
}

export function buildIskPerJumpHistogram(rows: FlipResult[]): Record<IskPerJumpBinKey, number> {
  const bins: Record<IskPerJumpBinKey, number> = { "0-100k": 0, "100k-250k": 0, "250k-500k": 0, "500k-1m": 0, "1m+": 0 };
  for (const row of rows) bins[iskPerJumpBin(Number(row.ProfitPerJump ?? 0))] += 1;
  return bins;
}

export function movementColor(label: RadiusDealMovementLabel | "unknown"): string {
  switch (label) {
    case "new": return "#22c55e";
    case "improving": return "#14b8a6";
    case "stable": return "#60a5fa";
    case "worse": return "#f59e0b";
    case "collapsing": return "#ef4444";
    case "disappeared": return "#9ca3af";
    default: return "#a78bfa";
  }
}

export function buildScatterSeries(rows: FlipResult[], movementByKey: Map<string, { label: RadiusDealMovementLabel }>): AnalyticsScatterPoint[] {
  return rows.map((row) => {
    const key = buildRadiusDealSnapshotKey(row);
    return {
      rowKey: key,
      item: row.TypeName,
      route: `${row.BuySystemName} → ${row.SellSystemName}`,
      turnoverDays: Number(turnoverDays(row) ?? 0),
      realProfit: Number(row.RealProfit ?? row.ExpectedProfit ?? row.TotalProfit ?? 0),
      cargoM3: Math.max(0, Number(row.Volume ?? 0) * Math.max(0, Number(row.UnitsToBuy ?? 0))),
      movement: movementByKey.get(key)?.label ?? "unknown",
    };
  });
}

export function buildPinnedTrendSeries(snapshotsByKey: Record<string, PinnedOpportunitySnapshotRecord[]>): Record<string, Array<{ at: string; profit: number; quantity: number; executionQuality: number; risk: number }>> {
  const out: Record<string, Array<{ at: string; profit: number; quantity: number; executionQuality: number; risk: number }>> = {};
  for (const [key, snapshots] of Object.entries(snapshotsByKey)) {
    out[key] = snapshots
      .slice()
      .sort((a, b) => String(a.snapshot_at).localeCompare(String(b.snapshot_at)))
      .map((s) => ({
        at: s.snapshot_at,
        profit: Number(s.metrics?.profit ?? 0),
        quantity: Number(s.metrics?.volume ?? 0),
        executionQuality: Number(s.metrics?.margin ?? 0),
        risk: Number(s.metrics?.route_risk ?? 0),
      }));
  }
  return out;
}
