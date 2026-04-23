import { routeLineKey, safeNumber } from "@/lib/batchMetrics";
import type {
  FlipResult,
  RouteManifestVerificationSnapshot,
} from "@/lib/types";
import {
  getVerificationDecisionThresholds,
  getVerificationProfileById,
  type VerificationRecommendation,
  type VerificationProfile,
} from "@/lib/verificationProfiles";

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
  recommendation: VerificationRecommendation;
  expected_profit_isk: number;
  min_acceptable_profit_isk: number;
  current_profit_isk: number;
  offenders: RouteVerificationOffender[];
  buyDriftPct: number;
  sellDriftPct: number;
  profitRetentionPct: number;
  liquidityRetentionPct: number;
  offenderLines: string[];
  ageMinutes: number;
  verifiedAt: string;
  checkedAt: string;
  summary: string;
};

function deriveRecommendation(input: {
  status: RouteVerificationStatus;
  profile: VerificationProfile;
  buyDriftPct: number;
  sellDriftPct: number;
  profitRetentionPct: number;
}): VerificationRecommendation {
  if (input.status === "Abort") return "abort";
  const thresholds = getVerificationDecisionThresholds(input.profile);
  if (
    input.profitRetentionPct >= thresholds.proceedMinProfitRetentionPct &&
    input.buyDriftPct <= thresholds.proceedMaxBuyDriftPct &&
    input.sellDriftPct <= thresholds.proceedMaxSellDriftPct
  ) {
    return "proceed";
  }
  if (
    input.profitRetentionPct >= thresholds.proceedReducedMinProfitRetentionPct &&
    input.buyDriftPct <= thresholds.repriceRebuildMaxBuyDriftPct &&
    input.sellDriftPct <= thresholds.repriceRebuildMaxSellDriftPct
  ) {
    return "proceed_reduced";
  }
  if (
    input.profitRetentionPct >= thresholds.repriceRebuildMinProfitRetentionPct &&
    (input.buyDriftPct > thresholds.proceedMaxBuyDriftPct ||
      input.sellDriftPct > thresholds.proceedMaxSellDriftPct)
  ) {
    return "reprice_rebuild";
  }
  return "abort";
}

export function normalizeVerificationRecommendation(input: {
  recommendation?: VerificationRecommendation | null;
  status?: RouteVerificationStatus | null;
  summary?: string | null;
}): VerificationRecommendation {
  if (input.recommendation) return input.recommendation;
  if (input.summary?.toLowerCase().includes("stale")) return "abort";
  if (input.status === "Good") return "proceed";
  if (input.status === "Reduced edge") return "proceed_reduced";
  return "abort";
}

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
  profile?: VerificationProfile;
  checkedAt?: Date | string;
  now?: Date;
}): RouteVerificationResult {
  const profile = input.profile ?? getVerificationProfileById("standard");
  const now = input.now ?? new Date();
  const checkedAtDate = input.checkedAt
    ? new Date(input.checkedAt)
    : now;
  const checkedAt = Number.isFinite(checkedAtDate.getTime())
    ? checkedAtDate
    : now;
  const staleByAge =
    typeof profile.maxAgeMinutes === "number" &&
    profile.maxAgeMinutes > 0 &&
    now.getTime() - checkedAt.getTime() > profile.maxAgeMinutes * 60_000;
  const rowByKey = new Map<string, FlipResult>();
  for (const row of input.rows) {
    rowByKey.set(routeLineKey(row), row);
  }

  const offenders: RouteVerificationOffender[] = [];
  const offenderLineSet = new Set<string>();
  let currentProfit = 0;
  let severeDrift = false;
  let maxBuyDrift = 0;
  let maxSellDrift = 0;
  let currentSellTotal = 0;

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
    currentSellTotal += currentSell;

    const buyDrift = percentUp(expected.expected_buy_isk, currentBuy);
    const sellDrift = percentDown(expected.expected_sell_isk, currentSell);
    maxBuyDrift = Math.max(maxBuyDrift, buyDrift);
    maxSellDrift = Math.max(maxSellDrift, sellDrift);

    if (buyDrift > profile.maxBuyDriftPct) {
      offenders.push({
        line_ref: expected.line_ref,
        type_id: expected.type_id,
        type_name: expected.type_name,
        direction: "buy_up",
        drift_pct: buyDrift,
        threshold_pct: profile.maxBuyDriftPct,
      });
      offenderLineSet.add(expected.line_ref);
      if (buyDrift > profile.maxBuyDriftPct * 1.5) severeDrift = true;
    }
    if (sellDrift > profile.maxSellDriftPct) {
      offenders.push({
        line_ref: expected.line_ref,
        type_id: expected.type_id,
        type_name: expected.type_name,
        direction: "sell_down",
        drift_pct: sellDrift,
        threshold_pct: profile.maxSellDriftPct,
      });
      offenderLineSet.add(expected.line_ref);
      if (sellDrift > profile.maxSellDriftPct * 1.5) severeDrift = true;
    }
  }

  const minAcceptableProfit = Math.max(
    0,
    input.snapshot.expected_profit_isk * (profile.minProfitRetentionPct / 100),
  );
  const profitRetentionPct =
    input.snapshot.expected_profit_isk > 0
      ? (currentProfit / input.snapshot.expected_profit_isk) * 100
      : currentProfit > 0
        ? 100
        : 0;
  const liquidityRetentionPct =
    input.snapshot.expected_sell_isk > 0
      ? (currentSellTotal / input.snapshot.expected_sell_isk) * 100
      : currentSellTotal > 0
        ? 100
        : 0;
  const ageMinutes = Math.max(0, (now.getTime() - checkedAt.getTime()) / 60_000);
  let status: RouteVerificationStatus = "Good";
  if (currentProfit < minAcceptableProfit || severeDrift || staleByAge) {
    status = "Abort";
  } else if (
    offenders.length > 0 ||
    currentProfit < input.snapshot.expected_profit_isk
  ) {
    status = "Reduced edge";
  }
  const recommendation = deriveRecommendation({
    status,
    profile,
    buyDriftPct: maxBuyDrift,
    sellDriftPct: maxSellDrift,
    profitRetentionPct,
  });

  const summary = staleByAge
    ? `Stale market check (${profile.name}): age exceeded ${profile.maxAgeMinutes}m max.`
    : `Profile ${profile.name}: buy drift ${maxBuyDrift.toFixed(1)}%, sell drift ${maxSellDrift.toFixed(1)}%, retention ${profitRetentionPct.toFixed(1)}%.`;

  return {
    status,
    recommendation,
    expected_profit_isk: input.snapshot.expected_profit_isk,
    min_acceptable_profit_isk: minAcceptableProfit,
    current_profit_isk: currentProfit,
    offenders,
    buyDriftPct: maxBuyDrift,
    sellDriftPct: maxSellDrift,
    profitRetentionPct,
    liquidityRetentionPct,
    offenderLines: Array.from(offenderLineSet).sort((a, b) => a.localeCompare(b)),
    ageMinutes,
    verifiedAt: checkedAt.toISOString(),
    checkedAt: checkedAt.toISOString(),
    summary,
  };
}
