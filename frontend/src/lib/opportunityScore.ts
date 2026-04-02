import type { ContractResult, FlipResult, StationTrade } from "@/lib/types";

export type OpportunityFactor = "profit" | "risk" | "velocity" | "jumps" | "capital";

export interface OpportunityWeightProfile {
  profit?: number;
  risk?: number;
  velocity?: number;
  jumps?: number;
  capital?: number;
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
  profit: number | null;
  risk: number | null;
  velocity: number | null;
  jumps: number | null;
  capital: number | null;
}

const DEFAULT_BALANCED_WEIGHTS: NormalizedWeights = {
  profit: 0.34,
  risk: 0.2,
  velocity: 0.2,
  jumps: 0.13,
  capital: 0.13,
};

const FACTOR_ORDER: OpportunityFactor[] = ["profit", "risk", "velocity", "jumps", "capital"];

const RISK_MISSING_RAW = 0.65;
const JUMPS_MISSING_RAW = 14;
const CAPITAL_MISSING_RAW = 350_000_000;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
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

export function normalizeWeights(profile?: OpportunityWeightProfile): NormalizedWeights {
  const raw: Record<OpportunityFactor, number> = {
    profit: Math.max(0, profile?.profit ?? DEFAULT_BALANCED_WEIGHTS.profit),
    risk: Math.max(0, profile?.risk ?? DEFAULT_BALANCED_WEIGHTS.risk),
    velocity: Math.max(0, profile?.velocity ?? DEFAULT_BALANCED_WEIGHTS.velocity),
    jumps: Math.max(0, profile?.jumps ?? DEFAULT_BALANCED_WEIGHTS.jumps),
    capital: Math.max(0, profile?.capital ?? DEFAULT_BALANCED_WEIGHTS.capital),
  };

  const total = FACTOR_ORDER.reduce((sum, factor) => sum + raw[factor], 0);
  if (total <= 0) {
    return { ...DEFAULT_BALANCED_WEIGHTS };
  }

  return FACTOR_ORDER.reduce((acc, factor) => {
    acc[factor] = raw[factor] / total;
    return acc;
  }, {} as NormalizedWeights);
}

/**
 * Creates a compact rationale sentence from scored contributions.
 */
export function explainOpportunityScore(explanation: OpportunityExplanation): string {
  const positives = explanation.topPositives
    .filter((item) => item.normalized > 55)
    .map((item) => item.factor)
    .slice(0, 2);

  const penalties = explanation.topPenalties
    .filter((item) => item.normalized < 45)
    .map((item) => item.factor)
    .slice(0, 2);

  if (positives.length === 0 && penalties.length === 0) {
    return `Balanced profile with no standout strengths or penalties (score ${explanation.finalScore.toFixed(1)}).`;
  }

  const positiveText = positives.length > 0 ? `Strengths: ${positives.join(" + ")}` : "No major strengths";
  const penaltyText = penalties.length > 0 ? `Penalties: ${penalties.join(" + ")}` : "No major penalties";
  return `${positiveText}. ${penaltyText}.`;
}

function rankContribution(factor: FactorComputation): number {
  return (factor.normalized - 50) * factor.weight;
}

function computeFromMetrics(metrics: FactorMetricSet, profile?: OpportunityWeightProfile): OpportunityExplanation {
  const weights = normalizeWeights(profile);

  const normalizedByFactor: Record<OpportunityFactor, number> = {
    // Missing profit uses neutral midpoint (50), because unknown profitability should not over-penalize.
    profit:
      metrics.profit == null
        ? 50
        : normalizeTo100(Math.max(0, metrics.profit), { min: 0, max: 120_000_000, curve: "log" }),
    // Missing risk uses conservative penalty (assume somewhat risky).
    risk: normalizeTo100(metrics.risk ?? RISK_MISSING_RAW, { min: 0, max: 1, invert: true, curve: "linear" }),
    // Missing velocity uses neutral midpoint (50) to avoid bias toward/against sparse rows.
    velocity:
      metrics.velocity == null
        ? 50
        : normalizeTo100(Math.max(0, metrics.velocity), { min: 0, max: 120, curve: "sqrt" }),
    // Missing jumps uses conservative penalty (assume longer route burden).
    jumps: normalizeTo100(metrics.jumps ?? JUMPS_MISSING_RAW, { min: 0, max: 40, invert: true, curve: "sqrt" }),
    // Missing capital uses conservative penalty (assume meaningful capital lockup).
    capital: normalizeTo100(Math.max(0, metrics.capital ?? CAPITAL_MISSING_RAW), {
      min: 1_000_000,
      max: 2_000_000_000,
      invert: true,
      curve: "log",
    }),
  };

  const factors = FACTOR_ORDER.reduce((acc, factor) => {
    const normalized = normalizedByFactor[factor];
    const weight = weights[factor];
    acc[factor] = {
      factor,
      rawMetric: metrics[factor],
      normalized,
      weight,
      contribution: normalized * weight,
    };
    return acc;
  }, {} as Record<OpportunityFactor, FactorComputation>);

  const allFactors = Object.values(factors);
  const finalScore = allFactors.reduce((sum, item) => sum + item.contribution, 0);

  return {
    finalScore,
    factors,
    topPositives: [...allFactors].sort((a, b) => rankContribution(b) - rankContribution(a)).slice(0, 2),
    topPenalties: [...allFactors].sort((a, b) => rankContribution(a) - rankContribution(b)).slice(0, 2),
  };
}

export function flipResultMetrics(row: FlipResult): FactorMetricSet {
  const profit = row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? row.DailyProfit ?? null;
  const risk = row.IsHighRiskFlag ? 0.85 : Math.min(1, Math.max(0, (row.BuyCompetitors + row.SellCompetitors) / 20));
  const velocity = row.DayTargetDemandPerDay ?? row.S2BPerDay ?? row.BfSPerDay ?? row.DailyVolume ?? row.Velocity ?? null;
  const jumps = row.TotalJumps ?? (((row.BuyJumps ?? 0) + (row.SellJumps ?? 0)) || null);
  const units = row.UnitsToBuy ?? 0;
  const buyPrice = row.ExpectedBuyPrice ?? row.BuyPrice ?? 0;
  const capital = row.DayCapitalRequired ?? (units > 0 && buyPrice > 0 ? units * buyPrice : null);

  return { profit, risk, velocity, jumps, capital };
}

export function stationTradeMetrics(row: StationTrade): FactorMetricSet {
  const profit = row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? row.RealizableDailyProfit ?? null;
  const risk = row.IsHighRiskFlag ? 0.9 : Math.min(1, Math.max(0, (row.PVI + row.OBDS) / 200));
  const velocity = row.SellUnitsPerDay ?? row.BuyUnitsPerDay ?? row.DailyVolume ?? null;
  const jumps = 0;
  const capital = row.CapitalRequired > 0 ? row.CapitalRequired : null;

  return { profit, risk, velocity, jumps, capital };
}

export function contractResultMetrics(row: ContractResult): FactorMetricSet {
  const profit = row.ExpectedProfit ?? row.Profit ?? null;
  const confidence = row.SellConfidence == null ? null : clamp(row.SellConfidence, 0, 1);
  const liquidationPressure = row.EstLiquidationDays == null ? null : clamp(row.EstLiquidationDays / 30, 0, 1);
  const risk = confidence == null && liquidationPressure == null
    ? null
    : clamp((liquidationPressure ?? 0.5) * 0.6 + (1 - (confidence ?? 0.5)) * 0.4, 0, 1);
  const velocity = row.EstLiquidationDays == null ? null : 30 / Math.max(1, row.EstLiquidationDays);
  const jumps = row.LiquidationJumps ?? row.Jumps ?? null;
  const capital = row.Price > 0 ? row.Price : null;

  return { profit, risk, velocity, jumps, capital };
}

export function scoreFlipResult(row: FlipResult, profile?: OpportunityWeightProfile): OpportunityExplanation {
  return computeFromMetrics(flipResultMetrics(row), profile);
}

export function scoreStationTrade(row: StationTrade, profile?: OpportunityWeightProfile): OpportunityExplanation {
  return computeFromMetrics(stationTradeMetrics(row), profile);
}

export function scoreContractResult(row: ContractResult, profile?: OpportunityWeightProfile): OpportunityExplanation {
  return computeFromMetrics(contractResultMetrics(row), profile);
}
