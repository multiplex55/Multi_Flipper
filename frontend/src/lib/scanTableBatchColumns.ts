import { formatISK } from "@/lib/format";
import { rowBatchIdentityKey, type RouteBatchMetadata } from "@/lib/batchMetrics";
import type { FlipResult } from "@/lib/types";

export type BatchSyntheticKey = "BatchNumber" | "BatchProfit" | "BatchTotalCapital";

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
  return metadata.batchTotalCapital;
}

export function formatBatchSyntheticCell(key: BatchSyntheticKey, value: number | null): string {
  if (key === "BatchNumber") {
    if (value == null || value <= 0) return "\u2014";
    return value.toLocaleString();
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
