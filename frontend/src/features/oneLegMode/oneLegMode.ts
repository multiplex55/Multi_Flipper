import { routeLineKey } from "@/lib/batchMetrics";
import { buildFillerCandidates, type FillerCandidate } from "@/lib/fillerCandidates";
import { scoreFlipResult, type OpportunityWeightProfile, type OpportunityScanContext } from "@/lib/opportunityScore";
import { verifyRouteManifestAgainstRows, type RouteVerificationResult } from "@/lib/routeManifestVerification";
import { getVerificationProfileById, type VerificationProfile } from "@/lib/verificationProfiles";
import type { FlipResult, RouteManifestVerificationSnapshot } from "@/lib/types";

export type OneLegSuggestionReason = "same_origin" | "same_destination" | "same_leg" | "next_same_origin" | "next_same_destination";

export interface OneLegSuggestion {
  row: FlipResult;
  lineKey: string;
  reason: OneLegSuggestionReason;
  score: number;
  marginScore: number;
  timeScore: number;
  cargoFitScore: number;
  opportunityScore: number;
}

function endpointId(locationId: number | undefined, systemId: number): number {
  const location = Math.trunc(locationId ?? 0);
  return location > 0 ? location : Math.trunc(systemId);
}

export function sameLegKey(row: FlipResult): string {
  const buy = endpointId(row.BuyLocationID, row.BuySystemID);
  const sell = endpointId(row.SellLocationID, row.SellSystemID);
  return `${buy}->${sell}`;
}

function clamp(v: number, min = 0, max = 1): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function scoreCandidate(
  row: FlipResult,
  anchor: FlipResult,
  opts: {
    cargoLimit?: number;
    profile?: OpportunityWeightProfile;
    context?: OpportunityScanContext;
  },
): Omit<OneLegSuggestion, "reason" | "lineKey"> {
  const marginScore = clamp((row.MarginPercent ?? 0) / 100);
  const jumps = Math.max(1, row.TotalJumps ?? 0);
  const timeScore = clamp(1 / jumps);
  const anchorVolume = Math.max(1, (anchor.Volume ?? 0) * (anchor.UnitsToBuy ?? 0));
  const rowVolume = Math.max(0, (row.Volume ?? 0) * (row.UnitsToBuy ?? 0));
  const fitBasis = opts.cargoLimit && opts.cargoLimit > 0 ? opts.cargoLimit : anchorVolume;
  const cargoFitScore = clamp(1 - Math.abs(rowVolume - anchorVolume) / Math.max(1, fitBasis));
  const opportunityScore = clamp(
    scoreFlipResult(row, opts.profile, opts.context).finalScore / 100,
  );

  const score = marginScore * 0.28 + timeScore * 0.2 + cargoFitScore * 0.22 + opportunityScore * 0.3;
  return { row, score, marginScore, timeScore, cargoFitScore, opportunityScore };
}

export function buildOneLegSuggestions(input: {
  rows: FlipResult[];
  anchor: FlipResult;
  cargoLimit?: number;
  profile?: OpportunityWeightProfile;
  context?: OpportunityScanContext;
  limit?: number;
}): {
  sameLeg: OneLegSuggestion[];
  sameOriginOrDestination: OneLegSuggestion[];
  nextBestTrade: OneLegSuggestion[];
} {
  const { rows, anchor, cargoLimit, profile, context, limit = 5 } = input;
  const anchorLineKey = routeLineKey(anchor);
  const anchorBuy = endpointId(anchor.BuyLocationID, anchor.BuySystemID);
  const anchorSell = endpointId(anchor.SellLocationID, anchor.SellSystemID);

  const decorate = (row: FlipResult, reason: OneLegSuggestionReason): OneLegSuggestion => ({
    ...scoreCandidate(row, anchor, { cargoLimit, profile, context }),
    reason,
    lineKey: routeLineKey(row),
  });

  const candidates = rows.filter((row) => routeLineKey(row) !== anchorLineKey);

  const sameLeg = candidates
    .filter((row) => sameLegKey(row) === sameLegKey(anchor))
    .map((row) => decorate(row, "same_leg"))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const sameOriginOrDestination = candidates
    .filter((row) => {
      const buy = endpointId(row.BuyLocationID, row.BuySystemID);
      const sell = endpointId(row.SellLocationID, row.SellSystemID);
      return buy === anchorBuy || sell === anchorSell;
    })
    .map((row) => {
      const buy = endpointId(row.BuyLocationID, row.BuySystemID);
      const sell = endpointId(row.SellLocationID, row.SellSystemID);
      if (buy === anchorBuy && sell === anchorSell) {
        return decorate(row, "same_leg");
      }
      return decorate(row, buy === anchorBuy ? "same_origin" : "same_destination");
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const nextBestTrade = candidates
    .filter((row) => {
      const buy = endpointId(row.BuyLocationID, row.BuySystemID);
      const sell = endpointId(row.SellLocationID, row.SellSystemID);
      return buy === anchorBuy || sell === anchorSell;
    })
    .map((row) => {
      const buy = endpointId(row.BuyLocationID, row.BuySystemID);
      return decorate(row, buy === anchorBuy ? "next_same_origin" : "next_same_destination");
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { sameLeg, sameOriginOrDestination, nextBestTrade };
}

export function buildOneLegFillers(input: {
  rows: FlipResult[];
  anchor: FlipResult;
  cargoLimit?: number;
}): { remainingCapacityM3: number; candidates: FillerCandidate[] } {
  const anchorVolume = Math.max(0, (input.anchor.Volume ?? 0) * (input.anchor.UnitsToBuy ?? 0));
  const cargoLimit = input.cargoLimit ?? 0;
  const remainingCapacityM3 = cargoLimit > 0 ? Math.max(0, cargoLimit - anchorVolume) : Math.max(0, anchorVolume);
  if (!(remainingCapacityM3 > 0)) return { remainingCapacityM3: 0, candidates: [] };

  const sameLegRows = input.rows.filter((row) => sameLegKey(row) === sameLegKey(input.anchor));
  const candidates = buildFillerCandidates({
    routeRows: sameLegRows,
    selectedCoreLineKeys: [routeLineKey(input.anchor)],
    remainingCargoM3: remainingCapacityM3,
    remainingCapitalIsk: Number.POSITIVE_INFINITY,
    minConfidencePercent: 0,
    minExecutionQuality: 0,
  });
  return { remainingCapacityM3, candidates };
}

function expectedBuy(row: FlipResult): number {
  const unitPrice = Math.max(0, row.ExpectedBuyPrice ?? row.BuyPrice ?? 0);
  const units = Math.max(0, row.UnitsToBuy ?? 0);
  return unitPrice * units;
}

function expectedSell(row: FlipResult): number {
  const unitPrice = Math.max(0, row.ExpectedSellPrice ?? row.SellPrice ?? 0);
  const units = Math.max(0, row.UnitsToBuy ?? 0);
  return unitPrice * units;
}

export function buildVerificationSnapshotForRows(
  rows: FlipResult[],
  profile: VerificationProfile,
): RouteManifestVerificationSnapshot {
  const expected_buy_isk = rows.reduce((sum, row) => sum + expectedBuy(row), 0);
  const expected_sell_isk = rows.reduce((sum, row) => sum + expectedSell(row), 0);
  const expected_profit_isk = expected_sell_isk - expected_buy_isk;
  return {
    expected_buy_isk,
    expected_sell_isk,
    expected_profit_isk,
    min_acceptable_profit_isk: expected_profit_isk * (profile.minProfitRetentionPct / 100),
    max_buy_drift_pct: profile.maxBuyDriftPct,
    max_sell_drift_pct: profile.maxSellDriftPct,
    lines: rows.map((row) => ({
      line_ref: routeLineKey(row),
      type_id: row.TypeID,
      type_name: row.TypeName,
      buy_system_id: row.BuySystemID,
      buy_location_id: endpointId(row.BuyLocationID, row.BuySystemID),
      sell_system_id: row.SellSystemID,
      sell_location_id: endpointId(row.SellLocationID, row.SellSystemID),
      expected_buy_isk: expectedBuy(row),
      expected_sell_isk: expectedSell(row),
      expected_profit_isk: expectedSell(row) - expectedBuy(row),
    })),
  };
}

export function verifyOneLegSelection(input: {
  batchRows: FlipResult[];
  profileId?: string;
  checkedAt?: Date | string;
  now?: Date;
}): RouteVerificationResult {
  const profile = getVerificationProfileById(input.profileId ?? "standard");
  const snapshot = buildVerificationSnapshotForRows(input.batchRows, profile);
  return verifyRouteManifestAgainstRows({
    snapshot,
    rows: input.batchRows,
    profile,
    checkedAt: input.checkedAt,
    now: input.now,
  });
}
