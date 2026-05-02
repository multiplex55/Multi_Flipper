import type { FlipResult } from "@/lib/types";
import { routeGroupKey } from "@/lib/batchMetrics";
import { executionQualityForFlip, requestedUnitsForFlip } from "@/lib/executionQuality";
import type { RouteAggregateMetrics } from "@/lib/useRadiusRouteInsights";
import { computeCargoFillScore } from "@/lib/cargoFillScore";
import { scoreRadiusCargoLine } from "@/lib/radiusCargoLineScore";
import {
  combineComparators,
  compareNumberAsc,
  compareNumberDesc,
  compareTextAsc,
  createMetricNormalizer,
  finiteNumber,
} from "@/lib/radiusDecisionGuardrails";

export type RadiusCargoBuildPreset =
  | "viator_safe"
  | "viator_max_profit"
  | "dst_bulk"
  | "low_capital"
  | "fast_turnover"
  | "high_confidence";

export type RadiusCargoBuildOptimizerMode =
  | "greedy_profit"
  | "greedy_isk_per_m3"
  | "balanced_score"
  | "bounded_knapsack";

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

export type RadiusCargoBuildSuggestedAction =
  | "relax_preset"
  | "trim_lines"
  | "increase_capital"
  | "increase_cargo"
  | "skip";

export type RadiusCargoBuildBlockerKind =
  | "jump_efficiency"
  | "execution_quality"
  | "confidence"
  | "risk"
  | "capital"
  | "cargo"
  | "no_units"
  | "no_volume";

export type RadiusCargoBuildBlocker = {
  kind: RadiusCargoBuildBlockerKind;
  actual: number;
  required: number;
  message: string;
  severity: number;
};

export type RadiusRejectedCargoBuild = {
  routeKey: string;
  routeLabel: string;
  totalProfitIsk: number;
  totalCapitalIsk: number;
  totalCargoM3: number;
  cargoFillPercent: number;
  confidencePercent: number;
  executionQuality: number;
  jumps: number;
  iskPerJump: number;
  riskCount: number;
  riskRate: number;
  blockers: RadiusCargoBuildBlocker[];
  suggestedAction: RadiusCargoBuildSuggestedAction;
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
  optimizerMode?: RadiusCargoBuildOptimizerMode;
};

export type BuildRadiusCargoBuildsResult = {
  builds: RadiusCargoBuild[];
  diagnostics: RadiusCargoBuildDiagnostics;
  rejectedBuilds: RadiusRejectedCargoBuild[];
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

function upsertBlocker(
  blockers: Map<RadiusCargoBuildBlockerKind, RadiusCargoBuildBlocker>,
  blocker: RadiusCargoBuildBlocker,
): void {
  const existing = blockers.get(blocker.kind);
  if (!existing || blocker.severity < existing.severity) blockers.set(blocker.kind, blocker);
}

function suggestedActionForBlockers(
  blockers: RadiusCargoBuildBlocker[],
): RadiusCargoBuildSuggestedAction {
  if (blockers.some((blocker) => blocker.kind === "capital")) return "increase_capital";
  if (blockers.some((blocker) => blocker.kind === "cargo")) return "increase_cargo";
  if (blockers.some((blocker) => blocker.kind === "no_units" || blocker.kind === "no_volume")) {
    return "trim_lines";
  }
  if (
    blockers.some((blocker) =>
      blocker.kind === "jump_efficiency" ||
      blocker.kind === "execution_quality" ||
      blocker.kind === "confidence" ||
      blocker.kind === "risk",
    )
  ) {
    return "relax_preset";
  }
  return "skip";
}

function blockerSeverityTotal(blockers: RadiusCargoBuildBlocker[]): number {
  if (blockers.length === 0) return Number.POSITIVE_INFINITY;
  return blockers.reduce((sum, blocker) => sum + blocker.severity, 0);
}

export function explicitRouteJumps(
  picked: FlipResult[],
  aggregate?: RouteAggregateMetrics,
): number {
  const explicit = picked
    .map((row) => Number(row.TotalJumps))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (explicit.length > 0) {
    return Math.max(1, Math.round(explicit.reduce((sum, value) => sum + value, 0) / explicit.length));
  }
  const aggregateJumpHint = aggregate?.dailyIskPerJump && aggregate.dailyIskPerJump > 0
    ? aggregate.routeTotalProfit / aggregate.dailyIskPerJump
    : 0;
  if (Number.isFinite(aggregateJumpHint) && aggregateJumpHint > 0) {
    return Math.max(1, Math.round(aggregateJumpHint));
  }
  return 1;
}

export function buildRadiusCargoBuilds(
  input: BuildRadiusCargoBuildsInput,
): BuildRadiusCargoBuildsResult {
  // Integration point: ScanResultsTable cargo optimizer mode selector routes all ranked builds through this entrypoint.
  const {
    rows,
    routeAggregateMetricsByRoute,
    preset,
    maxBuilds = 10,
    optimizerMode = "balanced_score",
  } = input;
  const diagnostics = createRadiusCargoBuildDiagnostics(rows.length);
  if (rows.length === 0) return { builds: [], diagnostics, rejectedBuilds: [] };

  const grouped = new Map<string, FlipResult[]>();
  for (const row of rows) {
    const key = routeGroupKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const builds: RadiusCargoBuild[] = [];
  const rejectedBuilds: RadiusRejectedCargoBuild[] = [];
  for (const [routeKey, routeRows] of grouped.entries()) {
    const aggregate = routeAggregateMetricsByRoute[routeKey];
    const lineCandidates: Array<{
      row: FlipResult;
      requestedUnits: number;
      volumePerUnit: number;
      buyPrice: number;
      profitPerUnit: number;
      sellPrice: number;
      confidence: number;
      execution: number;
      score: number;
      iskPerM3: number;
      profitQuality: number;
    }> = [];

    const lines: RadiusCargoBuildLine[] = [];
    let usedCargo = 0;
    let usedCapital = 0;
    let totalProfit = 0;
    let grossSell = 0;
    let weightedConfidence = 0;
    let weightedExecution = 0;
    let weightTotal = 0;
    const blockers = new Map<RadiusCargoBuildBlockerKind, RadiusCargoBuildBlocker>();

    // Deterministic filter sequence:
    // 1) data validity -> 2) execution quality -> 3) confidence
    // 4) jump efficiency (route-level) -> 5) risk (route-level) -> 6) capacity/capital allocation.
    for (const row of routeRows) {
      const requestedUnits = Math.max(0, Math.floor(requestedUnitsForFlip(row) || row.UnitsToBuy || 0));
      if (requestedUnits <= 0) {
        diagnostics.skippedNoUnits += 1;
        upsertBlocker(blockers, {
          kind: "no_units",
          actual: requestedUnits,
          required: 1,
          message: "No actionable units were available for this line.",
          severity: 3,
        });
        continue;
      }

      // 1) Data validity
      const volumePerUnit = Number(row.Volume ?? 0);
      const buyPrice = Math.max(0, row.ExpectedBuyPrice ?? row.BuyPrice ?? 0);
      const profitPerUnit = Math.max(0, row.ProfitPerUnit ?? 0);
      const sellPrice = Math.max(0, row.SellPrice ?? 0);
      const profitQuality = Math.max(
        0,
        row.RealProfit ?? row.ExpectedProfit ?? row.TotalProfit ?? row.ProfitPerUnit ?? 0,
      );
      if (volumePerUnit < 0) {
        diagnostics.skippedNoVolume += 1;
        upsertBlocker(blockers, {
          kind: "no_volume",
          actual: volumePerUnit,
          required: 0.01,
          message: "At least one line has invalid (negative) volume metadata.",
          severity: 3,
        });
        continue;
      }
      if (buyPrice <= 0) {
        diagnostics.skippedNoCapital += 1;
        upsertBlocker(blockers, {
          kind: "capital",
          actual: buyPrice,
          required: 1,
          message: "Buy cost data is missing, so capital sizing cannot be computed.",
          severity: 3,
        });
        continue;
      }
      if (profitPerUnit <= 0 || profitQuality <= 0) {
        diagnostics.skippedNoUnits += 1;
        upsertBlocker(blockers, {
          kind: "no_units",
          actual: Math.max(profitPerUnit, profitQuality),
          required: 1,
          message: "Profit signal is non-positive, so the line is not actionable.",
          severity: 2,
        });
        continue;
      }

      // 2) Execution quality
      const execution = executionQualityForFlip(row).score;
      if (execution < preset.minExecutionQuality) {
        diagnostics.skippedExecutionQuality += 1;
        upsertBlocker(blockers, {
          kind: "execution_quality",
          actual: execution,
          required: preset.minExecutionQuality,
          message: "Execution quality is below the active preset threshold.",
          severity: 2,
        });
        continue;
      }

      // 3) Confidence
      const confidence = Math.max(0, Math.min(100, row.CanFill ? 100 : (row.FilledQty ?? 0) > 0 ? 60 : 30));
      if (confidence < preset.minConfidencePercent) {
        diagnostics.skippedConfidence += 1;
        upsertBlocker(blockers, {
          kind: "confidence",
          actual: confidence,
          required: preset.minConfidencePercent,
          message: "Confidence is below the required fill confidence gate.",
          severity: 2,
        });
        continue;
      }

      const score = scoreRadiusCargoLine({
        row,
        aggregate,
        profitPerUnit,
        volumePerUnit,
        confidence,
        execution,
        buyPrice,
      });
      const iskPerM3 = volumePerUnit > 0 ? profitPerUnit / volumePerUnit : 0;
      lineCandidates.push({
        row,
        requestedUnits,
        volumePerUnit,
        buyPrice,
        profitPerUnit,
        sellPrice,
        confidence,
        execution,
        score,
        iskPerM3,
        profitQuality,
      });
    }

    const normalizeCandidateProfit = createMetricNormalizer(lineCandidates.map((candidate) => candidate.profitPerUnit));
    const normalizeCandidateVolume = createMetricNormalizer(lineCandidates.map((candidate) => candidate.volumePerUnit), true);
    const normalizeCandidateJumps = createMetricNormalizer(lineCandidates.map((candidate) => candidate.row.TotalJumps), true);
    const normalizeCandidateQuality = createMetricNormalizer(lineCandidates.map((candidate) => candidate.execution));
    const normalizeCandidateRisk = createMetricNormalizer(lineCandidates.map(() => aggregate?.riskTotalCount ?? 0), true);

    const orderedRows = [...lineCandidates].sort((a, b) => {
      if (optimizerMode === "greedy_profit") {
        if (b.profitPerUnit !== a.profitPerUnit) return b.profitPerUnit - a.profitPerUnit;
      } else if (optimizerMode === "bounded_knapsack") {
        const leftValueDensity = a.score / Math.max(1, a.buyPrice + a.volumePerUnit * 1_000);
        const rightValueDensity = b.score / Math.max(1, b.buyPrice + b.volumePerUnit * 1_000);
        if (rightValueDensity !== leftValueDensity) return rightValueDensity - leftValueDensity;
        if (b.score !== a.score) return b.score - a.score;
      } else if (optimizerMode === "greedy_isk_per_m3") {
        if (b.iskPerM3 !== a.iskPerM3) return b.iskPerM3 - a.iskPerM3;
      } else {
        if (b.score !== a.score) return b.score - a.score;
        const leftNormalized =
          normalizeCandidateProfit(a.profitPerUnit) * 0.4 +
          normalizeCandidateVolume(a.volumePerUnit) * 0.1 +
          normalizeCandidateJumps(a.row.TotalJumps) * 0.15 +
          normalizeCandidateQuality(a.execution) * 0.25 +
          normalizeCandidateRisk(aggregate?.riskTotalCount ?? 0) * 0.1;
        const rightNormalized =
          normalizeCandidateProfit(b.profitPerUnit) * 0.4 +
          normalizeCandidateVolume(b.volumePerUnit) * 0.1 +
          normalizeCandidateJumps(b.row.TotalJumps) * 0.15 +
          normalizeCandidateQuality(b.execution) * 0.25 +
          normalizeCandidateRisk(aggregate?.riskTotalCount ?? 0) * 0.1;
        if (rightNormalized !== leftNormalized) return rightNormalized - leftNormalized;
      }
      if (b.profitPerUnit !== a.profitPerUnit) return b.profitPerUnit - a.profitPerUnit;
      if (a.row.TotalJumps !== b.row.TotalJumps) return a.row.TotalJumps - b.row.TotalJumps;
      return a.row.TypeName.localeCompare(b.row.TypeName);
    });

    for (const candidate of orderedRows) {
      const remainingCargo = Math.max(0, preset.cargoCapacityM3 - usedCargo);
      const remainingCapital = Math.max(0, preset.maxCapitalIsk - usedCapital);
      const maxUnitsByCargo = candidate.volumePerUnit > 0
        ? Math.floor(remainingCargo / candidate.volumePerUnit)
        : Number.POSITIVE_INFINITY;
      const maxUnitsByCapital = Math.floor(remainingCapital / candidate.buyPrice);
      const units = Math.min(candidate.requestedUnits, maxUnitsByCargo, maxUnitsByCapital);
      if (units <= 0) {
        if (maxUnitsByCargo <= 0) {
          diagnostics.skippedCargoFull += 1;
          upsertBlocker(blockers, {
            kind: "cargo",
            actual: remainingCargo,
            required: candidate.volumePerUnit,
            message: "Cargo hold is full relative to remaining candidate volume.",
            severity: 1,
          });
        } else {
          diagnostics.skippedCapitalFull += 1;
          upsertBlocker(blockers, {
            kind: "capital",
            actual: remainingCapital,
            required: candidate.buyPrice,
            message: "Remaining capital cannot fund at least one additional unit.",
            severity: 1,
          });
        }
        continue;
      }
      const volume = Math.max(0, units * candidate.volumePerUnit);
      const capital = Math.max(0, units * candidate.buyPrice);
      const profit = Math.max(0, units * candidate.profitPerUnit);
      const partial = units < candidate.requestedUnits;
      if (partial) diagnostics.partialRowsAvailable += 1;
      const grossSellIsk = Math.max(0, units * candidate.sellPrice);

      usedCargo += volume;
      usedCapital += capital;
      totalProfit += profit;
      grossSell += grossSellIsk;
      lines.push({
        row: candidate.row,
        units,
        volumeM3: volume,
        capitalIsk: capital,
        profitIsk: profit,
        grossSellIsk,
        partial,
      });
      const confidenceWeight = candidate.volumePerUnit > 0 ? volume : units;
      weightedConfidence += candidate.confidence * confidenceWeight;
      weightedExecution += candidate.execution * confidenceWeight;
      weightTotal += confidenceWeight;
    }

    const picked = lines.map((line) => line.row);
    const routeLabel = routeRows[0]
      ? `${routeRows[0].BuyStation || routeRows[0].BuySystemName} → ${routeRows[0].SellStation || routeRows[0].SellSystemName}`
      : routeKey;
    const jumps = explicitRouteJumps(picked.length > 0 ? picked : routeRows, aggregate);
    const iskPerJump = totalProfit / Math.max(1, jumps);
    const riskCount = Math.max(0, aggregate?.riskTotalCount ?? 0);
    const riskDenominator = Math.max(1, lineCandidates.length);
    const riskRate = riskCount / riskDenominator;
    const cargoFillPercent = preset.cargoCapacityM3 > 0
      ? clamp((usedCargo / preset.cargoCapacityM3) * 100, 0, 100)
      : 0;
    const confidencePercent = weightTotal > 0 ? weightedConfidence / weightTotal : 0;
    const executionQuality = weightTotal > 0 ? weightedExecution / weightTotal : 0;

    if (lines.length === 0) {
      const blockerList = [...blockers.values()];
      if (blockerList.length > 0) {
        rejectedBuilds.push({
          routeKey,
          routeLabel,
          totalProfitIsk: totalProfit,
          totalCapitalIsk: usedCapital,
          totalCargoM3: usedCargo,
          cargoFillPercent,
          confidencePercent,
          executionQuality,
          jumps,
          iskPerJump,
          riskCount,
          riskRate,
          blockers: blockerList,
          suggestedAction: suggestedActionForBlockers(blockerList),
        });
      }
      continue;
    }
    // 4) Jump efficiency (route-level)
    if (iskPerJump < preset.minJumpEfficiencyIsk) {
      diagnostics.skippedJumpEfficiency += 1;
      upsertBlocker(blockers, {
        kind: "jump_efficiency",
        actual: iskPerJump,
        required: preset.minJumpEfficiencyIsk,
        message: "Route ISK per jump is below the configured floor.",
        severity: 1,
      });
      const blockerList = [...blockers.values()];
      rejectedBuilds.push({
        routeKey,
        routeLabel,
        totalProfitIsk: totalProfit,
        totalCapitalIsk: usedCapital,
        totalCargoM3: usedCargo,
        cargoFillPercent,
        confidencePercent,
        executionQuality,
        jumps,
        iskPerJump,
        riskCount,
        riskRate,
        blockers: blockerList,
        suggestedAction: suggestedActionForBlockers(blockerList),
      });
      continue;
    }

    // 5) Risk gating (route-level): keep absolute count + optional density check.
    if (riskCount > preset.maxRiskCount) {
      diagnostics.skippedRisk += 1;
      upsertBlocker(blockers, {
        kind: "risk",
        actual: riskCount,
        required: preset.maxRiskCount,
        message: "Risk count exceeds the preset maximum.",
        severity: 1,
      });
      const blockerList = [...blockers.values()];
      rejectedBuilds.push({
        routeKey,
        routeLabel,
        totalProfitIsk: totalProfit,
        totalCapitalIsk: usedCapital,
        totalCargoM3: usedCargo,
        cargoFillPercent,
        confidencePercent,
        executionQuality,
        jumps,
        iskPerJump,
        riskCount,
        riskRate,
        blockers: blockerList,
        suggestedAction: suggestedActionForBlockers(blockerList),
      });
      continue;
    }
    if (typeof preset.maxRiskRate === "number" && riskRate > preset.maxRiskRate) {
      diagnostics.skippedRisk += 1;
      upsertBlocker(blockers, {
        kind: "risk",
        actual: riskRate,
        required: preset.maxRiskRate,
        message: "Risk density exceeds the allowed risk rate.",
        severity: 1,
      });
      const blockerList = [...blockers.values()];
      rejectedBuilds.push({
        routeKey,
        routeLabel,
        totalProfitIsk: totalProfit,
        totalCapitalIsk: usedCapital,
        totalCargoM3: usedCargo,
        cargoFillPercent,
        confidencePercent,
        executionQuality,
        jumps,
        iskPerJump,
        riskCount,
        riskRate,
        blockers: blockerList,
        suggestedAction: suggestedActionForBlockers(blockerList),
      });
      continue;
    }
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
      routeLabel,
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

  const normalizeBuildProfit = createMetricNormalizer(builds.map((build) => build.totalProfitIsk));
  const normalizeBuildVolume = createMetricNormalizer(builds.map((build) => build.totalCargoM3));
  const normalizeBuildJumps = createMetricNormalizer(builds.map((build) => build.jumps), true);
  const normalizeBuildQuality = createMetricNormalizer(builds.map((build) => build.executionQuality));
  const normalizeBuildRisk = createMetricNormalizer(builds.map((build) => build.riskCount), true);

  const rankedBuilds = builds
    .sort((left, right) => {
      const leftComposite = finiteNumber(
        normalizeBuildProfit(left.totalProfitIsk) * 0.35 +
          normalizeBuildVolume(left.totalCargoM3) * 0.15 +
          normalizeBuildJumps(left.jumps) * 0.15 +
          normalizeBuildQuality(left.executionQuality) * 0.2 +
          normalizeBuildRisk(left.riskCount) * 0.15,
        0,
      );
      const rightComposite = finiteNumber(
        normalizeBuildProfit(right.totalProfitIsk) * 0.35 +
          normalizeBuildVolume(right.totalCargoM3) * 0.15 +
          normalizeBuildJumps(right.jumps) * 0.15 +
          normalizeBuildQuality(right.executionQuality) * 0.2 +
          normalizeBuildRisk(right.riskCount) * 0.15,
        0,
      );
      return combineComparators<RadiusCargoBuild>(
        () => compareNumberDesc(leftComposite, rightComposite),
        (a, b) => compareNumberDesc(a.finalScore, b.finalScore),
        (a, b) => compareNumberDesc(a.totalProfitIsk, b.totalProfitIsk),
        (a, b) => compareNumberDesc(a.cargoFillPercent, b.cargoFillPercent),
        (a, b) => compareTextAsc(a.routeKey, b.routeKey),
      )(left, right);
    })
    .slice(0, Math.max(1, maxBuilds));

  const rankedRejectedBuilds = rejectedBuilds
    .sort((left, right) => {
      return combineComparators<RadiusRejectedCargoBuild>(
        (a, b) => compareNumberDesc(a.totalProfitIsk, b.totalProfitIsk),
        (a, b) => compareNumberDesc(a.cargoFillPercent, b.cargoFillPercent),
        (a, b) => compareNumberAsc(blockerSeverityTotal(a.blockers), blockerSeverityTotal(b.blockers)),
        (a, b) => compareTextAsc(a.routeKey, b.routeKey),
      )(left, right);
    })
    .slice(0, 5);

  return { builds: rankedBuilds, diagnostics, rejectedBuilds: rankedRejectedBuilds };
}
