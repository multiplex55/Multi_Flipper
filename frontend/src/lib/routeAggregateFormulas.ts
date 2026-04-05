import { breakevenBuffer, exitOverhangDays } from "@/lib/executionQuality";

/**
 * Route aggregate formula helpers.
 *
 * Units and assumptions:
 * - Profit/ISK values are absolute ISK.
 * - `/Jump` values are ISK per jump (ISK/jump), requiring jumps > 0.
 * - `/m³/Jump` values are ISK per cubic meter per jump (ISK/m³/jump), requiring
 *   volume > 0 and jumps > 0.
 * - `...OverCapital` and `BreakevenBuffer` are percentages in [0, 100] where
 *   applicable (not fractional ratios).
 * - `...Days` values are day counts and remain absolute day units.
 * - Functions return `null` when required denominators or historical inputs are missing.
 */

export type WeightedMetricInput = {
  value: number | null;
  weight: number;
};

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validPositiveDenominator(value: unknown): number | null {
  const n = finiteOrNull(value);
  if (n == null || n <= 0) return null;
  return n;
}

export function routeDailyIskPerJump(
  routeDailyProfitIsk: number | null,
  routeJumps: number | null,
): number | null {
  const profit = finiteOrNull(routeDailyProfitIsk);
  const jumps = validPositiveDenominator(routeJumps);
  if (profit == null || jumps == null) return null;
  return profit / jumps;
}

export function routeDailyProfitOverCapitalPct(
  routeDailyProfitIsk: number | null,
  routeCapitalIsk: number | null,
): number | null {
  const profit = finiteOrNull(routeDailyProfitIsk);
  const capital = validPositiveDenominator(routeCapitalIsk);
  if (profit == null || capital == null) return null;
  return (profit / capital) * 100;
}

export function routeIskPerM3PerJump(
  routeProfitIsk: number | null,
  routeVolumeM3: number | null,
  routeJumps: number | null,
): number | null {
  const profit = finiteOrNull(routeProfitIsk);
  const volume = validPositiveDenominator(routeVolumeM3);
  const jumps = validPositiveDenominator(routeJumps);
  if (profit == null || volume == null || jumps == null) return null;
  return profit / volume / jumps;
}

export function weightedAverageMetric(entries: WeightedMetricInput[]): number | null {
  let weighted = 0;
  let weights = 0;
  for (const entry of entries) {
    if (entry.value == null || !Number.isFinite(entry.value)) continue;
    const weight = Math.max(0, Number(entry.weight));
    if (!(weight > 0)) continue;
    weighted += entry.value * weight;
    weights += weight;
  }
  if (!(weights > 0)) return null;
  return weighted / weights;
}

export function routeExitOverhangDaysWeighted(
  lines: Array<{ targetSellSupply: number | null | undefined; s2bPerDay: number | null | undefined; weight: number }>,
): number | null {
  return weightedAverageMetric(
    lines.map((line) => ({
      value: (() => {
        const metric = exitOverhangDays(line.targetSellSupply, line.s2bPerDay);
        return Number.isFinite(metric) ? metric : null;
      })(),
      weight: line.weight,
    })),
  );
}

export function routeBreakevenBufferPct(
  expectedProfitIsk: number | null,
  grossExposureIsk: number | null,
): number | null {
  const exposure = validPositiveDenominator(grossExposureIsk);
  if (exposure == null) return null;
  const metric = breakevenBuffer(expectedProfitIsk, exposure);
  return Number.isFinite(metric) ? metric : null;
}
