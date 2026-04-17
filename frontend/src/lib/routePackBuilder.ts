import { routeLineKey } from "@/lib/batchMetrics";
import type {
  FlipResult,
  RouteManifestVerificationSnapshot,
  SavedRoutePack,
  SavedRoutePackVerificationSnapshot,
} from "@/lib/types";
import type { RouteBatchMetadata } from "@/lib/batchMetrics";
import type { RouteVerificationResult } from "@/lib/routeManifestVerification";

export type BuildSavedRoutePackParams = {
  existingPack?: SavedRoutePack | null;
  routeKey: string;
  routeLabel: string;
  anchorRow: FlipResult;
  routeRows: FlipResult[];
  selectedRows: FlipResult[];
  entryMode: "core" | "filler" | "loop";
  launchIntent: string | null;
  summary: RouteBatchMetadata | null;
  routeSafetyRank: number | null;
  manifestSnapshot?: RouteManifestVerificationSnapshot | null;
  verificationResult?: RouteVerificationResult | null;
  now?: Date;
};

function normalizeLineKeys(rows: FlipResult[]): string[] {
  return [...new Set(rows.map((row) => routeLineKey(row)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function buildVerificationSnapshot(
  verificationResult?: RouteVerificationResult | null,
  nowIso?: string,
): SavedRoutePackVerificationSnapshot | null {
  if (!verificationResult) return null;
  return {
    status: verificationResult.status,
    currentProfitIsk: verificationResult.current_profit_isk,
    minAcceptableProfitIsk: verificationResult.min_acceptable_profit_isk,
    verifiedAt: nowIso ?? new Date().toISOString(),
    offenderCount: verificationResult.offenders.length,
  };
}

export function buildSavedRoutePack(
  params: BuildSavedRoutePackParams,
): SavedRoutePack {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const selectedLineKeys = normalizeLineKeys(params.selectedRows);
  const allLineKeys = normalizeLineKeys(params.routeRows);
  const selectedSet = new Set(selectedLineKeys);
  const excludedLineKeys = allLineKeys.filter((lineKey) => !selectedSet.has(lineKey));

  return {
    routeKey: params.routeKey,
    routeLabel: params.routeLabel,
    buyLocationId: Math.trunc(params.anchorRow.BuyLocationID ?? 0),
    sellLocationId: Math.trunc(params.anchorRow.SellLocationID ?? 0),
    buySystemId: Math.trunc(params.anchorRow.BuySystemID ?? 0),
    sellSystemId: Math.trunc(params.anchorRow.SellSystemID ?? 0),
    createdAt: params.existingPack?.createdAt ?? nowIso,
    updatedAt: nowIso,
    lastVerifiedAt: params.verificationResult ? nowIso : params.existingPack?.lastVerifiedAt ?? null,
    entryMode: params.entryMode,
    launchIntent: params.launchIntent,
    selectedLineKeys,
    excludedLineKeys,
    summarySnapshot: {
      routeItemCount: params.summary?.routeItemCount ?? params.routeRows.length,
      routeTotalProfit: params.summary?.routeTotalProfit ?? 0,
      routeTotalCapital: params.summary?.routeTotalCapital ?? 0,
      routeRealIskPerJump: params.summary?.routeRealIskPerJump ?? 0,
      routeDailyIskPerJump: params.summary?.routeDailyIskPerJump ?? 0,
      routeDailyProfit: params.summary?.routeDailyProfit ?? 0,
      routeWeightedSlippagePct: params.summary?.routeWeightedSlippagePct ?? 0,
      routeTurnoverDays: params.summary?.routeTurnoverDays ?? null,
      routeSafetyRank: params.routeSafetyRank,
    },
    manifestSnapshot: params.manifestSnapshot ?? params.existingPack?.manifestSnapshot ?? null,
    verificationSnapshot:
      buildVerificationSnapshot(params.verificationResult, nowIso) ??
      params.existingPack?.verificationSnapshot ??
      null,
    notes: params.existingPack?.notes ?? "",
    tags: params.existingPack?.tags ?? [],
    status: params.existingPack?.status ?? "active",
  };
}
