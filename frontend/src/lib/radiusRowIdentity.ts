import type { FlipResult } from "@/lib/types";

export function radiusRowKey(row: FlipResult): string {
  return [
    row.TypeID ?? 0,
    row.BuyLocationID ?? row.BuySystemID ?? 0,
    row.SellLocationID ?? row.SellSystemID ?? 0,
    Number(row.BuyPrice ?? 0).toFixed(4),
    Number(row.SellPrice ?? 0).toFixed(4),
    row.UnitsToBuy ?? 0,
    Number(row.DayPeriodProfit ?? row.TotalProfit ?? row.ExpectedProfit ?? 0).toFixed(4),
  ].join(":");
}
