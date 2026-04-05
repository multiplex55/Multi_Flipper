import type { FlipResult } from "@/lib/types";
import { safeNumber } from "@/lib/batchMetrics";

export function safeJumps(totalJumps: unknown): number {
  return Math.max(1, safeNumber(totalJumps));
}

export function realIskPerJump(row: FlipResult): number {
  return safeNumber(row.RealProfit) / safeJumps(row.TotalJumps);
}

export function dailyIskPerJump(row: FlipResult): number {
  return safeNumber(row.DailyProfit) / safeJumps(row.TotalJumps);
}

export function realIskPerM3PerJump(row: FlipResult): number {
  const filledQty = safeNumber(row.FilledQty);
  const volume = safeNumber(row.Volume);
  if (filledQty <= 0 || volume <= 0) return 0;
  const denom = filledQty * volume * safeJumps(row.TotalJumps);
  if (denom <= 0) return 0;
  return safeNumber(row.RealProfit) / denom;
}

export function capitalRequired(row: FlipResult): number {
  const direct = safeNumber(row.DayCapitalRequired);
  if (direct > 0) return direct;
  const qty = safeNumber(row.FilledQty);
  if (qty <= 0) return 0;
  const buy = safeNumber(row.ExpectedBuyPrice);
  if (buy > 0) return qty * buy;
  return qty * Math.max(0, safeNumber(row.BuyPrice));
}

export function turnoverDays(row: FlipResult): number | null {
  const daily = safeNumber(row.DailyProfit);
  if (daily <= 0) return null;
  const cap = capitalRequired(row);
  if (cap <= 0) return null;
  return cap / daily;
}

export function shownFillQty(row: FlipResult): number {
  const filled = safeNumber(row.FilledQty);
  if (filled > 0) return filled;
  return 0;
}

export function slippageCostIsk(row: FlipResult): number {
  const qty = shownFillQty(row);
  if (qty <= 0) return 0;

  const buyBase = safeNumber(row.BuyPrice);
  const buyExec = safeNumber(row.ExpectedBuyPrice);
  const buySlipPerUnit = buyExec > 0 && buyBase > 0 ? Math.max(0, buyExec - buyBase) : 0;

  const sellBase = safeNumber(row.SellPrice);
  const sellExec = safeNumber(row.ExpectedSellPrice);
  const sellSlipPerUnit =
    sellExec > 0 && sellBase > 0 ? Math.max(0, sellBase - sellExec) : 0;

  return qty * (buySlipPerUnit + sellSlipPerUnit);
}

export function radiusRouteKey(row: FlipResult): string {
  return [
    safeNumber(row.BuyLocationID) || safeNumber(row.BuySystemID),
    safeNumber(row.SellLocationID) || safeNumber(row.SellSystemID),
    row.BuyStation || row.BuySystemName || "",
    row.SellStation || row.SellSystemName || "",
  ].join(":");
}
