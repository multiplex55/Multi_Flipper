import { safeNumber } from "@/lib/batchMetrics";

export type HaulWorthinessLabel = "short_efficient" | "long_worth_it" | "long_marginal" | "long_not_worth";

export const HAUL_WORTHINESS_THRESHOLDS = {
  shortRouteMaxJumps: 20,
  longRouteMinJumps: 45,
  shortEfficientMinIskPerJump: 9_000_000,
  shortEfficientMinCargoUsedPercent: 70,
  shortEfficientMinProfitIsk: 120_000_000,
  longWorthMinProfitIsk: 500_000_000,
  longWorthMinIskPerJump: 10_000_000,
  longWorthMinCargoUsedPercent: 55,
  longMarginalMinProfitIsk: 300_000_000,
  longMarginalMinIskPerJump: 6_500_000,
  longMarginalMinCargoUsedPercent: 40,
  midWorthMinProfitIsk: 220_000_000,
  midWorthMinIskPerJump: 7_000_000,
  midMarginalMinProfitIsk: 130_000_000,
  midMarginalMinIskPerJump: 5_000_000,
  midMarginalMinCargoUsedPercent: 60,
} as const;

export type HaulWorthinessResult = {
  label: HaulWorthinessLabel;
  jumps: number;
  profit: number;
  iskPerJump: number;
  cargoUsedPercent: number;
  reason: string;
};

function reasonWithBasis(message: string, basis: Pick<HaulWorthinessResult, "jumps" | "profit" | "iskPerJump" | "cargoUsedPercent">): string {
  return `${message} Basis: jumps=${basis.jumps.toFixed(0)}, isk/jump=${basis.iskPerJump.toFixed(0)}, cargo=${basis.cargoUsedPercent.toFixed(1)}%, profit=${basis.profit.toFixed(0)}.`;
}

export function classifyHaulWorthiness(input: {
  jumps: number;
  profitIsk: number;
  iskPerJump: number;
  cargoUsedPercent: number;
}): HaulWorthinessResult {
  const jumps = Math.max(0, safeNumber(input.jumps));
  const profit = Math.max(0, safeNumber(input.profitIsk));
  const iskPerJump = Math.max(0, safeNumber(input.iskPerJump));
  const cargoUsedPercent = Math.max(0, Math.min(100, safeNumber(input.cargoUsedPercent)));
  const basis = { jumps, profit, iskPerJump, cargoUsedPercent };

  if (jumps <= HAUL_WORTHINESS_THRESHOLDS.shortRouteMaxJumps) {
    if (iskPerJump >= HAUL_WORTHINESS_THRESHOLDS.shortEfficientMinIskPerJump || cargoUsedPercent >= HAUL_WORTHINESS_THRESHOLDS.shortEfficientMinCargoUsedPercent || profit >= HAUL_WORTHINESS_THRESHOLDS.shortEfficientMinProfitIsk) {
      return { ...basis, label: "short_efficient", reason: reasonWithBasis("Short route with strong throughput.", basis) };
    }
    return { ...basis, label: "long_marginal", reason: reasonWithBasis("Short route but economics are moderate.", basis) };
  }

  if (jumps >= HAUL_WORTHINESS_THRESHOLDS.longRouteMinJumps) {
    if (profit >= HAUL_WORTHINESS_THRESHOLDS.longWorthMinProfitIsk && iskPerJump >= HAUL_WORTHINESS_THRESHOLDS.longWorthMinIskPerJump && cargoUsedPercent >= HAUL_WORTHINESS_THRESHOLDS.longWorthMinCargoUsedPercent) {
      return { ...basis, label: "long_worth_it", reason: reasonWithBasis("Long-haul route is worth the trip: all long-haul efficiency thresholds cleared.", basis) };
    }
    if (profit >= HAUL_WORTHINESS_THRESHOLDS.longMarginalMinProfitIsk && iskPerJump >= HAUL_WORTHINESS_THRESHOLDS.longMarginalMinIskPerJump && cargoUsedPercent >= HAUL_WORTHINESS_THRESHOLDS.longMarginalMinCargoUsedPercent) {
      return { ...basis, label: "long_marginal", reason: reasonWithBasis("Long-haul route is borderline: only marginal long-haul thresholds cleared.", basis) };
    }
    return { ...basis, label: "long_not_worth", reason: reasonWithBasis("Long-haul route is not worth it: misses profit density and/or cargo thresholds.", basis) };
  }

  if (profit >= HAUL_WORTHINESS_THRESHOLDS.midWorthMinProfitIsk && iskPerJump >= HAUL_WORTHINESS_THRESHOLDS.midWorthMinIskPerJump) {
    return { ...basis, label: "long_worth_it", reason: reasonWithBasis("Mid-distance route clears strong profit and ISK-per-jump thresholds.", basis) };
  }
  if (profit >= HAUL_WORTHINESS_THRESHOLDS.midMarginalMinProfitIsk || iskPerJump >= HAUL_WORTHINESS_THRESHOLDS.midMarginalMinIskPerJump || cargoUsedPercent >= HAUL_WORTHINESS_THRESHOLDS.midMarginalMinCargoUsedPercent) {
    return { ...basis, label: "long_marginal", reason: reasonWithBasis("Mid-distance route is viable but not decisive.", basis) };
  }
  return { ...basis, label: "long_not_worth", reason: reasonWithBasis("Mid-distance route misses baseline thresholds.", basis) };
}
