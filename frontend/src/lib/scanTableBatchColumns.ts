import { formatISK } from "@/lib/format";
import { rowBatchIdentityKey, type RouteBatchMetadata } from "@/lib/batchMetrics";
import type { FlipResult } from "@/lib/types";

export type BatchSyntheticKey =
  | "BatchNumber"
  | "BatchProfit"
  | "BatchTotalCapital"
  | "BatchIskPerJump"
  | "RoutePackItemCount"
  | "RoutePackTotalProfit"
  | "RoutePackTotalCapital"
  | "RoutePackTotalVolume"
  | "RoutePackCapacityUsedPercent"
  | "RoutePackRealIskPerJump"
  | "RoutePackDailyIskPerJump"
  | "RoutePackRealIskPerM3PerJump"
  | "RoutePackDailyProfitOverCapital"
  | "RoutePackWeightedSlippagePct"
  | "RoutePackWeakestExecutionQuality"
  | "RoutePackTurnoverDays"
  | "RoutePackRiskSpikeCount"
  | "RoutePackRiskNoHistoryCount"
  | "RoutePackRiskUnstableHistoryCount"
  | "RoutePackTotalRiskCount";

export type BatchMetadataByRow = Record<string, RouteBatchMetadata>;

export function getBatchSyntheticValue(
  row: FlipResult,
  key: BatchSyntheticKey,
  batchMetricsByRow: BatchMetadataByRow,
): number | null {
  const metadata = batchMetricsByRow[rowBatchIdentityKey(row)];
  if (!metadata || metadata.batchNumber <= 0) return null;
  if (key === "BatchNumber") return metadata.batchNumber;
  if (key === "BatchProfit") return metadata.batchProfit;
  if (key === "BatchIskPerJump") {
    const jumps = Number(row.TotalJumps);
    if (!Number.isFinite(jumps) || jumps <= 0) return null;
    return metadata.batchProfit / jumps;
  }
  if (key === "RoutePackItemCount") return metadata.routeItemCount;
  if (key === "RoutePackTotalProfit") return metadata.routeTotalProfit;
  if (key === "RoutePackTotalCapital") return metadata.routeTotalCapital;
  if (key === "RoutePackTotalVolume") return metadata.routeTotalVolume;
  if (key === "RoutePackCapacityUsedPercent") return metadata.routeCapacityUsedPercent;
  if (key === "RoutePackRealIskPerJump") return metadata.routeRealIskPerJump;
  if (key === "RoutePackDailyIskPerJump") return metadata.routeDailyIskPerJump;
  if (key === "RoutePackRealIskPerM3PerJump") return metadata.routeRealIskPerM3PerJump;
  if (key === "RoutePackDailyProfitOverCapital") return metadata.routeDailyProfitOverCapital;
  if (key === "RoutePackWeightedSlippagePct") return metadata.routeWeightedSlippagePct;
  if (key === "RoutePackWeakestExecutionQuality")
    return metadata.routeWeakestExecutionQuality;
  if (key === "RoutePackTurnoverDays") return metadata.routeTurnoverDays;
  if (key === "RoutePackRiskSpikeCount") return metadata.routeRiskSpikeCount;
  if (key === "RoutePackRiskNoHistoryCount") return metadata.routeRiskNoHistoryCount;
  if (key === "RoutePackRiskUnstableHistoryCount")
    return metadata.routeRiskUnstableHistoryCount;
  if (key === "RoutePackTotalRiskCount")
    return (
      metadata.routeRiskSpikeCount +
      metadata.routeRiskNoHistoryCount +
      metadata.routeRiskUnstableHistoryCount +
      metadata.routeRiskThinFillCount
    );
  return metadata.batchTotalCapital;
}

export function formatBatchSyntheticCell(key: BatchSyntheticKey, value: number | null): string {
  if (
    key === "BatchNumber" ||
    key === "RoutePackItemCount" ||
    key === "RoutePackRiskSpikeCount" ||
    key === "RoutePackRiskNoHistoryCount" ||
    key === "RoutePackRiskUnstableHistoryCount" ||
    key === "RoutePackTotalRiskCount"
  ) {
    if (value == null || value <= 0) return "\u2014";
    return value.toLocaleString();
  }
  if (key === "RoutePackCapacityUsedPercent" || key === "RoutePackWeightedSlippagePct") {
    if (value == null || value <= 0) return "\u2014";
    return `${value.toFixed(2)}%`;
  }
  if (key === "RoutePackWeakestExecutionQuality" || key === "RoutePackTurnoverDays") {
    if (value == null || value <= 0) return "\u2014";
    return value.toFixed(1);
  }
  if (key === "RoutePackTotalVolume") {
    if (value == null || value <= 0) return "\u2014";
    return `${value.toLocaleString()} m³`;
  }
  if (value == null || value <= 0) return "\u2014";
  return formatISK(value);
}

export function compareBatchSyntheticValues(
  a: number | null,
  b: number | null,
  sortDir: "asc" | "desc",
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const diff = a - b;
  return sortDir === "asc" ? diff : -diff;
}

export function passesBatchNumericFilter(value: number | null, filterValue: string): boolean {
  if (!filterValue) return true;
  if (value == null) return false;
  const min = Number(filterValue);
  return Number.isNaN(min) || value >= min;
}
