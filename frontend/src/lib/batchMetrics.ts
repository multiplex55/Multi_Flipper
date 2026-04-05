import type { FlipResult } from "@/lib/types";
import {
  realIskPerJump,
  turnoverDays,
} from "@/lib/radiusMetrics";
import {
  executionQualityForFlip,
  hasDestinationPriceSpike,
  hasStableDestinationHistory,
  requestedUnitsForFlip,
} from "@/lib/executionQuality";
import {
  routeBreakevenBufferPct,
  routeDailyIskPerJump,
  routeDailyProfitOverCapitalPct,
  routeExitOverhangDaysWeighted,
  routeIskPerM3PerJump,
} from "@/lib/routeAggregateFormulas";

export type BatchLine = {
  row: FlipResult;
  units: number;
  volume: number;
  profit: number;
  capital: number;
  grossSell: number;
  iskPerM3: number;
};

export type BatchBuildResult = {
  lines: BatchLine[];
  totalVolume: number;
  totalProfit: number;
  totalCapital: number;
  totalGrossSell: number;
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
  batchIskPerJump: number;
  routeItemCount: number;
  routeTotalProfit: number;
  routeTotalCapital: number;
  routeTotalVolume: number;
  routeCapacityUsedPercent: number | null;
  routeRealIskPerJump: number;
  routeDailyIskPerJump: number;
  routeRealIskPerM3PerJump: number;
  routeDailyProfit: number;
  routeDailyProfitOverCapital: number | null;
  routeWeightedSlippagePct: number;
  routeWeakestExecutionQuality: number;
  routeTurnoverDays: number | null;
  routeExitOverhangDays: number | null;
  routeBreakevenBuffer: number | null;
  routeRiskSpikeCount: number;
  routeRiskNoHistoryCount: number;
  routeRiskUnstableHistoryCount: number;
  routeRiskThinFillCount: number;
  routeUniverseCandidateItemCount: number;
  routeUniverseExcludedItemCount: number;
  routeUniverseWarningCount: number;
};

export type RouteBatchMetadataByRoute = Record<string, RouteBatchMetadata>;

export type RouteBatchMetadataResult = {
  byRow: Record<string, RouteBatchMetadata>;
  byRoute: RouteBatchMetadataByRoute;
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

export function rowSellPerUnit(row: FlipResult): number {
  const expected = safeNumber(row.ExpectedSellPrice);
  if (expected > 0) return expected;
  return Math.max(0, safeNumber(row.SellPrice));
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

function routeEndpointKey(locationID: number, systemID: number): string {
  if (locationID > 0) return `loc:${locationID}`;
  return `sys:${systemID}`;
}

export function routeGroupKey(row: FlipResult): string {
  const buyLocationID = safeNumber(row.BuyLocationID);
  const sellLocationID = safeNumber(row.SellLocationID);
  const buySystemID = safeNumber(row.BuySystemID);
  const sellSystemID = safeNumber(row.SellSystemID);
  return `${routeEndpointKey(buyLocationID, buySystemID)}->${routeEndpointKey(
    sellLocationID,
    sellSystemID,
  )}`;
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

function rowS2BPerDay(row: FlipResult): number {
  const direct = safeNumber(row.S2BPerDay);
  if (direct > 0) return direct;
  const total = safeNumber(row.DailyVolume);
  if (total <= 0) return 0;
  const buyDepth = safeNumber(row.BuyOrderRemain);
  const sellDepth = safeNumber(row.SellOrderRemain);
  if (buyDepth <= 0 && sellDepth <= 0) return total / 2;
  if (buyDepth <= 0) return 0;
  if (sellDepth <= 0) return total;
  return (total * buyDepth) / (buyDepth + sellDepth);
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
      totalGrossSell: 0,
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
      grossSell: units * rowSellPerUnit(candidate.row),
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
  const totalGrossSell = lines.reduce((sum, line) => sum + line.grossSell, 0);
  const remainingM3 = Number.isFinite(capacity) ? Math.max(0, capacity - totalVolume) : null;
  const usedPercent =
    Number.isFinite(capacity) && capacity > 0
      ? Math.min(100, (totalVolume / capacity) * 100)
      : null;

  return { lines, totalVolume, totalProfit, totalCapital, totalGrossSell, remainingM3, usedPercent };
}

export function buildRouteBatchMetadataByRow(
  rows: FlipResult[],
  cargoLimitM3: number,
): Record<string, RouteBatchMetadata> {
  return buildRouteBatchMetadata(rows, cargoLimitM3).byRow;
}

export function buildRouteBatchMetadata(
  rows: FlipResult[],
  cargoLimitM3: number,
): RouteBatchMetadataResult {
  const metadataByRow: Record<string, RouteBatchMetadata> = {};
  const metadataByRoute: RouteBatchMetadataByRoute = {};
  const seen = new Set<string>();
  const rowsByRoute = new Map<string, FlipResult[]>();

  for (const row of rows) {
    const routeKey = routeGroupKey(row);
    const routeRows = rowsByRoute.get(routeKey);
    if (routeRows) {
      routeRows.push(row);
    } else {
      rowsByRoute.set(routeKey, [row]);
    }
  }

  for (const row of rows) {
    const identityKey = rowBatchIdentityKey(row);
    if (seen.has(identityKey)) continue;
    seen.add(identityKey);

    const routeKey = routeGroupKey(row);
    const routeRows = rowsByRoute.get(routeKey) ?? [row];
    const batch = buildBatch(row, routeRows, cargoLimitM3);
    const selectedPackLines = batch.lines;
    const routeUniverseLines = routeRows;
    const selectedRows = selectedPackLines.map((line) => line.row);
    const routeJumps =
      routeRows
        .map((candidate) => safeNumber(candidate.TotalJumps))
        .find((jumps) => jumps > 0) ?? 0;
    const weightedSlippage = selectedPackLines.reduce(
      (sum, selectedLine) =>
        sum +
        Math.max(
          0,
          safeNumber(selectedLine.row.SlippageBuyPct) +
            safeNumber(selectedLine.row.SlippageSellPct),
        ) *
          Math.max(0, safeNumber(selectedLine.units)),
      0,
    );
    const weightedSlippageDenominator = selectedPackLines.reduce(
      (sum, selectedLine) => sum + Math.max(0, safeNumber(selectedLine.units)),
      0,
    );
    const weakestExecutionQuality = selectedRows.reduce(
      (minScore, routeRow) =>
        Math.min(minScore, executionQualityForFlip(routeRow).score),
      Number.POSITIVE_INFINITY,
    );
    const weightedTurnoverNumerator = selectedRows.reduce((sum, routeRow) => {
      const td = turnoverDays(routeRow);
      const weight = Math.max(1, safeNumber(routeRow.DailyVolume));
      if (typeof td !== "number" || !Number.isFinite(td) || td < 0) return sum;
      return sum + td * weight;
    }, 0);
    const weightedTurnoverDenominator = selectedRows.reduce((sum, routeRow) => {
      const td = turnoverDays(routeRow);
      if (typeof td !== "number" || !Number.isFinite(td) || td < 0) return sum;
      return sum + Math.max(1, safeNumber(routeRow.DailyVolume));
    }, 0);
    const routeDailyProfit = selectedRows.reduce(
      (sum, routeRow) => sum + Math.max(0, safeNumber(routeRow.DailyProfit)),
      0,
    );
    const routeRealIskPerJump =
      routeJumps > 0
        ? selectedRows.reduce((sum, routeRow) => sum + realIskPerJump(routeRow), 0)
        : 0;
    const routeRealIskPerM3PerJump =
      routeIskPerM3PerJump(batch.totalProfit, batch.totalVolume, routeJumps) ?? 0;
    const routeDailyProfitOverCapital = routeDailyProfitOverCapitalPct(
      routeDailyProfit,
      batch.totalCapital,
    );
    const routeTurnoverDays =
      weightedTurnoverDenominator > 0
        ? weightedTurnoverNumerator / weightedTurnoverDenominator
        : null;
    const routeExitOverhangDays = routeExitOverhangDaysWeighted(
      selectedRows.map((routeRow) => ({
        targetSellSupply: routeRow.TargetSellSupply,
        s2bPerDay: rowS2BPerDay(routeRow),
        weight: Math.max(1, safeNumber(routeRow.DailyVolume)),
      })),
    );
    const routeBreakevenBuffer = routeBreakevenBufferPct(
      batch.totalProfit,
      batch.totalGrossSell,
    );
    const riskSpikeCount = selectedRows.filter((routeRow) =>
      hasDestinationPriceSpike(routeRow),
    ).length;
    const riskNoHistoryCount = selectedRows.filter((routeRow) => {
      const stable = hasStableDestinationHistory(routeRow);
      const hasHistory =
        (routeRow.DayPriceHistory?.length ?? 0) > 0 ||
        (routeRow.DayTargetPeriodPrice ?? 0) > 0 ||
        routeRow.HistoryAvailable === true;
      return !hasHistory && stable == null;
    }).length;
    const riskUnstableHistoryCount = selectedRows.filter(
      (routeRow) => hasStableDestinationHistory(routeRow) === false,
    ).length;
    const riskThinFillCount = selectedRows.filter((routeRow) => {
      const requested = requestedUnitsForFlip(routeRow);
      if (!(requested > 0)) return false;
      const filled = Math.max(0, safeNumber(routeRow.FilledQty));
      return filled / requested < 0.5;
    }).length;
    const routeUniverseWarningCount =
      routeUniverseLines.filter((routeRow) => hasDestinationPriceSpike(routeRow)).length +
      routeUniverseLines.filter((routeRow) => {
        const stable = hasStableDestinationHistory(routeRow);
        const hasHistory =
          (routeRow.DayPriceHistory?.length ?? 0) > 0 ||
          (routeRow.DayTargetPeriodPrice ?? 0) > 0 ||
          routeRow.HistoryAvailable === true;
        return !hasHistory && stable == null;
      }).length +
      routeUniverseLines.filter(
        (routeRow) => hasStableDestinationHistory(routeRow) === false,
      ).length;

    const metadata: RouteBatchMetadata = {
      batchNumber: batch.lines.length,
      batchProfit: batch.totalProfit,
      batchTotalCapital: batch.totalCapital,
      batchIskPerJump: routeJumps > 0 ? batch.totalProfit / routeJumps : 0,
      routeItemCount: selectedRows.length,
      routeTotalProfit: batch.totalProfit,
      routeTotalCapital: batch.totalCapital,
      routeTotalVolume: batch.totalVolume,
      routeCapacityUsedPercent: batch.usedPercent,
      routeRealIskPerJump,
      routeDailyIskPerJump: routeDailyIskPerJump(routeDailyProfit, routeJumps) ?? 0,
      routeRealIskPerM3PerJump,
      routeDailyProfit,
      routeDailyProfitOverCapital,
      routeWeightedSlippagePct:
        weightedSlippageDenominator > 0
          ? weightedSlippage / weightedSlippageDenominator
          : 0,
      routeWeakestExecutionQuality:
        weakestExecutionQuality === Number.POSITIVE_INFINITY
          ? 0
          : weakestExecutionQuality,
      routeTurnoverDays,
      routeExitOverhangDays,
      routeBreakevenBuffer,
      routeRiskSpikeCount: riskSpikeCount,
      routeRiskNoHistoryCount: riskNoHistoryCount,
      routeRiskUnstableHistoryCount: riskUnstableHistoryCount,
      routeRiskThinFillCount: riskThinFillCount,
      routeUniverseCandidateItemCount: routeUniverseLines.length,
      routeUniverseExcludedItemCount: Math.max(
        0,
        routeUniverseLines.length - selectedRows.length,
      ),
      routeUniverseWarningCount,
    };
    metadataByRow[identityKey] = metadata;
    if (!(routeKey in metadataByRoute)) {
      metadataByRoute[routeKey] = metadata;
    }
  }

  return { byRow: metadataByRow, byRoute: metadataByRoute };
}
