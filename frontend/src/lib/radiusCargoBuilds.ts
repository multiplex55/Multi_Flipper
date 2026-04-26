import type { FlipResult } from "@/lib/types";
import { routeGroupKey } from "@/lib/batchMetrics";
import { executionQualityForFlip, requestedUnitsForFlip } from "@/lib/executionQuality";
import type { RouteAggregateMetrics } from "@/lib/useRadiusRouteInsights";
import { computeCargoFillScore } from "@/lib/cargoFillScore";

export type RadiusCargoBuildPreset =
  | "viator_safe"
  | "viator_max_profit"
  | "dst_bulk"
  | "low_capital"
  | "fast_turnover"
  | "high_confidence";

export type RadiusCargoBuildPresetConfig = {
  id: RadiusCargoBuildPreset;
  label: string;
  cargoCapacityM3: number;
  maxCapitalIsk: number;
  minExecutionQuality: number;
  maxRiskCount: number;
  maxRiskRate?: number;
  minConfidencePercent: number;
  minJumpEfficiencyIsk: number;
  preferLowJumps: boolean;
};

export type RadiusCargoBuild = {
  id: string;
  routeKey: string;
  routeLabel: string;
  rowCount: number;
  totalProfitIsk: number;
  totalCapitalIsk: number;
  totalCargoM3: number;
  totalGrossSellIsk: number;
  jumps: number;
  iskPerJump: number;
  jumpEfficiency: number;
  capitalEfficiency: number;
  cargoFillPercent: number;
  confidencePercent: number;
  executionQuality: number;
  riskCount: number;
  riskRate: number;
  riskCue: "low" | "moderate" | "high";
  executionCue: "smooth" | "watch" | "fragile";
  finalScore: number;
  lines: RadiusCargoBuildLine[];
  rows: FlipResult[];
};

export type RadiusCargoBuildLine = {
  row: FlipResult;
  units: number;
  volumeM3: number;
  capitalIsk: number;
  profitIsk: number;
  grossSellIsk: number;
  partial: boolean;
};

export const RADIUS_CARGO_BUILD_PRESETS: Record<
  RadiusCargoBuildPreset,
  RadiusCargoBuildPresetConfig
> = {
  // Moderate constraints for common null/lowsec Viator hauling: keep quality bars high,
  // but allow low six-figure ISK/jump opportunities so ranking can pick the cleanest subset.
  viator_safe: {
    id: "viator_safe",
    label: "Viator Safe",
    cargoCapacityM3: 10_000,
    maxCapitalIsk: 1_000_000_000,
    minExecutionQuality: 62,
    maxRiskCount: 2,
    minConfidencePercent: 55,
    minJumpEfficiencyIsk: 150_000,
    preferLowJumps: true,
  },
  // Profit-first Viator preset for broader market regimes: moderate gates avoid hard dropping
  // viable routes and let scoring/ranking sort by expected edge.
  viator_max_profit: {
    id: "viator_max_profit",
    label: "Viator Max Profit",
    cargoCapacityM3: 10_000,
    maxCapitalIsk: 2_400_000_000,
    minExecutionQuality: 45,
    maxRiskCount: 5,
    minConfidencePercent: 35,
    minJumpEfficiencyIsk: 120_000,
    preferLowJumps: false,
  },
  // DST bulk hauling operates on larger baskets with mixed quality; thresholds are intentionally
  // moderate so batch-level ranking can prefer dense, practical cargo plans.
  dst_bulk: {
    id: "dst_bulk",
    label: "DST Bulk",
    cargoCapacityM3: 62_000,
    maxCapitalIsk: 4_000_000_000,
    minExecutionQuality: 40,
    maxRiskCount: 6,
    maxRiskRate: 0.65,
    minConfidencePercent: 30,
    minJumpEfficiencyIsk: 100_000,
    preferLowJumps: false,
  },
  low_capital: {
    id: "low_capital",
    label: "Low Capital",
    cargoCapacityM3: 16_000,
    maxCapitalIsk: 350_000_000,
    minExecutionQuality: 52,
    maxRiskCount: 3,
    minConfidencePercent: 50,
    minJumpEfficiencyIsk: 4_000_000,
    preferLowJumps: true,
  },
  fast_turnover: {
    id: "fast_turnover",
    label: "Fast Turnover",
    cargoCapacityM3: 14_000,
    maxCapitalIsk: 1_500_000_000,
    minExecutionQuality: 55,
    maxRiskCount: 3,
    minConfidencePercent: 55,
    minJumpEfficiencyIsk: 10_000_000,
    preferLowJumps: true,
  },
  high_confidence: {
    id: "high_confidence",
    label: "High Confidence",
    cargoCapacityM3: 18_000,
    maxCapitalIsk: 1_800_000_000,
    minExecutionQuality: 70,
    maxRiskCount: 2,
    minConfidencePercent: 70,
    minJumpEfficiencyIsk: 6_000_000,
    preferLowJumps: true,
  },
};

export type RadiusCargoBuildDiagnostics = {
  totalRows: number;
  skippedNoUnits: number;
  skippedNoVolume: number;
  skippedNoCapital: number;
  skippedCargoFull: number;
  skippedCapitalFull: number;
  skippedExecutionQuality: number;
  skippedConfidence: number;
  skippedJumpEfficiency: number;
  skippedRisk: number;
  partialRowsAvailable: number;
};

export type BuildRadiusCargoBuildsInput = {
  rows: FlipResult[];
  routeAggregateMetricsByRoute: Record<string, RouteAggregateMetrics>;
  preset: RadiusCargoBuildPresetConfig;
  maxBuilds?: number;
};

export type BuildRadiusCargoBuildsResult = {
  builds: RadiusCargoBuild[];
  diagnostics: RadiusCargoBuildDiagnostics;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function createRadiusCargoBuildDiagnostics(totalRows: number): RadiusCargoBuildDiagnostics {
  return {
    totalRows,
    skippedNoUnits: 0,
    skippedNoVolume: 0,
    skippedNoCapital: 0,
    skippedCargoFull: 0,
    skippedCapitalFull: 0,
    skippedExecutionQuality: 0,
    skippedConfidence: 0,
    skippedJumpEfficiency: 0,
    skippedRisk: 0,
    partialRowsAvailable: 0,
  };
}

export function buildRadiusCargoBuilds(
  input: BuildRadiusCargoBuildsInput,
): BuildRadiusCargoBuildsResult {
  const { rows, routeAggregateMetricsByRoute, preset, maxBuilds = 10 } = input;
  const diagnostics = createRadiusCargoBuildDiagnostics(rows.length);
  if (rows.length === 0) return { builds: [], diagnostics };

  const grouped = new Map<string, FlipResult[]>();
  for (const row of rows) {
    const key = routeGroupKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const builds: RadiusCargoBuild[] = [];
  for (const [routeKey, routeRows] of grouped.entries()) {
    const aggregate = routeAggregateMetricsByRoute[routeKey];
    const orderedRows = [...routeRows].sort((a, b) => {
      const profitDiff = (b.RealProfit ?? b.TotalProfit ?? 0) - (a.RealProfit ?? a.TotalProfit ?? 0);
      if (profitDiff !== 0) return profitDiff;
      return a.TypeName.localeCompare(b.TypeName);
    });

    const lines: RadiusCargoBuildLine[] = [];
    let usedCargo = 0;
    let usedCapital = 0;
    let totalProfit = 0;
    let grossSell = 0;
    let weightedConfidence = 0;
    let weightedExecution = 0;
    let weightTotal = 0;

    // Deterministic filter sequence:
    // 1) data validity -> 2) execution quality -> 3) confidence
    // 4) jump efficiency (route-level) -> 5) risk (route-level) -> 6) capacity/capital allocation.
    for (const row of orderedRows) {
      const requestedUnits = Math.max(0, Math.floor(requestedUnitsForFlip(row) || row.UnitsToBuy || 0));
      if (requestedUnits <= 0) {
        diagnostics.skippedNoUnits += 1;
        continue;
      }

      // 1) Data validity
      const volumePerUnit = Math.max(0, row.Volume ?? 0);
      const buyPrice = Math.max(0, row.ExpectedBuyPrice ?? row.BuyPrice ?? 0);
      const profitPerUnit = Math.max(0, row.ProfitPerUnit ?? 0);
      const sellPrice = Math.max(0, row.SellPrice ?? 0);
      if (volumePerUnit <= 0) {
        diagnostics.skippedNoVolume += 1;
        continue;
      }
      if (buyPrice <= 0) {
        diagnostics.skippedNoCapital += 1;
        continue;
      }

      // 2) Execution quality
      const execution = executionQualityForFlip(row).score;
      if (execution < preset.minExecutionQuality) {
        diagnostics.skippedExecutionQuality += 1;
        continue;
      }

      // 3) Confidence
      const confidence = Math.max(0, Math.min(100, row.CanFill ? 100 : (row.FilledQty ?? 0) > 0 ? 60 : 30));
      if (confidence < preset.minConfidencePercent) {
        diagnostics.skippedConfidence += 1;
        continue;
      }

      // 6) Capacity/capital allocation (route-level gating is handled after candidate line selection)
      const remainingCargo = Math.max(0, preset.cargoCapacityM3 - usedCargo);
      const remainingCapital = Math.max(0, preset.maxCapitalIsk - usedCapital);
      const maxUnitsByCargo = Math.floor(remainingCargo / volumePerUnit);
      const maxUnitsByCapital = Math.floor(remainingCapital / buyPrice);
      const units = Math.min(requestedUnits, maxUnitsByCargo, maxUnitsByCapital);
      if (units <= 0) {
        if (maxUnitsByCargo <= 0) {
          diagnostics.skippedCargoFull += 1;
        } else {
          diagnostics.skippedCapitalFull += 1;
        }
        continue;
      }

      const volume = Math.max(0, units * volumePerUnit);
      const capital = Math.max(0, units * buyPrice);
      const profit = Math.max(0, units * profitPerUnit);
      const partial = units < requestedUnits;
      if (partial) diagnostics.partialRowsAvailable += 1;
      const grossSellIsk = Math.max(0, units * sellPrice);

      usedCargo += volume;
      usedCapital += capital;
      totalProfit += profit;
      grossSell += grossSellIsk;
      lines.push({
        row,
        units,
        volumeM3: volume,
        capitalIsk: capital,
        profitIsk: profit,
        grossSellIsk,
        partial,
      });
      weightedConfidence += confidence * volume;
      weightedExecution += execution * volume;
      weightTotal += volume;
    }

    if (lines.length === 0) continue;
    const picked = lines.map((line) => line.row);

    const jumps = Math.max(1, Math.round(aggregate?.dailyIskPerJump ? totalProfit / Math.max(1, aggregate.dailyIskPerJump) : picked[0].TotalJumps ?? 1));
    const iskPerJump = totalProfit / jumps;
    // 4) Jump efficiency (route-level)
    if (iskPerJump < preset.minJumpEfficiencyIsk) {
      diagnostics.skippedJumpEfficiency += 1;
      continue;
    }

    // 5) Risk gating (route-level): keep absolute count + optional density check.
    const riskCount = Math.max(0, aggregate?.riskTotalCount ?? 0);
    const riskDenominator = Math.max(1, orderedRows.length);
    const riskRate = riskCount / riskDenominator;
    if (riskCount > preset.maxRiskCount) {
      diagnostics.skippedRisk += 1;
      continue;
    }
    if (typeof preset.maxRiskRate === "number" && riskRate > preset.maxRiskRate) {
      diagnostics.skippedRisk += 1;
      continue;
    }

    const cargoFillPercent = clamp((usedCargo / Math.max(1, preset.cargoCapacityM3)) * 100, 0, 100);
    const confidencePercent = weightTotal > 0 ? weightedConfidence / weightTotal : 0;
    const executionQuality = weightTotal > 0 ? weightedExecution / weightTotal : 0;
    const capitalEfficiency = usedCapital > 0 ? totalProfit / usedCapital : 0;

    const fillScore = computeCargoFillScore({
      cargoFillRatio: cargoFillPercent / 100,
      iskPerJump,
      expectedProfitIsk: totalProfit,
      capitalEfficiency,
      confidencePercent,
      executionQuality,
      riskPenalty: clamp(riskCount / 6, 0, 1),
      slippagePenalty: clamp((aggregate?.weightedSlippagePct ?? 0) / 10, 0, 1),
    });

    const jumpEfficiency = preset.preferLowJumps
      ? clamp(1 - (jumps - 1) / 16, 0, 1)
      : clamp(1 - (jumps - 1) / 30, 0, 1);

    builds.push({
      id: `${routeKey}:${preset.id}`,
      routeKey,
      routeLabel: `${picked[0].BuyStation || picked[0].BuySystemName} → ${picked[0].SellStation || picked[0].SellSystemName}`,
      rowCount: picked.length,
      totalProfitIsk: totalProfit,
      totalCapitalIsk: usedCapital,
      totalCargoM3: usedCargo,
      totalGrossSellIsk: grossSell,
      jumps,
      iskPerJump,
      jumpEfficiency,
      capitalEfficiency,
      cargoFillPercent,
      confidencePercent,
      executionQuality,
      riskCount,
      riskRate,
      riskCue: riskCount <= 1 ? "low" : riskCount <= 3 ? "moderate" : "high",
      executionCue: executionQuality >= 70 ? "smooth" : executionQuality >= 55 ? "watch" : "fragile",
      finalScore: fillScore,
      lines,
      rows: picked,
    });
  }

  const rankedBuilds = builds
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) return right.finalScore - left.finalScore;
      if (right.totalProfitIsk !== left.totalProfitIsk) return right.totalProfitIsk - left.totalProfitIsk;
      if (right.cargoFillPercent !== left.cargoFillPercent) return right.cargoFillPercent - left.cargoFillPercent;
      return left.routeKey.localeCompare(right.routeKey);
    })
    .slice(0, Math.max(1, maxBuilds));

  return { builds: rankedBuilds, diagnostics };
}
