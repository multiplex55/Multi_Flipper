import type { FlipResult } from "@/lib/types";

export type HubDirection = "buy" | "sell";

export type RadiusMajorHubDefinition = {
  key: "jita" | "amarr" | "dodixie" | "hek" | "rens" | "perimeter_ttt";
  label: string;
  systemName: string;
  systemId: number;
  structureName?: string;
};

export type RadiusMajorHubDirectionMetrics = {
  rowCount: number;
  distinctItems: number;
  totalProfit: number;
  totalCapital: number;
};

export type RadiusMajorHubMetrics = {
  hub: RadiusMajorHubDefinition;
  buy: RadiusMajorHubDirectionMetrics;
  sell: RadiusMajorHubDirectionMetrics;
};

export type RadiusMajorHubRowEvaluationContext = {
  /**
   * True when the row is ignored by session-level station hides
   * (SessionStationFilters ignored buy/sell station ids).
   */
  excludedBySessionStationIgnore?: boolean;
  /**
   * True when endpoint-preference policy explicitly excludes this row.
   */
  excludedByEndpointPreferences?: boolean;
  /**
   * True when the active route-safety filter excludes this row.
   */
  excludedByRouteSafetyFilter?: boolean;
  /**
   * True when the row is currently hidden or excluded by row-level visibility state.
   */
  excludedByRowVisibility?: boolean;
  /**
   * Product policy hook for additional fillability / stale-degraded exclusions.
   * Keep false when no extra policy applies.
   */
  excludedByFillabilityOrStalePolicy?: boolean;
};

const ZERO_DIRECTION_METRICS: RadiusMajorHubDirectionMetrics = {
  rowCount: 0,
  distinctItems: 0,
  totalProfit: 0,
  totalCapital: 0,
};

export const RADIUS_CANONICAL_MAJOR_HUBS: RadiusMajorHubDefinition[] = [
  { key: "jita", label: "Jita", systemName: "Jita", systemId: 30000142 },
  { key: "amarr", label: "Amarr", systemName: "Amarr", systemId: 30002187 },
  { key: "dodixie", label: "Dodixie", systemName: "Dodixie", systemId: 30002659 },
  { key: "hek", label: "Hek", systemName: "Hek", systemId: 30002053 },
  { key: "rens", label: "Rens", systemName: "Rens", systemId: 30002510 },
  {
    key: "perimeter_ttt",
    label: "Perimeter / TTT",
    systemName: "Perimeter",
    systemId: 30000144,
    structureName: "Tranquility Trading Tower",
  },
];

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function metricOf(row: FlipResult, direction: HubDirection): {
  systemId: number;
  systemName: string;
  stationName: string;
  capital: number;
  profit: number;
} {
  if (direction === "buy") {
    return {
      systemId: Math.trunc(row.BuySystemID ?? 0),
      systemName: row.BuySystemName ?? "",
      stationName: row.BuyStation ?? "",
      capital: Number(row.DayCapitalRequired ?? row.BuyPrice * Math.max(0, row.UnitsToBuy ?? 0)),
      profit: Number(row.DayPeriodProfit ?? row.TotalProfit ?? row.ExpectedProfit ?? 0),
    };
  }
  return {
    systemId: Math.trunc(row.SellSystemID ?? 0),
    systemName: row.SellSystemName ?? "",
    stationName: row.SellStation ?? "",
    capital: Number(row.DayCapitalRequired ?? row.BuyPrice * Math.max(0, row.UnitsToBuy ?? 0)),
    profit: Number(row.DayPeriodProfit ?? row.TotalProfit ?? row.ExpectedProfit ?? 0),
  };
}

export function isRadiusActionableRow(row: FlipResult): boolean {
  if (!row || row.TypeID <= 0) return false;
  if ((row.UnitsToBuy ?? 0) <= 0) return false;
  if ((row.TotalProfit ?? row.ExpectedProfit ?? 0) <= 0) return false;
  if (row.CanFill === false) return false;
  return true;
}

/**
 * Canonical policy for major-hub counting.
 *
 * A row is counted only when ALL of the following are true:
 * 1) It passes low-level actionable checks (`isRadiusActionableRow`).
 * 2) It is not ignored by session station filters.
 * 3) It is not excluded by endpoint preferences.
 * 4) It is not excluded by the active route-safety filter state.
 * 5) It is not hidden/excluded by row visibility state.
 * 6) It does not fail product-defined fillability/stale-degraded policy.
 */
export function isRowCountedInMajorHubMetrics(
  row: FlipResult,
  context: RadiusMajorHubRowEvaluationContext = {},
): boolean {
  if (!isRadiusActionableRow(row)) return false;
  if (context.excludedBySessionStationIgnore) return false;
  if (context.excludedByEndpointPreferences) return false;
  if (context.excludedByRouteSafetyFilter) return false;
  if (context.excludedByRowVisibility) return false;
  if (context.excludedByFillabilityOrStalePolicy) return false;
  return true;
}

function matchesHub(
  hub: RadiusMajorHubDefinition,
  row: FlipResult,
  direction: HubDirection,
): boolean {
  const metric = metricOf(row, direction);
  if (hub.structureName) {
    return normalize(metric.stationName).includes(normalize(hub.structureName));
  }
  return (
    metric.systemId === hub.systemId ||
    normalize(metric.systemName) === normalize(hub.systemName)
  );
}

export function buildRadiusMajorHubInsights(
  rows: FlipResult[],
  resolveContext?: (row: FlipResult) => RadiusMajorHubRowEvaluationContext,
): RadiusMajorHubMetrics[] {
  const countedRows = rows.filter((row) =>
    isRowCountedInMajorHubMetrics(row, resolveContext?.(row)),
  );

  return RADIUS_CANONICAL_MAJOR_HUBS.map((hub) => {
    const buyTypeIds = new Set<number>();
    const sellTypeIds = new Set<number>();
    const buy = { ...ZERO_DIRECTION_METRICS };
    const sell = { ...ZERO_DIRECTION_METRICS };

    for (const row of countedRows) {
      if (matchesHub(hub, row, "buy")) {
        buy.rowCount += 1;
        buy.totalProfit += Number(row.DayPeriodProfit ?? row.TotalProfit ?? row.ExpectedProfit ?? 0);
        buy.totalCapital += Number(row.DayCapitalRequired ?? row.BuyPrice * Math.max(0, row.UnitsToBuy ?? 0));
        buyTypeIds.add(row.TypeID);
      }
      if (matchesHub(hub, row, "sell")) {
        sell.rowCount += 1;
        sell.totalProfit += Number(row.DayPeriodProfit ?? row.TotalProfit ?? row.ExpectedProfit ?? 0);
        sell.totalCapital += Number(row.DayCapitalRequired ?? row.BuyPrice * Math.max(0, row.UnitsToBuy ?? 0));
        sellTypeIds.add(row.TypeID);
      }
    }

    buy.distinctItems = buyTypeIds.size;
    sell.distinctItems = sellTypeIds.size;

    return { hub, buy, sell };
  });
}
