import type { RadiusDistanceLensMetric } from "@/lib/api";
import type { FlipResult } from "@/lib/types";

export function radiusDistanceLensRowKey(row: Pick<FlipResult, "TypeID" | "BuySystemID" | "SellSystemID">): string {
  return `${row.TypeID}:${row.BuySystemID}:${row.SellSystemID}`;
}

export function applyDistanceLensToRow(
  row: FlipResult,
  metric?: RadiusDistanceLensMetric,
): FlipResult {
  if (!metric) return { ...row, DistanceLensApplied: false, DistanceLensUnreachable: false };
  return {
    ...row,
    DistanceLensApplied: true,
    DistanceLensUnreachable: Boolean(metric.unreachable),
    DistanceLensBaseBuyJumps: row.BuyJumps,
    DistanceLensBaseSellJumps: row.SellJumps,
    DistanceLensBaseTotalJumps: row.TotalJumps,
    DistanceLensBaseProfitPerJump: row.ProfitPerJump,
    DistanceLensBaseRealIskPerJump: row.RealProfit ?? row.ProfitPerJump,
    DistanceLensBaseDailyIskPerJump: row.DailyProfit ?? 0,
    BuyJumps: metric.buy_jumps,
    SellJumps: metric.sell_jumps,
    TotalJumps: metric.total_jumps,
    ProfitPerJump: metric.profit_per_jump,
    RealProfit: row.RealProfit,
    DailyProfit: row.DailyProfit,
  };
}
