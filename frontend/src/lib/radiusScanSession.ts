import { buildRouteBatchMetadata } from "@/lib/batchMetrics";
import { computeLoopOpportunities, type LoopOpportunity } from "@/lib/loopPlanner";
import { deriveRadiusRouteInsights, type RadiusRouteInsights } from "@/lib/useRadiusRouteInsights";
import type { FlipResult, ScanParams } from "@/lib/types";
import type { SessionStationFilters } from "@/lib/banlistFilters";

export type RadiusScanSession = {
  hasScan: boolean;
  insights: RadiusRouteInsights;
  loopOpportunities: LoopOpportunity[];
};

export function createEmptyRadiusScanSession(): RadiusScanSession {
  return {
    hasScan: false,
    insights: deriveRadiusRouteInsights({
      rows: [],
      resultsCount: 0,
      batchMetricsByRoute: {},
      routeSafetyMap: {},
      trackedTypeIds: new Set<number>(),
    }),
    loopOpportunities: [],
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

  const { byRoute } = buildRouteBatchMetadata(results, scanParams.cargo_capacity);
  const insights = deriveRadiusRouteInsights({
    rows: results.map((row) => ({ row })),
    resultsCount: results.length,
    batchMetricsByRoute: byRoute,
    routeSafetyMap: {},
    trackedTypeIds: new Set<number>(),
    sessionStationFilters,
  });

  return {
    hasScan: true,
    insights,
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
