import type { RouteResult } from "@/lib/types";

export type ValidationBand = "green" | "yellow" | "red";

export interface RouteValidationThresholds {
  max_buy_drift_pct: number;
  max_sell_drift_pct: number;
  min_route_profit_retained_pct: number;
  min_stop_liquidity_retained_pct: number;
}

export interface RoutePlanStopValidation {
  stop_key: string;
  buy_ceiling_isk: number;
  sell_floor_isk: number;
  buy_drift_pct: number;
  sell_drift_pct: number;
  retained_profit_pct: number;
  liquidity_retained_pct: number;
  band: ValidationBand;
}

export interface RoutePlanValidationResult {
  band: ValidationBand;
  snapshot_stale: boolean;
  total_buy_drift_pct: number;
  total_sell_drift_pct: number;
  route_profit_retained_pct: number;
  min_stop_liquidity_retained_pct: number;
  checkpoints: Array<{ name: "pre-undock" | "pre-sale"; band: ValidationBand }>;
  stops: RoutePlanStopValidation[];
}

const bandOrder: Record<ValidationBand, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

function maxBand(a: ValidationBand, b: ValidationBand): ValidationBand {
  return bandOrder[a] >= bandOrder[b] ? a : b;
}

function bandByMax(actual: number, threshold: number): ValidationBand {
  if (threshold <= 0 || actual <= threshold) return "green";
  if (actual <= threshold * 1.2) return "yellow";
  return "red";
}

function bandByMin(actual: number, threshold: number): ValidationBand {
  if (threshold <= 0 || actual >= threshold) return "green";
  if (actual >= threshold * 0.8) return "yellow";
  return "red";
}

function pctIncrease(base: number, current: number): number {
  if (base <= 0) return current > 0 ? 100 : 0;
  return ((current - base) / base) * 100;
}

function pctDown(base: number, current: number): number {
  if (base <= 0 || current >= base) return 0;
  return ((base - current) / base) * 100;
}

function retained(base: number, current: number): number {
  if (base <= 0) return 100;
  return (current / base) * 100;
}

export function evaluateRoutePlanValidation(input: {
  route: RouteResult;
  thresholds: RouteValidationThresholds;
  nowMs?: number;
  staleAfterMs?: number;
}): RoutePlanValidationResult {
  const nowMs = input.nowMs ?? Date.now();
  const staleAfterMs = input.staleAfterMs ?? 15 * 60 * 1000;

  const stops = input.route.Hops.map((hop, idx) => {
    const units = Math.max(0, Math.trunc(hop.Units ?? 0));
    const modeled = Math.max(1, Math.trunc((hop.modeled_qty ?? units) || 1));
    const snapBuy = units * (hop.BuyPrice ?? 0);
    const snapSell = units * (hop.SellPrice ?? 0);
    const currentBuy = units * (hop.effective_buy ?? hop.BuyPrice ?? 0);
    const currentSell = units * (hop.effective_sell ?? hop.SellPrice ?? 0);

    const buyLiquidityRetained = retained(
      modeled,
      Math.max(0, hop.buy_remaining ?? modeled),
    );
    const sellLiquidityRetained = retained(
      modeled,
      Math.max(0, hop.sell_remaining ?? modeled),
    );
    const liquidityRetained = Math.min(
      buyLiquidityRetained,
      sellLiquidityRetained,
    );

    const buyDrift = pctIncrease(snapBuy, currentBuy);
    const sellDrift = pctDown(snapSell, currentSell);
    const retainedProfit = retained(
      snapSell - snapBuy,
      currentSell - currentBuy,
    );

    let band: ValidationBand = "green";
    band = maxBand(
      band,
      bandByMax(buyDrift, input.thresholds.max_buy_drift_pct),
    );
    band = maxBand(
      band,
      bandByMax(sellDrift, input.thresholds.max_sell_drift_pct),
    );
    band = maxBand(
      band,
      bandByMin(retainedProfit, input.thresholds.min_route_profit_retained_pct),
    );
    band = maxBand(
      band,
      bandByMin(
        liquidityRetained,
        input.thresholds.min_stop_liquidity_retained_pct,
      ),
    );

    return {
      stop_key: `${hop.SystemID}:${hop.DestSystemID}:${idx}`,
      buy_ceiling_isk: snapBuy * (1 + input.thresholds.max_buy_drift_pct / 100),
      sell_floor_isk:
        snapSell * (1 - input.thresholds.max_sell_drift_pct / 100),
      buy_drift_pct: buyDrift,
      sell_drift_pct: sellDrift,
      retained_profit_pct: retainedProfit,
      liquidity_retained_pct: liquidityRetained,
      band,
      snapBuy,
      snapSell,
      currentBuy,
      currentSell,
    };
  });

  const totals = stops.reduce(
    (acc, stop) => {
      acc.snapBuy += stop.snapBuy;
      acc.snapSell += stop.snapSell;
      acc.currentBuy += stop.currentBuy;
      acc.currentSell += stop.currentSell;
      acc.minLiquidity = Math.min(
        acc.minLiquidity,
        stop.liquidity_retained_pct,
      );
      return acc;
    },
    {
      snapBuy: 0,
      snapSell: 0,
      currentBuy: 0,
      currentSell: 0,
      minLiquidity: 100,
    },
  );

  const totalBuyDrift = pctIncrease(totals.snapBuy, totals.currentBuy);
  const totalSellDrift = pctDown(totals.snapSell, totals.currentSell);
  const routeProfitRetained = retained(
    totals.snapSell - totals.snapBuy,
    totals.currentSell - totals.currentBuy,
  );

  const snapshotTs = input.route.Hops.map((hop) =>
    hop.snapshot_ts ? Date.parse(hop.snapshot_ts) : Number.NaN,
  )
    .filter((ts) => Number.isFinite(ts))
    .reduce((min, ts) => Math.min(min, ts), Number.POSITIVE_INFINITY);
  const snapshotStale = Number.isFinite(snapshotTs)
    ? nowMs - snapshotTs > staleAfterMs
    : false;

  let preUndock = maxBand(
    bandByMax(totalBuyDrift, input.thresholds.max_buy_drift_pct),
    bandByMin(
      totals.minLiquidity,
      input.thresholds.min_stop_liquidity_retained_pct,
    ),
  );
  let preSale = maxBand(
    bandByMax(totalSellDrift, input.thresholds.max_sell_drift_pct),
    bandByMin(
      routeProfitRetained,
      input.thresholds.min_route_profit_retained_pct,
    ),
  );
  if (snapshotStale) {
    preUndock = maxBand(preUndock, "yellow");
    preSale = maxBand(preSale, "yellow");
  }

  return {
    band: maxBand(preUndock, preSale),
    snapshot_stale: snapshotStale,
    total_buy_drift_pct: totalBuyDrift,
    total_sell_drift_pct: totalSellDrift,
    route_profit_retained_pct: routeProfitRetained,
    min_stop_liquidity_retained_pct: totals.minLiquidity,
    checkpoints: [
      { name: "pre-undock", band: preUndock },
      { name: "pre-sale", band: preSale },
    ],
    stops: stops.map(
      ({
        snapBuy: _sb,
        snapSell: _ss,
        currentBuy: _cb,
        currentSell: _cs,
        ...rest
      }) => rest,
    ),
  };
}
