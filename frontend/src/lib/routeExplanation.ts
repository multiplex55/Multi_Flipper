import { safeNumber } from "@/lib/batchMetrics";

export type RouteDecisionLens =
  | "recommended"
  | "best_route_pack"
  | "fastest_isk"
  | "cargo"
  | "safest"
  | "capital_efficient";

export type RouteExplanationInput = {
  routeKey: string;
  routeLabel: string;
  recommendationScore: number;
  dailyIskPerJump: number;
  realIskPerJump?: number;
  realIskPerM3PerJump?: number;
  totalProfit: number;
  confidenceScore: number;
  executionQuality: number;
  weightedSlippagePct: number;
  turnoverDays: number | null;
  cargoUsePercent: number | null;
  capitalEfficiency?: number | null;
  riskCount: number;
  staleVerificationPenalty?: number;
  missingVerification?: boolean;
  thinDepthCount?: number;
  exitOverhangDays?: number | null;
  jumpBurden?: number | null;
};

export type RouteFactorKey =
  | "profit"
  | "d_per_jump"
  | "volume_efficiency"
  | "capital_efficiency"
  | "confidence"
  | "execution_quality"
  | "deadhead_risk"
  | "stale_verification_penalty";

export type RouteFactorExplanation = {
  key: RouteFactorKey;
  label: string;
  normalized: number;
  weighted: number;
  direction: "positive" | "negative";
};

export type RouteDecisionExplanation = {
  routeKey: string;
  routeLabel: string;
  totalScore: number;
  summary: string;
  factors: RouteFactorExplanation[];
  positiveFactors: RouteFactorExplanation[];
  negativeFactors: RouteFactorExplanation[];
  positives: string[];
  warnings: string[];
  recommendedActions: string[];
  lens: RouteDecisionLens;
};

const FACTOR_LABELS: Record<RouteFactorKey, string> = {
  profit: "Profit",
  d_per_jump: "D/J",
  volume_efficiency: "Volume efficiency",
  capital_efficiency: "Capital efficiency",
  confidence: "Confidence",
  execution_quality: "Execution quality",
  deadhead_risk: "Deadhead / risk",
  stale_verification_penalty: "Stale verification",
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lensWeights(lens: RouteDecisionLens): Record<RouteFactorKey, number> {
  switch (lens) {
    case "fastest_isk":
      return { profit: 0.12, d_per_jump: 0.31, volume_efficiency: 0.08, capital_efficiency: 0.1, confidence: 0.13, execution_quality: 0.16, deadhead_risk: 0.08, stale_verification_penalty: 0.02 };
    case "cargo":
      return { profit: 0.11, d_per_jump: 0.14, volume_efficiency: 0.29, capital_efficiency: 0.12, confidence: 0.1, execution_quality: 0.13, deadhead_risk: 0.08, stale_verification_penalty: 0.03 };
    case "safest":
      return { profit: 0.08, d_per_jump: 0.12, volume_efficiency: 0.08, capital_efficiency: 0.09, confidence: 0.23, execution_quality: 0.2, deadhead_risk: 0.17, stale_verification_penalty: 0.03 };
    case "capital_efficient":
      return { profit: 0.11, d_per_jump: 0.12, volume_efficiency: 0.1, capital_efficiency: 0.28, confidence: 0.12, execution_quality: 0.14, deadhead_risk: 0.1, stale_verification_penalty: 0.03 };
    case "best_route_pack":
      return { profit: 0.16, d_per_jump: 0.19, volume_efficiency: 0.1, capital_efficiency: 0.12, confidence: 0.15, execution_quality: 0.15, deadhead_risk: 0.1, stale_verification_penalty: 0.03 };
    case "recommended":
    default:
      return { profit: 0.14, d_per_jump: 0.2, volume_efficiency: 0.12, capital_efficiency: 0.12, confidence: 0.15, execution_quality: 0.16, deadhead_risk: 0.08, stale_verification_penalty: 0.03 };
  }
}

function rawFactors(input: RouteExplanationInput): Record<RouteFactorKey, number> {
  const turnover = input.turnoverDays;
  return {
    profit: clamp01(safeNumber(input.totalProfit) / 300_000_000),
    d_per_jump: clamp01(safeNumber(input.dailyIskPerJump) / 5_000_000),
    volume_efficiency: clamp01((safeNumber(input.cargoUsePercent ?? 45) - 20) / 80),
    capital_efficiency: turnover && turnover > 0 ? clamp01(1 - turnover / 30) : clamp01(safeNumber(input.capitalEfficiency ?? 0.5)),
    confidence: clamp01(safeNumber(input.confidenceScore) / 100),
    execution_quality: clamp01(safeNumber(input.executionQuality) / 100),
    deadhead_risk: 1 - clamp01((safeNumber(input.riskCount) * 10 + safeNumber(input.weightedSlippagePct)) / 120),
    stale_verification_penalty: -clamp01(safeNumber(input.staleVerificationPenalty) / 20),
  };
}

function summarize(explanation: RouteDecisionExplanation): string {
  const topPositive = explanation.positiveFactors[0]?.label ?? "mixed factors";
  const topNegative = explanation.negativeFactors[0]?.label;
  if (!topNegative) return `Strength led by ${topPositive}.`;
  return `Strength led by ${topPositive}; watch ${topNegative}.`;
}

export function buildRouteDecisionExplanation(
  input: RouteExplanationInput,
  lens: RouteDecisionLens = "recommended",
): RouteDecisionExplanation {
  const weights = lensWeights(lens);
  const raw = rawFactors(input);
  const factors = (Object.keys(raw) as RouteFactorKey[]).map((key) => {
    const normalized = raw[key];
    const weighted = normalized * weights[key] * 100;
    return {
      key,
      label: FACTOR_LABELS[key],
      normalized,
      weighted,
      direction: weighted >= 0 ? "positive" as const : "negative" as const,
    };
  });

  const positiveFactors = [...factors]
    .filter((item) => item.weighted > 0)
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 3);
  const negativeFactors = [...factors]
    .filter((item) => item.weighted < 0)
    .sort((a, b) => a.weighted - b.weighted)
    .slice(0, 3);

  const warnings: string[] = [];
  const recommendedActions: string[] = [];
  if (safeNumber(input.weightedSlippagePct) >= 8) warnings.push("High weighted slippage");
  if (safeNumber(input.riskCount) >= 3) warnings.push("Elevated route risk flags");
  if (safeNumber(input.confidenceScore) < 50) warnings.push("Low route confidence");
  if (safeNumber(input.staleVerificationPenalty) > 0) warnings.push("Verification snapshot is stale");
  if (input.missingVerification) warnings.push("Verification snapshot missing");
  if ((input.thinDepthCount ?? 0) > 0) warnings.push("Thin top-of-book depth on route lines");
  if (safeNumber(input.exitOverhangDays) >= 9) warnings.push("Slow destination clear time (high overhang)");
  if (safeNumber(input.jumpBurden) >= 14) warnings.push("High jump burden for repeat runs");

  if (safeNumber(input.staleVerificationPenalty) > 0) {
    recommendedActions.push("Run route verification before committing capital.");
  }
  if (input.missingVerification) {
    recommendedActions.push("Capture a verification snapshot before queueing this route.");
  }
  if (safeNumber(input.weightedSlippagePct) >= 8 || (input.thinDepthCount ?? 0) > 0) {
    recommendedActions.push("Trim order size or split fills to reduce slippage pressure.");
  }
  if (safeNumber(input.exitOverhangDays) >= 9) {
    recommendedActions.push("Prioritize faster-turnover exits or lower posted size.");
  }
  if (safeNumber(input.jumpBurden) >= 14) {
    recommendedActions.push("Queue this route only if travel time budget allows extra jumps.");
  }
  if (safeNumber(input.confidenceScore) < 50) {
    recommendedActions.push("Use tighter guardrails: smaller size and active repricing.");
  }

  const computed = factors.reduce((sum, factor) => sum + factor.weighted, 0);
  const totalScore = Math.max(0, Math.min(100, 0.35 * safeNumber(input.recommendationScore) + 0.65 * computed));

  const explanation: RouteDecisionExplanation = {
    routeKey: input.routeKey,
    routeLabel: input.routeLabel,
    totalScore,
    factors,
    positiveFactors,
    negativeFactors,
    positives: positiveFactors.map((factor) => `${factor.label} contributes +${Math.abs(factor.weighted).toFixed(1)}`),
    warnings,
    recommendedActions,
    summary: "",
    lens,
  };
  explanation.summary = summarize(explanation);
  return explanation;
}

export function explainLensDelta(
  input: RouteExplanationInput,
  fromLens: RouteDecisionLens,
  toLens: RouteDecisionLens,
): string {
  const from = buildRouteDecisionExplanation(input, fromLens);
  const to = buildRouteDecisionExplanation(input, toLens);
  const delta = to.totalScore - from.totalScore;
  const direction = delta >= 0 ? "up" : "down";
  const magnitude = Math.abs(delta).toFixed(1);

  const contributions = to.factors
    .map((factor) => {
      const prev = from.factors.find((entry) => entry.key === factor.key)?.weighted ?? 0;
      return { label: factor.label, delta: factor.weighted - prev };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const lead = contributions[0];
  if (!lead || Math.abs(delta) < 0.05) return `Lens change leaves score nearly unchanged.`;
  return `Lens change moves score ${direction} ${magnitude} (largest shift: ${lead.label} ${lead.delta >= 0 ? "+" : ""}${lead.delta.toFixed(1)}).`;
}
