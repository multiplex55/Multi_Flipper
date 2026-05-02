import { safeNumber } from "@/lib/batchMetrics";

export type HaulWorthinessLabel = "short_efficient" | "long_worth_it" | "long_marginal" | "long_not_worth";

export type HaulWorthinessResult = {
  label: HaulWorthinessLabel;
  reason: string;
};

export function classifyHaulWorthiness(input: {
  jumps: number;
  profitIsk: number;
  iskPerJump: number;
  cargoUsedPercent: number;
}): HaulWorthinessResult {
  const jumps = Math.max(0, safeNumber(input.jumps));
  const profit = Math.max(0, safeNumber(input.profitIsk));
  const iskPerJump = Math.max(0, safeNumber(input.iskPerJump));
  const cargoUse = Math.max(0, Math.min(100, safeNumber(input.cargoUsedPercent)));

  if (jumps <= 20) {
    if (iskPerJump >= 9_000_000 || cargoUse >= 70 || profit >= 120_000_000) {
      return { label: "short_efficient", reason: "Short route with strong throughput (high ISK/jump, cargo use, or raw profit)." };
    }
    return { label: "long_marginal", reason: "Short route but economics are only moderate; keep as optional filler." };
  }

  if (jumps >= 45) {
    if (profit >= 500_000_000 && iskPerJump >= 10_000_000 && cargoUse >= 55) {
      return { label: "long_worth_it", reason: "Long-haul route has high absolute profit, strong ISK/jump, and solid cargo utilization." };
    }
    if (profit >= 300_000_000 && iskPerJump >= 6_500_000 && cargoUse >= 40) {
      return { label: "long_marginal", reason: "Long-haul route can work, but one or more efficiency metrics are only mid-tier." };
    }
    return { label: "long_not_worth", reason: "Long-haul route lacks enough profit density or cargo use to justify travel time." };
  }

  if (profit >= 220_000_000 && iskPerJump >= 7_000_000) {
    return { label: "long_worth_it", reason: "Mid-distance route clears strong profit and ISK-per-jump thresholds." };
  }
  if (profit >= 130_000_000 || iskPerJump >= 5_000_000 || cargoUse >= 60) {
    return { label: "long_marginal", reason: "Mid-distance route is viable but not decisively efficient across all metrics." };
  }
  return { label: "long_not_worth", reason: "Mid-distance route does not clear baseline profit-density thresholds." };
}
