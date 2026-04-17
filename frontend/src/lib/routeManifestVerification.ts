import { routeLineKey, safeNumber } from "@/lib/batchMetrics";
import type {
  FlipResult,
  RouteManifestVerificationSnapshot,
} from "@/lib/types";

export type RouteVerificationStatus = "Good" | "Reduced edge" | "Abort";

export type RouteVerificationOffender = {
  line_ref: string;
  type_id: number;
  type_name: string;
  direction: "buy_up" | "sell_down";
  drift_pct: number;
  threshold_pct: number;
};

export type RouteVerificationResult = {
  status: RouteVerificationStatus;
  expected_profit_isk: number;
  min_acceptable_profit_isk: number;
  current_profit_isk: number;
  offenders: RouteVerificationOffender[];
};

function percentUp(expected: number, current: number): number {
  if (!(expected > 0)) return current > 0 ? 100 : 0;
  return ((current - expected) / expected) * 100;
}

function percentDown(expected: number, current: number): number {
  if (!(expected > 0) || current >= expected) return 0;
  return ((expected - current) / expected) * 100;
}

export function verifyRouteManifestAgainstRows(input: {
  snapshot: RouteManifestVerificationSnapshot;
  rows: FlipResult[];
}): RouteVerificationResult {
  const rowByKey = new Map<string, FlipResult>();
  for (const row of input.rows) {
    rowByKey.set(routeLineKey(row), row);
  }

  const offenders: RouteVerificationOffender[] = [];
  let currentProfit = 0;
  let severeDrift = false;

  for (const expected of input.snapshot.lines) {
    const matched = rowByKey.get(expected.line_ref);
    if (!matched) {
      severeDrift = true;
      continue;
    }
    const currentBuy = Math.max(
      0,
      safeNumber(matched.ExpectedBuyPrice) * safeNumber(matched.UnitsToBuy) ||
        safeNumber(matched.BuyPrice) * safeNumber(matched.UnitsToBuy),
    );
    const currentSell = Math.max(
      0,
      safeNumber(matched.ExpectedSellPrice) * safeNumber(matched.UnitsToBuy) ||
        safeNumber(matched.SellPrice) * safeNumber(matched.UnitsToBuy),
    );
    currentProfit += currentSell - currentBuy;

    const buyDrift = percentUp(expected.expected_buy_isk, currentBuy);
    const sellDrift = percentDown(expected.expected_sell_isk, currentSell);

    if (buyDrift > input.snapshot.max_buy_drift_pct) {
      offenders.push({
        line_ref: expected.line_ref,
        type_id: expected.type_id,
        type_name: expected.type_name,
        direction: "buy_up",
        drift_pct: buyDrift,
        threshold_pct: input.snapshot.max_buy_drift_pct,
      });
      if (buyDrift > input.snapshot.max_buy_drift_pct * 1.5) severeDrift = true;
    }
    if (sellDrift > input.snapshot.max_sell_drift_pct) {
      offenders.push({
        line_ref: expected.line_ref,
        type_id: expected.type_id,
        type_name: expected.type_name,
        direction: "sell_down",
        drift_pct: sellDrift,
        threshold_pct: input.snapshot.max_sell_drift_pct,
      });
      if (sellDrift > input.snapshot.max_sell_drift_pct * 1.5) severeDrift = true;
    }
  }

  let status: RouteVerificationStatus = "Good";
  if (currentProfit < input.snapshot.min_acceptable_profit_isk || severeDrift) {
    status = "Abort";
  } else if (
    offenders.length > 0 ||
    currentProfit < input.snapshot.expected_profit_isk
  ) {
    status = "Reduced edge";
  }

  return {
    status,
    expected_profit_isk: input.snapshot.expected_profit_isk,
    min_acceptable_profit_isk: input.snapshot.min_acceptable_profit_isk,
    current_profit_isk: currentProfit,
    offenders,
  };
}

