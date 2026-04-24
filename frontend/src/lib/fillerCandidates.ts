import { executionQualityForFlip, requestedUnitsForFlip } from "@/lib/executionQuality";
import { routeLineKey } from "@/lib/batchMetrics";
import type { FlipResult } from "@/lib/types";
import { computeCargoFillScore } from "@/lib/cargoFillScore";

export interface FillerCandidate {
  lineKey: string;
  row: FlipResult;
  typeId: number;
  typeName: string;
  incrementalProfitIsk: number;
  incrementalCapitalIsk: number;
  incrementalVolumeM3: number;
  incrementalIskPerM3: number;
  capitalEfficiency: number;
  fitPercent: number;
  confidencePercent: number;
  executionQuality: number;
  riskPenalty: number;
  rankingScore: number;
  flags: string[];
  reason: string;
}

export interface BuildFillerCandidatesInput {
  routeRows: FlipResult[];
  selectedCoreLineKeys: Iterable<string>;
  remainingCargoM3: number;
  remainingCapitalIsk: number;
  minConfidencePercent?: number;
  minExecutionQuality?: number;
}

export interface FillerTopSummary {
  count: number;
  totalProfitIsk: number;
  totalCapitalIsk: number;
  totalVolumeM3: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function endpointKey(row: FlipResult): string {
  const buy = row.BuyLocationID ?? row.BuySystemID ?? 0;
  const sell = row.SellLocationID ?? row.SellSystemID ?? 0;
  return `${buy}->${sell}`;
}

function rowConfidencePercent(row: FlipResult): number {
  const requested = requestedUnitsForFlip(row);
  const filled = Math.max(0, row.FilledQty ?? 0);
  const depth = Math.max(0, Math.min(row.BuyOrderRemain ?? 0, row.SellOrderRemain ?? 0));
  if (requested <= 0) {
    return row.CanFill ? 100 : 0;
  }
  const fillRatio = clamp(filled / requested, 0, 1);
  const depthRatio = clamp(depth / requested, 0, 1);
  return (fillRatio * 0.7 + depthRatio * 0.3) * 100;
}

function riskPenaltyForRow(row: FlipResult): { penalty: number; flags: string[] } {
  const flags: string[] = [];
  let penalty = 0;
  const slippage = Math.max(0, (row.SlippageBuyPct ?? 0) + (row.SlippageSellPct ?? 0));
  if (slippage > 6) {
    flags.push("high_slippage");
    penalty += Math.min(0.35, slippage / 40);
  }
  if (row.HistoryAvailable === false && (row.DayPriceHistory?.length ?? 0) < 3) {
    flags.push("limited_history");
    penalty += 0.12;
  }
  if ((row.DayNowProfit ?? 0) > 0 && (row.DayPeriodProfit ?? 0) < 0) {
    flags.push("profit_spike");
    penalty += 0.1;
  }
  if ((row.BuyOrderRemain ?? 0) <= 0 || (row.SellOrderRemain ?? 0) <= 0) {
    flags.push("thin_book");
    penalty += 0.1;
  }
  return { penalty: clamp(penalty, 0, 1), flags };
}

export function buildFillerCandidates(
  input: BuildFillerCandidatesInput,
): FillerCandidate[] {
  const {
    routeRows,
    selectedCoreLineKeys,
    remainingCargoM3,
    remainingCapitalIsk,
    minConfidencePercent = 0,
    minExecutionQuality = 0,
  } = input;
  if (routeRows.length === 0 || remainingCargoM3 <= 0) return [];

  const selectedSet = new Set(selectedCoreLineKeys);
  const endpointBasis =
    routeRows.find((row) => selectedSet.has(routeLineKey(row))) ?? routeRows[0];
  const targetEndpoint = endpointKey(endpointBasis);

  const rawCandidates: Array<Omit<FillerCandidate, "rankingScore">> = [];
  for (const row of routeRows) {
    const lineKey = routeLineKey(row);
    if (selectedSet.has(lineKey)) continue;
    if (endpointKey(row) !== targetEndpoint) continue;

    const units = Math.max(0, Math.floor(requestedUnitsForFlip(row) || row.UnitsToBuy || 0));
    const incrementalVolumeM3 = Math.max(0, units * Math.max(0, row.Volume ?? 0));
    if (!(incrementalVolumeM3 > 0) || incrementalVolumeM3 > remainingCargoM3) continue;

    const buyPrice = Math.max(0, row.ExpectedBuyPrice ?? row.BuyPrice ?? 0);
    const incrementalCapitalIsk = units * buyPrice;
    if (remainingCapitalIsk > 0 && incrementalCapitalIsk > remainingCapitalIsk) continue;

    const incrementalProfitIsk =
      row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? row.ProfitPerUnit * units;
    const incrementalIskPerM3 =
      incrementalVolumeM3 > 0 ? incrementalProfitIsk / incrementalVolumeM3 : 0;
    const capitalEfficiency =
      incrementalCapitalIsk > 0 ? incrementalProfitIsk / incrementalCapitalIsk : 0;

    const confidencePercent = rowConfidencePercent(row);
    const executionQuality = executionQualityForFlip(row).score;
    if (confidencePercent < minConfidencePercent) continue;
    if (executionQuality < minExecutionQuality) continue;

    const risk = riskPenaltyForRow(row);
    rawCandidates.push({
      lineKey,
      row,
      typeId: row.TypeID,
      typeName: row.TypeName,
      incrementalProfitIsk,
      incrementalCapitalIsk,
      incrementalVolumeM3,
      incrementalIskPerM3,
      capitalEfficiency,
      fitPercent: clamp((incrementalVolumeM3 / remainingCargoM3) * 100, 0, 100),
      confidencePercent,
      executionQuality,
      riskPenalty: risk.penalty,
      flags: risk.flags,
      reason:
        risk.flags.length > 0
          ? `Endpoint match + cargo fit; risk: ${risk.flags.join(", ")}`
          : "Endpoint match + cargo fit",
    });
  }

  const maxProfit = Math.max(1, ...rawCandidates.map((item) => Math.max(0, item.incrementalProfitIsk)));
  const maxIskPerM3 = Math.max(1, ...rawCandidates.map((item) => Math.max(0, item.incrementalIskPerM3)));
  const maxCapEfficiency = Math.max(0.0001, ...rawCandidates.map((item) => Math.max(0, item.capitalEfficiency)));

  return rawCandidates
    .map((candidate) => {
      const normalizedProfit = clamp(candidate.incrementalProfitIsk / maxProfit, 0, 1);
      const normalizedIskPerM3 = clamp(candidate.incrementalIskPerM3 / maxIskPerM3, 0, 1);
      const normalizedConfidence = clamp(candidate.confidencePercent / 100, 0, 1);
      const normalizedQuality = clamp(candidate.executionQuality / 100, 0, 1);
      const normalizedCapitalEfficiency = clamp(candidate.capitalEfficiency / maxCapEfficiency, 0, 1);
      const fillScore = computeCargoFillScore({
        cargoFillRatio: candidate.fitPercent / 100,
        iskPerJump: candidate.incrementalProfitIsk,
        expectedProfitIsk: candidate.incrementalProfitIsk,
        capitalEfficiency: normalizedCapitalEfficiency,
        confidencePercent: candidate.confidencePercent,
        executionQuality: candidate.executionQuality,
        riskPenalty: candidate.riskPenalty,
        slippagePenalty: clamp(
          ((candidate.row.SlippageBuyPct ?? 0) + (candidate.row.SlippageSellPct ?? 0)) /
            12,
          0,
          1,
        ),
      });
      const rankingScore =
        normalizedProfit * 0.18 +
        normalizedIskPerM3 * 0.14 +
        normalizedConfidence * 0.14 +
        normalizedQuality * 0.14 +
        normalizedCapitalEfficiency * 0.1 +
        (fillScore / 100) * 0.3 -
        candidate.riskPenalty * 0.2;
      return { ...candidate, rankingScore };
    })
    .sort((left, right) => {
      if (right.rankingScore !== left.rankingScore) {
        return right.rankingScore - left.rankingScore;
      }
      if (right.incrementalProfitIsk !== left.incrementalProfitIsk) {
        return right.incrementalProfitIsk - left.incrementalProfitIsk;
      }
      return left.lineKey.localeCompare(right.lineKey);
    });
}

export function summarizeTopFillerCandidates(
  candidates: FillerCandidate[],
  topN = 3,
): FillerTopSummary {
  const slice = candidates.slice(0, Math.max(0, topN));
  return slice.reduce<FillerTopSummary>(
    (totals, candidate) => {
      totals.count += 1;
      totals.totalProfitIsk += candidate.incrementalProfitIsk;
      totals.totalCapitalIsk += candidate.incrementalCapitalIsk;
      totals.totalVolumeM3 += candidate.incrementalVolumeM3;
      return totals;
    },
    {
      count: 0,
      totalProfitIsk: 0,
      totalCapitalIsk: 0,
      totalVolumeM3: 0,
    },
  );
}
