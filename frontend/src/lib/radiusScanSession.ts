import { buildRouteBatchMetadata } from "@/lib/batchMetrics";
import {
  computeLoopOpportunities,
  type LoopOpportunity,
} from "@/lib/loopPlanner";
import {
  deriveRadiusRouteInsights,
  type RadiusRouteInsights,
} from "@/lib/useRadiusRouteInsights";
import type { SessionStationFilters } from "@/lib/banlistFilters";
import type { FlipResult, ScanParams, StationCacheMeta } from "@/lib/types";

const ROUTE_INSIGHTS_SNAPSHOT_VERSION = "v1";

export type RadiusScanSession = {
  hasScan: boolean;
  results: FlipResult[];
  cacheMeta: StationCacheMeta | null;
  paramsSnapshot: ScanParams | null;
  scanCompletedAt: string | null;
  insights?: RadiusRouteInsights;
  routeInsightsSnapshot?: RadiusRouteInsights;
  routeInsightsSnapshotVersion?: string;
  loopOpportunities: LoopOpportunity[];
};

function deriveInsights(
  results: FlipResult[],
  scanParams: ScanParams,
  sessionStationFilters: SessionStationFilters,
): RadiusRouteInsights {
  const { byRoute } = buildRouteBatchMetadata(results, scanParams.cargo_capacity);
  return deriveRadiusRouteInsights({
    rows: results.map((row) => ({ row })),
    resultsCount: results.length,
    batchMetricsByRoute: byRoute,
    routeSafetyMap: {},
    trackedTypeIds: new Set<number>(),
    sessionStationFilters,
  });
}

export function createEmptyRadiusScanSession(): RadiusScanSession {
  return {
    hasScan: false,
    results: [],
    cacheMeta: null,
    paramsSnapshot: null,
    scanCompletedAt: null,
    insights: undefined,
    routeInsightsSnapshot: undefined,
    routeInsightsSnapshotVersion: ROUTE_INSIGHTS_SNAPSHOT_VERSION,
    loopOpportunities: [],
  };
}

export function createRadiusScanSession(params: {
  results: FlipResult[];
  cacheMeta: StationCacheMeta | null;
  scanParams: ScanParams;
  sessionStationFilters: SessionStationFilters;
  scanCompletedAt?: string;
}): RadiusScanSession {
  const { results, cacheMeta, scanParams, sessionStationFilters, scanCompletedAt } =
    params;
  const insights = deriveInsights(results, scanParams, sessionStationFilters);
  return {
    hasScan: true,
    results,
    cacheMeta,
    paramsSnapshot: scanParams,
    scanCompletedAt: scanCompletedAt ?? new Date().toISOString(),
    insights,
    routeInsightsSnapshot: insights,
    routeInsightsSnapshotVersion: ROUTE_INSIGHTS_SNAPSHOT_VERSION,
    loopOpportunities: computeLoopOpportunities(results, {
      homeSystemName: scanParams.system_name,
      maxDetourJumps: scanParams.max_detour_jumps_per_node ?? 0,
      cargoCapacityM3: scanParams.cargo_capacity,
      minLegProfit: scanParams.min_item_profit ?? 0,
      minTotalLoopProfit: Math.max(0, (scanParams.min_item_profit ?? 0) * 2),
      maxResults: 24,
    }),
  };
}

export function deriveRadiusScanSession(params: {
  results: FlipResult[];
  scanParams: ScanParams;
  sessionStationFilters: SessionStationFilters;
}): RadiusScanSession {
  const { results, scanParams, sessionStationFilters } = params;
  if (results.length === 0) {
    return createEmptyRadiusScanSession();
  }
  return createRadiusScanSession({
    results,
    cacheMeta: null,
    scanParams,
    sessionStationFilters,
  });
}
