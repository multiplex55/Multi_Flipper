import { formatISK } from "@/lib/format";
import {
  rowBatchIdentityKey,
  type RouteBatchMetadata,
} from "@/lib/batchMetrics";
import { routeRecommendationScoreFromMetrics } from "@/lib/radiusMetrics";
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
  | "RoutePackDailyProfit"
  | "RoutePackRealIskPerM3PerJump"
  | "RoutePackDailyProfitOverCapital"
  | "RoutePackROI"
  | "RoutePackProfitPer100M"
  | "RoutePackWeightedSlippagePct"
  | "RoutePackWeakestExecutionQuality"
  | "RoutePackTurnoverDays"
  | "RoutePackExitOverhangDays"
  | "RoutePackBreakevenBuffer"
  | "RoutePackRemainingCargoM3"
  | "RoutePackWorstFillConfidencePct"
  | "RoutePackAverageFillConfidencePct"
  | "RoutePackThinFillCount"
  | "RoutePackProfitConcentrationPct"
  | "RoutePackRiskSpikeCount"
  | "RoutePackRiskNoHistoryCount"
  | "RoutePackRiskUnstableHistoryCount"
  | "RoutePackTotalRiskCount"
  | "RoutePackRecommendationScore";

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
  if (key === "RoutePackCapacityUsedPercent")
    return metadata.routeCapacityUsedPercent;
  if (key === "RoutePackRealIskPerJump") return metadata.routeRealIskPerJump;
  if (key === "RoutePackDailyIskPerJump") return metadata.routeDailyIskPerJump;
  if (key === "RoutePackDailyProfit") return metadata.routeDailyProfit;
  if (key === "RoutePackRealIskPerM3PerJump")
    return metadata.routeRealIskPerM3PerJump;
  if (key === "RoutePackDailyProfitOverCapital")
    return metadata.routeDailyProfitOverCapital;
  if (key === "RoutePackROI") return metadata.routeDailyProfitOverCapital;
  if (key === "RoutePackProfitPer100M") {
    if (!(metadata.routeTotalCapital > 0)) return null;
    return (metadata.routeTotalProfit / metadata.routeTotalCapital) * 100_000_000;
  }
  if (key === "RoutePackWeightedSlippagePct")
    return metadata.routeWeightedSlippagePct;
  if (key === "RoutePackWeakestExecutionQuality")
    return metadata.routeWeakestExecutionQuality;
  if (key === "RoutePackTurnoverDays") return metadata.routeTurnoverDays;
  if (key === "RoutePackExitOverhangDays")
    return metadata.routeExitOverhangDays;
  if (key === "RoutePackBreakevenBuffer") return metadata.routeBreakevenBuffer;
  if (key === "RoutePackRemainingCargoM3") return metadata.routeRemainingCargoM3;
  if (key === "RoutePackWorstFillConfidencePct")
    return metadata.routeWorstFillConfidencePct;
  if (key === "RoutePackAverageFillConfidencePct")
    return metadata.routeAverageFillConfidencePct;
  if (key === "RoutePackThinFillCount") return metadata.routeRiskThinFillCount;
  if (key === "RoutePackProfitConcentrationPct")
    return metadata.routeProfitConcentrationPct;
  if (key === "RoutePackRiskSpikeCount") return metadata.routeRiskSpikeCount;
  if (key === "RoutePackRiskNoHistoryCount")
    return metadata.routeRiskNoHistoryCount;
  if (key === "RoutePackRiskUnstableHistoryCount")
    return metadata.routeRiskUnstableHistoryCount;
  if (key === "RoutePackTotalRiskCount")
    return (
      metadata.routeRiskSpikeCount +
      metadata.routeRiskNoHistoryCount +
      metadata.routeRiskUnstableHistoryCount +
      metadata.routeRiskThinFillCount
    );
  if (key === "RoutePackRecommendationScore") {
    return routeRecommendationScoreFromMetrics({
      routeDailyIskPerJump: metadata.routeDailyIskPerJump,
      routeWeakestExecutionQuality: metadata.routeWeakestExecutionQuality,
      routeWeightedSlippagePct: metadata.routeWeightedSlippagePct,
      routeTotalRiskCount:
        metadata.routeRiskSpikeCount +
        metadata.routeRiskNoHistoryCount +
        metadata.routeRiskUnstableHistoryCount +
        metadata.routeRiskThinFillCount,
      routeTurnoverDays: metadata.routeTurnoverDays,
      routeCapacityUsedPercent: metadata.routeCapacityUsedPercent,
    });
  }
  return metadata.batchTotalCapital;
}

export function formatBatchSyntheticCell(
  key: BatchSyntheticKey,
  value: number | null,
): string {
  if (
    key === "BatchNumber" ||
    key === "RoutePackItemCount" ||
    key === "RoutePackThinFillCount" ||
    key === "RoutePackRiskSpikeCount" ||
    key === "RoutePackRiskNoHistoryCount" ||
    key === "RoutePackRiskUnstableHistoryCount" ||
    key === "RoutePackTotalRiskCount"
  ) {
    if (value == null || value <= 0) return "\u2014";
    return value.toLocaleString();
  }
  if (
    key === "RoutePackCapacityUsedPercent" ||
    key === "RoutePackWeightedSlippagePct" ||
    key === "RoutePackDailyProfitOverCapital" ||
    key === "RoutePackROI" ||
    key === "RoutePackWorstFillConfidencePct" ||
    key === "RoutePackAverageFillConfidencePct" ||
    key === "RoutePackProfitConcentrationPct" ||
    key === "RoutePackBreakevenBuffer"
  ) {
    if (value == null || value <= 0) return "\u2014";
    return `${value.toFixed(2)}%`;
  }
  if (
    key === "RoutePackWeakestExecutionQuality" ||
    key === "RoutePackTurnoverDays" ||
    key === "RoutePackExitOverhangDays"
  ) {
    if (value == null || value <= 0) return "\u2014";
    return key === "RoutePackExitOverhangDays"
      ? `${value.toFixed(1)}d`
      : value.toFixed(1);
  }
  if (key === "RoutePackTotalVolume") {
    if (value == null || value <= 0) return "\u2014";
    return `${value.toLocaleString()} m³`;
  }
  if (key === "RoutePackRemainingCargoM3") {
    if (value == null || value <= 0) return "\u2014";
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} m³`;
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
  if (!Number.isFinite(a) && !Number.isFinite(b)) return 0;
  if (!Number.isFinite(a)) return 1;
  if (!Number.isFinite(b)) return -1;
  const diff = a - b;
  if (diff === 0) return 0;
  return sortDir === "asc" ? diff : -diff;
}

export function passesBatchNumericFilter(
  value: number | null,
  filterValue: string,
): boolean {
  if (!filterValue) return true;
  if (value == null) return false;
  const min = Number(filterValue);
  return Number.isNaN(min) || value >= min;
}
