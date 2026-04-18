import type { FlipResult } from "@/lib/types";

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function locationSegment(
  locationId: number | undefined,
  systemName: string | undefined,
  stationName: string | undefined,
  prefix: "buy" | "sell",
): string {
  const id = Math.trunc(locationId ?? 0);
  if (id > 0) return `${prefix}_loc:${id}`;
  const normalizedSystem = normalizeName(systemName);
  const normalizedStation = normalizeName(stationName);
  return `${prefix}_name:${normalizedSystem}|${normalizedStation}`;
}

export function getExactLegKey(row: FlipResult): string {
  const buy = locationSegment(
    row.BuyLocationID,
    row.BuySystemName,
    row.BuyStation,
    "buy",
  );
  const sell = locationSegment(
    row.SellLocationID,
    row.SellSystemName,
    row.SellStation,
    "sell",
  );
  return `${buy}->${sell}`;
}

export function getSameLegRows(anchor: FlipResult, rows: FlipResult[]): FlipResult[] {
  const key = getExactLegKey(anchor);
  return rows.filter((row) => getExactLegKey(row) === key);
}

function toNumber(value: number | undefined | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function fillableQty(row: FlipResult): number {
  const units = Math.max(0, toNumber(row.UnitsToBuy));
  const buyRemain = Math.max(0, toNumber(row.BuyOrderRemain));
  const sellRemain = Math.max(0, toNumber(row.SellOrderRemain));
  if (units <= 0) return 0;
  return Math.min(units, buyRemain || units, sellRemain || units);
}

function riskProxy(row: FlipResult): number {
  const slippage = Math.max(0, toNumber(row.SlippageBuyPct)) + Math.max(0, toNumber(row.SlippageSellPct));
  const unfilled = Math.max(0, toNumber(row.UnitsToBuy) - toNumber(row.FilledQty));
  return slippage + unfilled / Math.max(1, toNumber(row.UnitsToBuy));
}

export function rankSameLegRows(rows: FlipResult[]): FlipResult[] {
  return [...rows].sort((left, right) => {
    const realProfitDiff = toNumber(right.RealProfit) - toNumber(left.RealProfit);
    if (realProfitDiff !== 0) return realProfitDiff;

    const leftIpk = toNumber(left.RealProfit) / Math.max(1, toNumber(left.TotalJumps));
    const rightIpk = toNumber(right.RealProfit) / Math.max(1, toNumber(right.TotalJumps));
    const ipkDiff = rightIpk - leftIpk;
    if (ipkDiff !== 0) return ipkDiff;

    const fillableDiff = fillableQty(right) - fillableQty(left);
    if (fillableDiff !== 0) return fillableDiff;

    const riskDiff = riskProxy(left) - riskProxy(right);
    if (riskDiff !== 0) return riskDiff;

    return (left.TypeName ?? "").localeCompare(right.TypeName ?? "");
  });
}
