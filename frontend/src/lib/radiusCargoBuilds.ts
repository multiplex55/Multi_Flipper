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
  jumps: number;
  iskPerJump: number;
  jumpEfficiency: number;
  capitalEfficiency: number;
  cargoFillPercent: number;
  confidencePercent: number;
  executionQuality: number;
  riskCount: number;
  riskCue: "low" | "moderate" | "high";
  executionCue: "smooth" | "watch" | "fragile";
  finalScore: number;
  rows: FlipResult[];
};

export const RADIUS_CARGO_BUILD_PRESETS: Record<
  RadiusCargoBuildPreset,
  RadiusCargoBuildPresetConfig
> = {
  viator_safe: {
    id: "viator_safe",
    label: "Viator Safe",
    cargoCapacityM3: 10_000,
    maxCapitalIsk: 1_000_000_000,
    minExecutionQuality: 62,
    maxRiskCount: 2,
    minConfidencePercent: 55,
    minJumpEfficiencyIsk: 8_000_000,
    preferLowJumps: true,
  },
  viator_max_profit: {
    id: "viator_max_profit",
    label: "Viator Max Profit",
    cargoCapacityM3: 10_000,
    maxCapitalIsk: 2_400_000_000,
    minExecutionQuality: 45,
    maxRiskCount: 4,
    minConfidencePercent: 35,
    minJumpEfficiencyIsk: 5_000_000,
    preferLowJumps: false,
  },
  dst_bulk: {
    id: "dst_bulk",
    label: "DST Bulk",
    cargoCapacityM3: 62_000,
    maxCapitalIsk: 4_000_000_000,
    minExecutionQuality: 40,
    maxRiskCount: 5,
    minConfidencePercent: 30,
    minJumpEfficiencyIsk: 3_000_000,
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

export type BuildRadiusCargoBuildsInput = {
  rows: FlipResult[];
  routeAggregateMetricsByRoute: Record<string, RouteAggregateMetrics>;
  preset: RadiusCargoBuildPresetConfig;
  maxBuilds?: number;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function buildRadiusCargoBuilds(
  input: BuildRadiusCargoBuildsInput,
): RadiusCargoBuild[] {
  const { rows, routeAggregateMetricsByRoute, preset, maxBuilds = 10 } = input;
  if (rows.length === 0) return [];

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

    const picked: FlipResult[] = [];
    let usedCargo = 0;
    let usedCapital = 0;
    let totalProfit = 0;
    let weightedConfidence = 0;
    let weightedExecution = 0;
    let weightTotal = 0;

    for (const row of orderedRows) {
      const units = Math.max(0, Math.floor(requestedUnitsForFlip(row) || row.UnitsToBuy || 0));
      if (units <= 0) continue;
      const volume = Math.max(0, (row.Volume ?? 0) * units);
      const capital = Math.max(0, (row.ExpectedBuyPrice ?? row.BuyPrice ?? 0) * units);
      if (volume <= 0 || capital <= 0) continue;
      if (usedCargo + volume > preset.cargoCapacityM3) continue;
      if (usedCapital + capital > preset.maxCapitalIsk) continue;

      const execution = executionQualityForFlip(row).score;
      const confidence = Math.max(0, Math.min(100, row.CanFill ? 100 : (row.FilledQty ?? 0) > 0 ? 60 : 30));
      if (execution < preset.minExecutionQuality || confidence < preset.minConfidencePercent) {
        continue;
      }

      const profit = Math.max(0, row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? 0);
      usedCargo += volume;
      usedCapital += capital;
      totalProfit += profit;
      picked.push(row);
      weightedConfidence += confidence * volume;
      weightedExecution += execution * volume;
      weightTotal += volume;
    }

    if (picked.length === 0) continue;

    const jumps = Math.max(1, Math.round(aggregate?.dailyIskPerJump ? totalProfit / Math.max(1, aggregate.dailyIskPerJump) : picked[0].TotalJumps ?? 1));
    const iskPerJump = totalProfit / jumps;
    if (iskPerJump < preset.minJumpEfficiencyIsk) continue;

    const riskCount = aggregate?.riskTotalCount ?? 0;
    if (riskCount > preset.maxRiskCount) continue;

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
      jumps,
      iskPerJump,
      jumpEfficiency,
      capitalEfficiency,
      cargoFillPercent,
      confidencePercent,
      executionQuality,
      riskCount,
      riskCue: riskCount <= 1 ? "low" : riskCount <= 3 ? "moderate" : "high",
      executionCue: executionQuality >= 70 ? "smooth" : executionQuality >= 55 ? "watch" : "fragile",
      finalScore: fillScore,
      rows: picked,
    });
  }

  return builds
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) return right.finalScore - left.finalScore;
      if (right.totalProfitIsk !== left.totalProfitIsk) return right.totalProfitIsk - left.totalProfitIsk;
      if (right.cargoFillPercent !== left.cargoFillPercent) return right.cargoFillPercent - left.cargoFillPercent;
      return left.routeKey.localeCompare(right.routeKey);
    })
    .slice(0, Math.max(1, maxBuilds));
}
