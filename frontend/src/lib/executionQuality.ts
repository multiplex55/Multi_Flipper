import type { FlipResult } from "@/lib/types";

export interface ExecutionQualityInput {
  fillRatio: number;
  slippageBurden: number;
  topOfBookDepthCoverage: number;
  hasHistory: boolean;
  destinationSpike?: boolean;
  marketStable?: boolean;
}

export interface ExecutionQualityFactor {
  factor: "fillRatio" | "slippage" | "depthCoverage" | "history" | "spike" | "stability";
  score: number;
  weight: number;
  contribution: number;
  direction: "positive" | "penalty";
}

export interface ExecutionQualityBreakdown {
  score: number;
  factors: ExecutionQualityFactor[];
  topPositives: ExecutionQualityFactor[];
  topPenalties: ExecutionQualityFactor[];
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toRatio(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  if (value > 1) return clamp(value / 100, 0, 1);
  return clamp(value, 0, 1);
}

export function requestedUnitsForFlip(row: Pick<FlipResult, "PreExecutionUnits" | "UnitsToBuy">): number {
  const preExecutionUnits = Math.max(0, Number(row.PreExecutionUnits ?? 0));
  if (Number.isFinite(preExecutionUnits) && preExecutionUnits > 0) return preExecutionUnits;
  const unitsToBuy = Math.max(0, Number(row.UnitsToBuy ?? 0));
  if (Number.isFinite(unitsToBuy) && unitsToBuy > 0) return unitsToBuy;
  return 0;
}

function byContributionDesc(a: ExecutionQualityFactor, b: ExecutionQualityFactor): number {
  return b.contribution - a.contribution;
}

function byContributionAsc(a: ExecutionQualityFactor, b: ExecutionQualityFactor): number {
  return a.contribution - b.contribution;
}

export function computeExecutionQuality(input: ExecutionQualityInput): ExecutionQualityBreakdown {
  const fillScore = toRatio(input.fillRatio) * 100;
  const slippagePenalty = toRatio(input.slippageBurden) * 100;
  const slippageScore = 100 - slippagePenalty;
  const depthScore = toRatio(input.topOfBookDepthCoverage) * 100;
  const historyScore = input.hasHistory ? 100 : 15;
  const spikeScore = input.destinationSpike === true ? 20 : 100;
  const stabilityScore = input.marketStable === false ? 40 : input.marketStable === true ? 100 : 70;

  const factors: ExecutionQualityFactor[] = [
    { factor: "fillRatio", score: fillScore, weight: 0.32, contribution: fillScore * 0.32, direction: "positive" },
    { factor: "slippage", score: slippageScore, weight: 0.24, contribution: slippageScore * 0.24, direction: "penalty" },
    { factor: "depthCoverage", score: depthScore, weight: 0.2, contribution: depthScore * 0.2, direction: "positive" },
    { factor: "history", score: historyScore, weight: 0.14, contribution: historyScore * 0.14, direction: "positive" },
    { factor: "spike", score: spikeScore, weight: 0.06, contribution: spikeScore * 0.06, direction: "penalty" },
    { factor: "stability", score: stabilityScore, weight: 0.04, contribution: stabilityScore * 0.04, direction: "positive" },
  ];

  const score = clamp(factors.reduce((sum, factor) => sum + factor.contribution, 0), 0, 100);

  const topPositives = [...factors]
    .filter((factor) => factor.contribution >= 0)
    .sort(byContributionDesc)
    .slice(0, 2);

  const topPenalties = [...factors]
    .sort(byContributionAsc)
    .slice(0, 2);

  return { score, factors, topPositives, topPenalties };
}

export function hasDestinationPriceSpike(row: Pick<FlipResult, "DayNowProfit" | "DayPeriodProfit">): boolean {
  return (row.DayNowProfit ?? 0) > 0 && (row.DayPeriodProfit ?? 0) < 0;
}

export function hasStableDestinationHistory(
  row: Pick<FlipResult, "DayTargetPeriodPrice" | "DayPriceHistory" | "DayTargetNowPrice" | "SellPrice">,
): boolean | undefined {
  const period = row.DayTargetPeriodPrice;
  const now = row.DayTargetNowPrice ?? row.SellPrice ?? 0;
  if (period != null && period > 0 && now > 0) {
    const drift = Math.abs(now - period) / period;
    return drift <= 0.2;
  }

  const history = row.DayPriceHistory ?? [];
  if (history.length < 5) return undefined;
  const mean = history.reduce((sum, price) => sum + price, 0) / history.length;
  if (!Number.isFinite(mean) || mean <= 0) return undefined;
  const variance = history.reduce((sum, price) => sum + (price - mean) ** 2, 0) / history.length;
  const stdev = Math.sqrt(variance);
  const cv = stdev / mean;
  return cv <= 0.15;
}

export function executionQualityForFlip(row: FlipResult): ExecutionQualityBreakdown {
  const filled = Math.max(0, row.FilledQty ?? 0);
  const requestedUnits = requestedUnitsForFlip(row);
  const fillRatio = requestedUnits > 0 ? clamp(filled / requestedUnits, 0, 1) : row.CanFill ? 1 : 0;

  const slipPct = Math.max(0, (row.SlippageBuyPct ?? 0) + (row.SlippageSellPct ?? 0));
  const slippageBurden = clamp(slipPct / 25, 0, 1);

  const buyDepth = Math.max(0, row.BuyOrderRemain ?? 0);
  const sellDepth = Math.max(0, row.SellOrderRemain ?? 0);
  const depthCoverage =
    requestedUnits > 0 ? clamp(Math.min(buyDepth, sellDepth) / requestedUnits, 0, 1) : 0;

  const hasHistory = (row.DayTargetPeriodPrice ?? 0) > 0 || (row.DayPriceHistory?.length ?? 0) > 0 || row.HistoryAvailable === true;

  return computeExecutionQuality({
    fillRatio,
    slippageBurden,
    topOfBookDepthCoverage: depthCoverage,
    hasHistory,
    destinationSpike: hasDestinationPriceSpike(row),
    marketStable: hasStableDestinationHistory(row),
  });
}

export function exitOverhangDays(targetSellSupply: number | null | undefined, s2bPerDay: number | null | undefined): number {
  const supply = Number(targetSellSupply ?? 0);
  const daily = Number(s2bPerDay ?? 0);
  if (!Number.isFinite(supply) || supply <= 0) return 0;
  if (!Number.isFinite(daily) || daily <= 0) return Number.POSITIVE_INFINITY;
  return supply / daily;
}

export function breakevenBuffer(expectedProfit: number | null | undefined, grossExposure: number | null | undefined): number {
  const profit = Number(expectedProfit ?? 0);
  const exposure = Number(grossExposure ?? 0);
  if (!Number.isFinite(profit) || profit <= 0) return 0;
  if (!Number.isFinite(exposure) || exposure <= 0) return 0;
  return clamp((profit / exposure) * 100, 0, 100);
}

export function breakevenBufferForFlip(row: FlipResult): number {
  const units = Math.max(0, row.FilledQty ?? row.UnitsToBuy ?? 0);
  const sell = Math.max(0, row.ExpectedSellPrice ?? row.SellPrice ?? 0);
  const expectedProfit = row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? 0;
  return breakevenBuffer(expectedProfit, units * sell);
}
