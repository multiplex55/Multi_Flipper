import { executionQualityForFlip } from "@/lib/executionQuality";
import type { ContractResult, FlipResult, StationTrade, StrategyScoreConfig } from "@/lib/types";

export type OpportunityFactor =
  | "expectedProfit"
  | "dailyRealizableProfit"
  | "executionQuality"
  | "jumpBurden"
  | "capitalEfficiency"
  | "cargoEfficiency"
  | "marketStability";

export interface OpportunityWeightProfile {
  profit?: number;
  risk?: number;
  velocity?: number;
  jumps?: number;
  capital?: number;
}

export function strategyScoreToOpportunityProfile(
  strategyScore?: StrategyScoreConfig,
): OpportunityWeightProfile | undefined {
  if (!strategyScore) return undefined;
  return {
    profit: strategyScore.profit_weight,
    risk: strategyScore.risk_weight,
    velocity: strategyScore.velocity_weight,
    jumps: strategyScore.jump_weight,
    capital: strategyScore.capital_weight,
  };
}

export type NormalizedWeights = Record<OpportunityFactor, number>;

export interface NormalizeTo100Options {
  min: number;
  max: number;
  invert?: boolean;
  curve?: "linear" | "sqrt" | "log";
}

export interface FactorComputation {
  factor: OpportunityFactor;
  rawMetric: number | null;
  normalized: number;
  weight: number;
  contribution: number;
}

export interface OpportunityExplanation {
  finalScore: number;
  factors: Record<OpportunityFactor, FactorComputation>;
  topPositives: FactorComputation[];
  topPenalties: FactorComputation[];
}

interface FactorMetricSet {
  expectedProfit: number | null;
  dailyRealizableProfit: number | null;
  executionQuality: number | null;
  jumpBurden: number | null;
  capitalEfficiency: number | null;
  cargoEfficiency: number | null;
  marketStability: number | null;
}

interface FactorNormalizationConfig {
  floor: number;
  ceiling: number;
  invert?: boolean;
  curve?: "linear" | "sqrt" | "log";
  fallbackNeutral?: number;
  percentileLower: number;
  percentileUpper: number;
  minSpan: number;
}

interface FactorRangeContext {
  low: number;
  high: number;
  floor: number;
  ceiling: number;
}

export interface OpportunityScanContext {
  ranges: Partial<Record<OpportunityFactor, FactorRangeContext>>;
}

const DEFAULT_BALANCED_WEIGHTS: NormalizedWeights = {
  expectedProfit: 0.24,
  dailyRealizableProfit: 0.18,
  executionQuality: 0.16,
  jumpBurden: 0.1,
  capitalEfficiency: 0.12,
  cargoEfficiency: 0.08,
  marketStability: 0.12,
};

const FACTOR_ORDER: OpportunityFactor[] = [
  "expectedProfit",
  "dailyRealizableProfit",
  "executionQuality",
  "jumpBurden",
  "capitalEfficiency",
  "cargoEfficiency",
  "marketStability",
];

const FACTOR_NORMALIZATION: Record<OpportunityFactor, FactorNormalizationConfig> = {
  expectedProfit: {
    floor: 0,
    ceiling: 2_500_000_000,
    curve: "log",
    percentileLower: 0.1,
    percentileUpper: 0.9,
    minSpan: 25_000_000,
  },
  dailyRealizableProfit: {
    floor: 0,
    ceiling: 300_000_000,
    curve: "log",
    percentileLower: 0.1,
    percentileUpper: 0.9,
    minSpan: 5_000_000,
  },
  executionQuality: {
    floor: 0,
    ceiling: 100,
    curve: "linear",
    fallbackNeutral: 50,
    percentileLower: 0.15,
    percentileUpper: 0.9,
    minSpan: 12,
  },
  jumpBurden: {
    floor: 0,
    ceiling: 40,
    invert: true,
    curve: "sqrt",
    percentileLower: 0.1,
    percentileUpper: 0.9,
    minSpan: 3,
  },
  capitalEfficiency: {
    floor: 0,
    ceiling: 2.5,
    curve: "sqrt",
    percentileLower: 0.1,
    percentileUpper: 0.9,
    minSpan: 0.2,
  },
  cargoEfficiency: {
    floor: 0,
    ceiling: 2_000_000,
    curve: "log",
    percentileLower: 0.1,
    percentileUpper: 0.9,
    minSpan: 1000,
  },
  marketStability: {
    floor: 0,
    ceiling: 1,
    curve: "linear",
    percentileLower: 0.1,
    percentileUpper: 0.9,
    minSpan: 0.1,
  },
};

function safeNumber(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const pos = clamp(p, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const t = pos - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * t;
}

/**
 * Normalizes a value into a 0..100 score.
 *
 * Curves:
 * - linear: no damping
 * - sqrt: dampens high-end values in heavy-tail distributions
 * - log: stronger heavy-tail damping for very large outliers
 */
export function normalizeTo100(value: number, options: NormalizeTo100Options): number {
  const { min, max, invert = false, curve = "linear" } = options;
  if (!Number.isFinite(value) || max <= min) {
    return 50;
  }

  const bounded = clamp(value, min, max);
  const ratio = (bounded - min) / (max - min);

  let curved = ratio;
  if (curve === "sqrt") {
    curved = Math.sqrt(ratio);
  } else if (curve === "log") {
    curved = Math.log1p(ratio * 99) / Math.log(100);
  }

  const score = (invert ? 1 - curved : curved) * 100;
  return clamp(score, 0, 100);
}

function mapLegacyProfile(profile?: OpportunityWeightProfile): Record<OpportunityFactor, number> {
  const p = Math.max(0, profile?.profit ?? 34);
  const r = Math.max(0, profile?.risk ?? 20);
  const v = Math.max(0, profile?.velocity ?? 20);
  const j = Math.max(0, profile?.jumps ?? 13);
  const c = Math.max(0, profile?.capital ?? 13);

  return {
    expectedProfit: p * 0.72 + v * 0.1,
    dailyRealizableProfit: p * 0.18 + v * 0.62 + c * 0.06,
    executionQuality: r * 0.5 + v * 0.25 + p * 0.1,
    jumpBurden: j * 0.78 + r * 0.12,
    capitalEfficiency: c * 0.74 + p * 0.18,
    cargoEfficiency: c * 0.35 + j * 0.4 + v * 0.15,
    marketStability: r * 0.72 + v * 0.18 + p * 0.06,
  };
}

export function normalizeWeights(profile?: OpportunityWeightProfile): NormalizedWeights {
  const mapped = mapLegacyProfile(profile);
  const total = FACTOR_ORDER.reduce((sum, factor) => sum + mapped[factor], 0);
  if (total <= 0) {
    return { ...DEFAULT_BALANCED_WEIGHTS };
  }

  return FACTOR_ORDER.reduce((acc, factor) => {
    acc[factor] = mapped[factor] / total;
    return acc;
  }, {} as NormalizedWeights);
}

export function buildOpportunityScanContext(metricRows: FactorMetricSet[]): OpportunityScanContext {
  const ranges: Partial<Record<OpportunityFactor, FactorRangeContext>> = {};

  for (const factor of FACTOR_ORDER) {
    const cfg = FACTOR_NORMALIZATION[factor];
    const rawValues = metricRows
      .map((row) => safeNumber(row[factor]))
      .filter((v): v is number => v != null)
      .map((v) => clamp(v, cfg.floor, cfg.ceiling));

    if (rawValues.length < 2) continue;

    let low = percentile(rawValues, cfg.percentileLower);
    let high = percentile(rawValues, cfg.percentileUpper);

    if (!Number.isFinite(low) || !Number.isFinite(high)) continue;
    if (high < low) {
      [low, high] = [high, low];
    }

    if (high - low < cfg.minSpan) {
      const mid = (high + low) / 2;
      low = clamp(mid - cfg.minSpan / 2, cfg.floor, cfg.ceiling);
      high = clamp(mid + cfg.minSpan / 2, cfg.floor, cfg.ceiling);
      if (high - low < cfg.minSpan) {
        low = cfg.floor;
        high = cfg.ceiling;
      }
    }

    ranges[factor] = { low, high, floor: cfg.floor, ceiling: cfg.ceiling };
  }

  return { ranges };
}

function scoreFactor(
  value: number | null,
  factor: OpportunityFactor,
  context?: OpportunityScanContext,
): number {
  const cfg = FACTOR_NORMALIZATION[factor];
  if (value == null) {
    return cfg.fallbackNeutral ?? 50;
  }

  const bounded = clamp(value, cfg.floor, cfg.ceiling);
  const range = context?.ranges[factor];
  const min = range ? range.low : cfg.floor;
  const max = range ? range.high : cfg.ceiling;

  return normalizeTo100(bounded, {
    min,
    max,
    invert: cfg.invert,
    curve: cfg.curve ?? "linear",
  });
}

/**
 * Creates a compact rationale sentence from scored contributions.
 */
export function explainOpportunityScore(explanation: OpportunityExplanation): string {
  const positives = explanation.topPositives
    .filter((item) => item.contribution > 0)
    .map((item) => item.factor)
    .slice(0, 2);

  const penalties = explanation.topPenalties
    .filter((item) => item.contribution < 0)
    .map((item) => item.factor)
    .slice(0, 2);

  if (positives.length === 0 && penalties.length === 0) {
    return `No standout strengths or weaknesses (score ${explanation.finalScore.toFixed(1)}).`;
  }

  const positiveText = positives.length > 0 ? `High: ${positives.join(" + ")}` : "No strong positives";
  const penaltyText = penalties.length > 0 ? `Low: ${penalties.join(" + ")}` : "No notable penalties";
  return `${positiveText}. ${penaltyText}.`;
}

function computeFromMetrics(
  metrics: FactorMetricSet,
  profile?: OpportunityWeightProfile,
  context?: OpportunityScanContext,
): OpportunityExplanation {
  const weights = normalizeWeights(profile);

  const factors = FACTOR_ORDER.reduce((acc, factor) => {
    const normalized = scoreFactor(metrics[factor], factor, context);
    const weight = weights[factor];
    const contribution = (normalized - 50) * weight;
    acc[factor] = {
      factor,
      rawMetric: metrics[factor],
      normalized,
      weight,
      contribution,
    };
    return acc;
  }, {} as Record<OpportunityFactor, FactorComputation>);

  const allFactors = Object.values(factors);
  const finalScore = clamp(50 + allFactors.reduce((sum, item) => sum + item.contribution, 0), 0, 100);

  return {
    finalScore,
    factors,
    topPositives: [...allFactors]
      .filter((factor) => factor.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3),
    topPenalties: [...allFactors]
      .filter((factor) => factor.contribution < 0)
      .sort((a, b) => a.contribution - b.contribution)
      .slice(0, 3),
  };
}

export function flipResultMetrics(row: FlipResult): FactorMetricSet {
  const expectedProfit = safeNumber(row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? row.DailyProfit);
  const dailyRealizableProfit = safeNumber(row.DayNowProfit ?? row.DailyProfit ?? row.RealProfit);
  const executionQuality = executionQualityForFlip(row).score;
  const jumpBurden = safeNumber(row.TotalJumps ?? ((row.BuyJumps ?? 0) + (row.SellJumps ?? 0)));

  const units = row.UnitsToBuy ?? 0;
  const buyPrice = row.ExpectedBuyPrice ?? row.BuyPrice ?? 0;
  const capital = row.DayCapitalRequired ?? (units > 0 && buyPrice > 0 ? units * buyPrice : null);
  const capitalEfficiency =
    expectedProfit != null && capital != null && capital > 0 ? clamp(expectedProfit / capital, 0, 10) : null;

  const perUnitProfit = row.ProfitPerUnit ?? (expectedProfit != null && units > 0 ? expectedProfit / units : null);
  const perM3 = perUnitProfit != null && row.Volume > 0 ? perUnitProfit / row.Volume : null;
  const cargoEfficiency = safeNumber(
    row.DayIskPerM3Jump ??
      (perM3 != null ? perM3 / Math.max(1, jumpBurden ?? 1) : null),
  );

  const competitorRisk = Math.min(1, Math.max(0, (row.BuyCompetitors + row.SellCompetitors) / 20));
  const slippageRisk = Math.min(
    1,
    Math.max(0, ((row.SlippageBuyPct ?? 0) + (row.SlippageSellPct ?? 0)) / 30),
  );
  const risk = clamp(competitorRisk * 0.7 + slippageRisk * 0.3, 0, 1);
  const marketStability = 1 - risk;

  return {
    expectedProfit,
    dailyRealizableProfit,
    executionQuality,
    jumpBurden,
    capitalEfficiency,
    cargoEfficiency,
    marketStability,
  };
}

export function stationTradeMetrics(row: StationTrade): FactorMetricSet {
  const expectedProfit = safeNumber(row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? row.RealizableDailyProfit);
  const dailyRealizableProfit = safeNumber(
    row.RealizableDailyProfit ?? row.DailyProfit ?? row.TheoreticalDailyProfit ?? row.RealProfit,
  );
  const marketRisk = row.IsHighRiskFlag ? 0.9 : Math.min(1, Math.max(0, (row.PVI + row.OBDS) / 200));
  const executionQuality = clamp(100 - marketRisk * 85, 0, 100);
  const jumpBurden = 0;
  const capitalEfficiency =
    expectedProfit != null && row.CapitalRequired > 0 ? clamp(expectedProfit / row.CapitalRequired, 0, 10) : null;
  const cargoEfficiency =
    row.Volume > 0 && expectedProfit != null ? clamp((expectedProfit / Math.max(1, row.Volume)) / 1000, 0, 5_000_000) : null;
  const marketStability = 1 - marketRisk;

  return {
    expectedProfit,
    dailyRealizableProfit,
    executionQuality,
    jumpBurden,
    capitalEfficiency,
    cargoEfficiency,
    marketStability,
  };
}

export function contractResultMetrics(row: ContractResult): FactorMetricSet {
  const expectedProfit = safeNumber(row.ExpectedProfit ?? row.Profit);
  const liquidationDays = safeNumber(row.EstLiquidationDays);
  const dailyRealizableProfit =
    expectedProfit != null
      ? expectedProfit / Math.max(1, liquidationDays ?? 14)
      : null;
  const confidence = row.SellConfidence == null ? 0.5 : clamp(row.SellConfidence, 0, 1);
  const liquidationPressure = liquidationDays == null ? 0.5 : clamp(liquidationDays / 30, 0, 1);
  const executionQuality = clamp((confidence * 0.7 + (1 - liquidationPressure) * 0.3) * 100, 0, 100);
  const jumpBurden = safeNumber(row.LiquidationJumps ?? row.Jumps);
  const capitalEfficiency = expectedProfit != null && row.Price > 0 ? clamp(expectedProfit / row.Price, 0, 10) : null;
  const cargoEfficiency = expectedProfit != null && row.Volume > 0
    ? clamp((expectedProfit / row.Volume) / Math.max(1, jumpBurden ?? 1), 0, 10_000_000)
    : null;
  const marketStability = clamp(confidence * (1 - liquidationPressure * 0.8), 0, 1);

  return {
    expectedProfit,
    dailyRealizableProfit,
    executionQuality,
    jumpBurden,
    capitalEfficiency,
    cargoEfficiency,
    marketStability,
  };
}

export function buildFlipScoreContext(rows: FlipResult[]): OpportunityScanContext {
  return buildOpportunityScanContext(rows.map((row) => flipResultMetrics(row)));
}

export function buildStationScoreContext(rows: StationTrade[]): OpportunityScanContext {
  return buildOpportunityScanContext(rows.map((row) => stationTradeMetrics(row)));
}

export function buildContractScoreContext(rows: ContractResult[]): OpportunityScanContext {
  return buildOpportunityScanContext(rows.map((row) => contractResultMetrics(row)));
}

export function scoreFlipResult(
  row: FlipResult,
  profile?: OpportunityWeightProfile,
  context?: OpportunityScanContext,
): OpportunityExplanation {
  return computeFromMetrics(flipResultMetrics(row), profile, context);
}

export function scoreStationTrade(
  row: StationTrade,
  profile?: OpportunityWeightProfile,
  context?: OpportunityScanContext,
): OpportunityExplanation {
  return computeFromMetrics(stationTradeMetrics(row), profile, context);
}

export function scoreContractResult(
  row: ContractResult,
  profile?: OpportunityWeightProfile,
  context?: OpportunityScanContext,
): OpportunityExplanation {
  return computeFromMetrics(contractResultMetrics(row), profile, context);
}
