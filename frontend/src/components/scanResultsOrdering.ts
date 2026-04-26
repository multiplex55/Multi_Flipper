import { radiusRouteKey } from "@/lib/radiusMetrics";
import type { FlipResult } from "@/lib/types";

export type OrderingMode = "smart" | "column_only";
export type SortDir = "asc" | "desc";

export interface IndexedOrderingRow {
  id: number;
  sourceIndex: number;
  row: FlipResult;
  endpointPreferences?: {
    scoreDelta?: number;
  };
}

export interface SmartOrderingSignals {
  isPinned: boolean;
  isTracked: boolean;
  isSessionDeprioritized: boolean;
  patternBoostScore: number;
  endpointScoreDelta: number;
}

export interface CompareScanRowsOptions<SortKey extends string> {
  orderingMode: OrderingMode;
  pinsFirst: boolean;
  trackedFirst: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  getCellValue: (row: FlipResult, sortKey: SortKey) => unknown;
  getSmartSignals: (row: IndexedOrderingRow) => SmartOrderingSignals;
  isBatchSyntheticKey: (sortKey: SortKey) => boolean;
  compareBatchSyntheticValues: (
    left: number | null,
    right: number | null,
    sortDir: SortDir,
  ) => number;
  compareRouteSafety?: (a: IndexedOrderingRow, b: IndexedOrderingRow) => number;
}

export function compareRowsStable(a: IndexedOrderingRow, b: IndexedOrderingRow): number {
  const typeDiff = (a.row.TypeID ?? 0) - (b.row.TypeID ?? 0);
  if (typeDiff !== 0) return typeDiff;

  const routeCmp = radiusRouteKey(a.row).localeCompare(radiusRouteKey(b.row));
  if (routeCmp !== 0) return routeCmp;

  const typeNameCmp = String(a.row.TypeName ?? "").localeCompare(
    String(b.row.TypeName ?? ""),
  );
  if (typeNameCmp !== 0) return typeNameCmp;

  const idDiff = (a.id ?? 0) - (b.id ?? 0);
  if (idDiff !== 0) return idDiff;

  return (a.sourceIndex ?? 0) - (b.sourceIndex ?? 0);
}

export function compareScanRows<SortKey extends string>(
  a: IndexedOrderingRow,
  b: IndexedOrderingRow,
  options: CompareScanRowsOptions<SortKey>,
): number {
  const aUnreachable = Boolean(a.row.DistanceLensUnreachable);
  const bUnreachable = Boolean(b.row.DistanceLensUnreachable);
  if (aUnreachable !== bUnreachable) {
    return aUnreachable ? 1 : -1;
  }

  if (options.orderingMode === "smart") {
    const aSignals = options.getSmartSignals(a);
    const bSignals = options.getSmartSignals(b);

    if (options.pinsFirst && aSignals.isPinned !== bSignals.isPinned) {
      return aSignals.isPinned ? -1 : 1;
    }

    if (options.trackedFirst && aSignals.isTracked !== bSignals.isTracked) {
      return aSignals.isTracked ? -1 : 1;
    }

    if (
      aSignals.isSessionDeprioritized !== bSignals.isSessionDeprioritized
    ) {
      return aSignals.isSessionDeprioritized ? 1 : -1;
    }

    if (aSignals.patternBoostScore !== bSignals.patternBoostScore) {
      return bSignals.patternBoostScore - aSignals.patternBoostScore;
    }

    if (aSignals.endpointScoreDelta !== bSignals.endpointScoreDelta) {
      return bSignals.endpointScoreDelta - aSignals.endpointScoreDelta;
    }
  }

  if (options.sortKey === "RouteSafety" && options.compareRouteSafety) {
    const routeSafetyCmp = options.compareRouteSafety(a, b);
    if (routeSafetyCmp !== 0) return routeSafetyCmp;
    return compareRowsStable(a, b);
  }

  const av = options.getCellValue(a.row, options.sortKey);
  const bv = options.getCellValue(b.row, options.sortKey);

  if (options.isBatchSyntheticKey(options.sortKey)) {
    const batchCmp = options.compareBatchSyntheticValues(
      av as number | null,
      bv as number | null,
      options.sortDir,
    );
    if (batchCmp !== 0) return batchCmp;
    return compareRowsStable(a, b);
  }

  if (typeof av === "number" || typeof bv === "number") {
    if (av == null && bv == null) return compareRowsStable(a, b);
    if (av == null) return 1;
    if (bv == null) return -1;

    const diff = (av as number) - (bv as number);
    const numCmp = options.sortDir === "asc" ? diff : -diff;
    if (numCmp !== 0) return numCmp;
    return compareRowsStable(a, b);
  }

  const textCmp = String(av ?? "").localeCompare(String(bv ?? ""));
  const directionalTextCmp = options.sortDir === "asc" ? textCmp : -textCmp;
  if (directionalTextCmp !== 0) return directionalTextCmp;

  return compareRowsStable(a, b);
}
