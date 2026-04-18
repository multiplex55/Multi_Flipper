import type {
  SavedRoutePack,
  SavedRoutePackLineExecutionEntry,
  SavedRoutePackLineExecutionStatus,
} from "@/lib/types";

export interface SavedRouteExecutionSummary {
  realizedProfit: number;
  remainingExpectedProfit: number;
  remainingCapital: number;
  remainingVolume: number;
  unsoldInventoryValue: number;
  completedCount: number;
  skippedCount: number;
  completionPct: number;
  boughtPlannedRatio: number;
  soldBoughtRatio: number;
  totalLines: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const safeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toQty = (value: unknown): number => Math.max(0, Math.floor(safeNumber(value)));

const normalizeMoney = (value: unknown): number => Math.max(0, safeNumber(value));

function computeRemainingQty(line: SavedRoutePackLineExecutionEntry): number {
  return Math.max(0, line.plannedQty - line.soldQty);
}

function computeStatus(line: SavedRoutePackLineExecutionEntry): SavedRoutePackLineExecutionStatus {
  if (line.status === "skipped") return "skipped";
  if (line.soldQty >= line.plannedQty && line.plannedQty > 0) return "completed";
  if (line.soldQty > 0) return "partially_sold";
  if (line.boughtQty > 0) return "bought";
  return "planned";
}

function withLineUpdate(
  pack: SavedRoutePack,
  routeKey: string,
  lineKey: string,
  updater: (line: SavedRoutePackLineExecutionEntry) => SavedRoutePackLineExecutionEntry,
): SavedRoutePack {
  if (pack.routeKey !== routeKey) return pack;
  const line = pack.lines[lineKey];
  if (!line) return pack;
  const updatedLine = updater(line);
  if (updatedLine === line) return pack;
  return {
    ...pack,
    updatedAt: new Date().toISOString(),
    lines: {
      ...pack.lines,
      [lineKey]: {
        ...updatedLine,
        remainingQty: computeRemainingQty(updatedLine),
      },
    },
  };
}

export function markLineBought(
  pack: SavedRoutePack,
  routeKey: string,
  lineKey: string,
  qty: number,
  totalCost: number,
): SavedRoutePack {
  const qtyDelta = toQty(qty);
  const costDelta = normalizeMoney(totalCost);
  if (qtyDelta <= 0 || costDelta <= 0) return pack;
  return withLineUpdate(pack, routeKey, lineKey, (line) => {
    const remainingBuyQty = Math.max(0, line.plannedQty - line.boughtQty);
    const appliedQty = clamp(qtyDelta, 0, remainingBuyQty);
    if (appliedQty <= 0) return line;
    const effectiveCost = costDelta * (appliedQty / qtyDelta);
    const updated: SavedRoutePackLineExecutionEntry = {
      ...line,
      boughtQty: line.boughtQty + appliedQty,
      boughtTotal: line.boughtTotal + effectiveCost,
      skipReason: null,
    };
    updated.status = computeStatus(updated);
    return updated;
  });
}

export function markLineSold(
  pack: SavedRoutePack,
  routeKey: string,
  lineKey: string,
  qty: number,
  totalRevenue: number,
  overrideBoughtLimit = false,
): SavedRoutePack {
  const qtyDelta = toQty(qty);
  const revenueDelta = normalizeMoney(totalRevenue);
  if (qtyDelta <= 0 || revenueDelta <= 0) return pack;
  return withLineUpdate(pack, routeKey, lineKey, (line) => {
    const soldCeiling = overrideBoughtLimit ? line.plannedQty : Math.max(0, line.boughtQty);
    const remainingSellQty = Math.max(0, soldCeiling - line.soldQty);
    const appliedQty = clamp(qtyDelta, 0, remainingSellQty);
    if (appliedQty <= 0) return line;
    const effectiveRevenue = revenueDelta * (appliedQty / qtyDelta);
    const updated: SavedRoutePackLineExecutionEntry = {
      ...line,
      soldQty: line.soldQty + appliedQty,
      soldTotal: line.soldTotal + effectiveRevenue,
      skipReason: null,
    };
    updated.status = computeStatus(updated);
    return updated;
  });
}

export function markLineSkipped(
  pack: SavedRoutePack,
  routeKey: string,
  lineKey: string,
  reason: string,
): SavedRoutePack {
  return withLineUpdate(pack, routeKey, lineKey, (line) => {
    const nextReason = reason.trim() || "No reason provided";
    return {
      ...line,
      status: "skipped",
      skipReason: nextReason,
    };
  });
}

export function resetLineState(
  pack: SavedRoutePack,
  routeKey: string,
  lineKey: string,
): SavedRoutePack {
  return withLineUpdate(pack, routeKey, lineKey, (line) => ({
    ...line,
    boughtQty: 0,
    boughtTotal: 0,
    soldQty: 0,
    soldTotal: 0,
    remainingQty: line.plannedQty,
    status: "planned",
    skipReason: null,
    notes: "",
  }));
}

export function deriveExecutionSummary(pack: SavedRoutePack): SavedRouteExecutionSummary {
  const lines = Object.values(pack.lines);
  const totalLines = lines.length;
  let realizedProfit = 0;
  let remainingExpectedProfit = 0;
  let remainingCapital = 0;
  let remainingVolume = 0;
  let unsoldInventoryValue = 0;
  let completedCount = 0;
  let skippedCount = 0;
  let plannedQtyTotal = 0;
  let boughtQtyTotal = 0;
  let soldQtyTotal = 0;

  for (const line of lines) {
    const plannedProfitPerUnit = line.plannedQty > 0 ? line.plannedProfit / line.plannedQty : 0;
    const avgCost = line.boughtQty > 0 ? line.boughtTotal / line.boughtQty : line.plannedBuyPrice;
    realizedProfit += line.soldTotal - line.soldQty * avgCost;

    const unsoldQty = Math.max(0, line.boughtQty - line.soldQty);
    const remainingPlanQty = Math.max(0, line.plannedQty - line.soldQty);
    remainingExpectedProfit += remainingPlanQty * plannedProfitPerUnit;
    remainingCapital += Math.max(0, line.plannedQty - line.boughtQty) * line.plannedBuyPrice;
    remainingVolume += remainingPlanQty * (line.plannedQty > 0 ? line.plannedVolume / line.plannedQty : 0);
    unsoldInventoryValue += unsoldQty * avgCost;

    plannedQtyTotal += line.plannedQty;
    boughtQtyTotal += line.boughtQty;
    soldQtyTotal += line.soldQty;

    if (line.status === "completed") completedCount += 1;
    if (line.status === "skipped") skippedCount += 1;
  }

  const completionPct = totalLines > 0 ? ((completedCount + skippedCount) / totalLines) * 100 : 0;

  return {
    realizedProfit,
    remainingExpectedProfit,
    remainingCapital,
    remainingVolume,
    unsoldInventoryValue,
    completedCount,
    skippedCount,
    completionPct,
    boughtPlannedRatio: plannedQtyTotal > 0 ? boughtQtyTotal / plannedQtyTotal : 0,
    soldBoughtRatio: boughtQtyTotal > 0 ? soldQtyTotal / boughtQtyTotal : 0,
    totalLines,
  };
}
