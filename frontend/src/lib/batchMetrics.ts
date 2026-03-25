import type { FlipResult } from "@/lib/types";

export type BatchLine = {
  row: FlipResult;
  units: number;
  volume: number;
  profit: number;
  capital: number;
  iskPerM3: number;
};

export type BatchBuildResult = {
  lines: BatchLine[];
  totalVolume: number;
  totalProfit: number;
  totalCapital: number;
  remainingM3: number | null;
  usedPercent: number | null;
};

export type RowBatchMetrics = {
  volumePerUnit: number;
  profitPerUnit: number;
  capitalPerUnit: number;
  maxUnits: number;
  iskPerM3: number;
};

export type RouteBatchMetadata = {
  batchNumber: number;
  batchProfit: number;
  batchTotalCapital: number;
};

export function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function rowProfitPerUnit(row: FlipResult): number {
  const filledQty = safeNumber(row.FilledQty);
  if (filledQty > 0 && row.RealProfit != null) {
    const v = safeNumber(row.RealProfit) / filledQty;
    if (Number.isFinite(v)) return v;
  }
  return safeNumber(row.ProfitPerUnit);
}

export function rowCapitalPerUnit(row: FlipResult): number {
  const expected = safeNumber(row.ExpectedBuyPrice);
  if (expected > 0) return expected;
  return Math.max(0, safeNumber(row.BuyPrice));
}

export function rowMaxUnits(row: FlipResult): number {
  const recommended = Math.floor(safeNumber(row.UnitsToBuy));
  if (recommended > 0) return recommended;
  const buyRemain = Math.floor(Math.max(0, safeNumber(row.BuyOrderRemain)));
  const sellRemain = Math.floor(Math.max(0, safeNumber(row.SellOrderRemain)));
  if (buyRemain > 0 && sellRemain > 0) return Math.min(buyRemain, sellRemain);
  return Math.max(buyRemain, sellRemain);
}

export function getRowBatchMetrics(row: FlipResult): RowBatchMetrics {
  const volumePerUnit = safeNumber(row.Volume);
  const profitPerUnit = rowProfitPerUnit(row);
  const capitalPerUnit = rowCapitalPerUnit(row);
  const maxUnits = rowMaxUnits(row);
  const iskPerM3 =
    volumePerUnit > 0 && profitPerUnit > 0 ? profitPerUnit / volumePerUnit : 0;

  return {
    volumePerUnit,
    profitPerUnit,
    capitalPerUnit,
    maxUnits,
    iskPerM3,
  };
}

export function sameRoute(anchor: FlipResult, row: FlipResult): boolean {
  const anchorBuyLoc = safeNumber(anchor.BuyLocationID);
  const anchorSellLoc = safeNumber(anchor.SellLocationID);
  const rowBuyLoc = safeNumber(row.BuyLocationID);
  const rowSellLoc = safeNumber(row.SellLocationID);
  if (anchorBuyLoc > 0 && anchorSellLoc > 0 && rowBuyLoc > 0 && rowSellLoc > 0) {
    return anchorBuyLoc === rowBuyLoc && anchorSellLoc === rowSellLoc;
  }
  return (
    safeNumber(anchor.BuySystemID) === safeNumber(row.BuySystemID) &&
    safeNumber(anchor.SellSystemID) === safeNumber(row.SellSystemID)
  );
}

export function routeLineKey(row: FlipResult): string {
  return [
    row.TypeID,
    safeNumber(row.BuyLocationID) || row.BuyStation || row.BuySystemID,
    safeNumber(row.SellLocationID) || row.SellStation || row.SellSystemID,
  ].join(":");
}

export function rowBatchIdentityKey(row: FlipResult): string {
  return [
    row.TypeID,
    safeNumber(row.BuyLocationID),
    safeNumber(row.SellLocationID),
    safeNumber(row.BuySystemID),
    safeNumber(row.SellSystemID),
  ].join(":");
}

export function buildBatch(
  anchor: FlipResult,
  rows: FlipResult[],
  cargoLimitM3: number,
): BatchBuildResult {
  const routeRows = rows.filter((row) => sameRoute(anchor, row));
  if (routeRows.length === 0) {
    return {
      lines: [],
      totalVolume: 0,
      totalProfit: 0,
      totalCapital: 0,
      remainingM3: cargoLimitM3 > 0 ? cargoLimitM3 : null,
      usedPercent: cargoLimitM3 > 0 ? 0 : null,
    };
  }

  const byKey = new Map<
    string,
    {
      row: FlipResult;
      volumePerUnit: number;
      profitPerUnit: number;
      capitalPerUnit: number;
      maxUnits: number;
      density: number;
    }
  >();

  for (const row of routeRows) {
    const metrics = getRowBatchMetrics(row);
    if (metrics.volumePerUnit <= 0 || metrics.maxUnits <= 0 || metrics.profitPerUnit <= 0) {
      continue;
    }

    const key = routeLineKey(row);
    const existing = byKey.get(key);
    if (!existing || metrics.iskPerM3 > existing.density) {
      byKey.set(key, {
        row,
        volumePerUnit: metrics.volumePerUnit,
        profitPerUnit: metrics.profitPerUnit,
        capitalPerUnit: metrics.capitalPerUnit,
        maxUnits: metrics.maxUnits,
        density: metrics.iskPerM3,
      });
    }
  }

  const candidates = Array.from(byKey.values()).sort((a, b) => {
    if (b.density !== a.density) return b.density - a.density;
    if (b.profitPerUnit !== a.profitPerUnit) return b.profitPerUnit - a.profitPerUnit;
    return b.maxUnits - a.maxUnits;
  });

  const capacity = cargoLimitM3 > 0 ? cargoLimitM3 : Number.POSITIVE_INFINITY;
  let remaining = capacity;
  const lines: BatchLine[] = [];

  const addCandidate = (candidate: (typeof candidates)[number]) => {
    if (!(remaining > 0)) return;
    const maxByCargo = Number.isFinite(remaining)
      ? Math.floor((remaining + 1e-9) / candidate.volumePerUnit)
      : candidate.maxUnits;
    const units = Math.min(candidate.maxUnits, maxByCargo);
    if (units <= 0) return;
    const volume = units * candidate.volumePerUnit;
    lines.push({
      row: candidate.row,
      units,
      volume,
      profit: units * candidate.profitPerUnit,
      capital: units * candidate.capitalPerUnit,
      iskPerM3: candidate.density,
    });
    if (Number.isFinite(remaining)) {
      remaining -= volume;
    }
  };

  const anchorKey = routeLineKey(anchor);
  const anchorCandidate = candidates.find((c) => routeLineKey(c.row) === anchorKey);
  if (anchorCandidate) addCandidate(anchorCandidate);
  for (const candidate of candidates) {
    if (anchorCandidate && routeLineKey(candidate.row) === anchorKey) continue;
    addCandidate(candidate);
  }

  const totalVolume = lines.reduce((sum, line) => sum + line.volume, 0);
  const totalProfit = lines.reduce((sum, line) => sum + line.profit, 0);
  const totalCapital = lines.reduce((sum, line) => sum + line.capital, 0);
  const remainingM3 = Number.isFinite(capacity) ? Math.max(0, capacity - totalVolume) : null;
  const usedPercent =
    Number.isFinite(capacity) && capacity > 0
      ? Math.min(100, (totalVolume / capacity) * 100)
      : null;

  return { lines, totalVolume, totalProfit, totalCapital, remainingM3, usedPercent };
}

export function buildRouteBatchMetadataByRow(
  rows: FlipResult[],
  cargoLimitM3: number,
): Record<string, RouteBatchMetadata> {
  const metadataByRow: Record<string, RouteBatchMetadata> = {};
  const seen = new Set<string>();

  for (const row of rows) {
    const identityKey = rowBatchIdentityKey(row);
    if (seen.has(identityKey)) continue;
    seen.add(identityKey);

    const batch = buildBatch(row, rows, cargoLimitM3);
    metadataByRow[identityKey] = {
      batchNumber: batch.lines.length,
      batchProfit: batch.totalProfit,
      batchTotalCapital: batch.totalCapital,
    };
  }

  return metadataByRow;
}
