export type RouteConfidenceInput = {
  routeSafetyRank: number;
  weakestExecutionQuality: number;
  weightedSlippagePct: number;
  riskSpikeCount: number;
  riskNoHistoryCount: number;
  riskUnstableHistoryCount: number;
  exitOverhangDays: number | null;
};

export type RouteConfidenceBreakdown = {
  factor: "safety" | "executionQuality" | "slippage" | "warningFlags" | "exitOverhang";
  weight: number;
  risk: number;
  penalty: number;
  detail: string;
};

export type RouteConfidenceResult = {
  score: number;
  label: "High" | "Medium" | "Low";
  color: string;
  hint: string;
  breakdown: RouteConfidenceBreakdown[];
};

// Explicit, centralized scoring rule for route-level confidence.
export const ROUTE_CONFIDENCE_WEIGHTS = {
  safety: 0.25,
  executionQuality: 0.25,
  slippage: 0.2,
  warningFlags: 0.15,
  exitOverhang: 0.15,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calcRouteConfidence(input: RouteConfidenceInput): RouteConfidenceResult {
  const safetyRisk = clamp((input.routeSafetyRank ?? 3) / 3, 0, 1);
  const executionRisk = clamp((100 - (input.weakestExecutionQuality ?? 0)) / 100, 0, 1);
  const slippageRisk = clamp((input.weightedSlippagePct ?? 0) / 20, 0, 1);

  const warningSeverity =
    (input.riskSpikeCount ?? 0) * 1.2 +
    (input.riskNoHistoryCount ?? 0) * 1.1 +
    (input.riskUnstableHistoryCount ?? 0) * 0.9;
  const warningRisk = clamp(warningSeverity / 6, 0, 1);

  const exitOverhang = Math.max(0, input.exitOverhangDays ?? 0);
  const exitOverhangRisk = clamp(exitOverhang / 45, 0, 1);

  const breakdown: RouteConfidenceBreakdown[] = [
    {
      factor: "safety",
      weight: ROUTE_CONFIDENCE_WEIGHTS.safety,
      risk: safetyRisk,
      penalty: safetyRisk * ROUTE_CONFIDENCE_WEIGHTS.safety * 100,
      detail: `safety rank ${input.routeSafetyRank}/3`,
    },
    {
      factor: "executionQuality",
      weight: ROUTE_CONFIDENCE_WEIGHTS.executionQuality,
      risk: executionRisk,
      penalty: executionRisk * ROUTE_CONFIDENCE_WEIGHTS.executionQuality * 100,
      detail: `weakest execution ${(input.weakestExecutionQuality ?? 0).toFixed(1)}`,
    },
    {
      factor: "slippage",
      weight: ROUTE_CONFIDENCE_WEIGHTS.slippage,
      risk: slippageRisk,
      penalty: slippageRisk * ROUTE_CONFIDENCE_WEIGHTS.slippage * 100,
      detail: `weighted slippage ${(input.weightedSlippagePct ?? 0).toFixed(2)}%`,
    },
    {
      factor: "warningFlags",
      weight: ROUTE_CONFIDENCE_WEIGHTS.warningFlags,
      risk: warningRisk,
      penalty: warningRisk * ROUTE_CONFIDENCE_WEIGHTS.warningFlags * 100,
      detail: `warnings spike:${input.riskSpikeCount} no-history:${input.riskNoHistoryCount} unstable:${input.riskUnstableHistoryCount}`,
    },
    {
      factor: "exitOverhang",
      weight: ROUTE_CONFIDENCE_WEIGHTS.exitOverhang,
      risk: exitOverhangRisk,
      penalty: exitOverhangRisk * ROUTE_CONFIDENCE_WEIGHTS.exitOverhang * 100,
      detail: `exit overhang ${exitOverhang.toFixed(1)}d`,
    },
  ];

  const totalPenalty = breakdown.reduce((sum, factor) => sum + factor.penalty, 0);
  const score = Math.round(clamp(100 - totalPenalty, 0, 100));

  const label: RouteConfidenceResult["label"] =
    score >= 75 ? "High" : score >= 45 ? "Medium" : "Low";
  const color =
    score >= 75
      ? "text-green-300 border-green-500/60 bg-green-900/20"
      : score >= 45
        ? "text-yellow-300 border-yellow-500/60 bg-yellow-900/20"
        : "text-red-300 border-red-500/60 bg-red-900/20";

  return {
    score,
    label,
    color,
    breakdown,
    hint: `Score ${score}/100 — ${breakdown
      .filter((factor) => factor.penalty >= 1)
      .map((factor) => `${factor.factor} -${factor.penalty.toFixed(1)} (${factor.detail})`)
      .join("; ") || "no route penalties"}`,
  };
}
