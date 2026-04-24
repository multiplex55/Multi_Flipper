import type { FlipResult } from "@/lib/types";
import { normalizeHubMatchText } from "@/lib/radiusMajorHubInsights";

export type RadiusHubFilter = {
  side: "buy" | "sell";
  systemId: number | null;
  normalizedStationContains?: string;
  matchKey?: string;
};

export function filterRadiusResultsByHub(
  rows: FlipResult[],
  filter: RadiusHubFilter | null,
): FlipResult[] {
  if (!filter) return rows;
  const hasSystemFilter = !!filter.systemId && filter.systemId > 0;
  const stationNeedle = normalizeHubMatchText(filter.normalizedStationContains);
  const hasStationFilter = stationNeedle.length > 0;
  if (!hasSystemFilter && !hasStationFilter) return rows;

  const matcher = (systemId: number | undefined, stationName: string | undefined) => {
    if (hasSystemFilter && systemId !== filter.systemId) return false;
    if (hasStationFilter) {
      return normalizeHubMatchText(stationName).includes(stationNeedle);
    }
    return true;
  };

  if (filter.side === "buy") {
    return rows.filter((row) => matcher(row.BuySystemID, row.BuyStation));
  }
  return rows.filter((row) => matcher(row.SellSystemID, row.SellStation));
}
