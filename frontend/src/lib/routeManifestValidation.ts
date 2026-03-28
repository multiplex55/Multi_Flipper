import type { OrderedRouteManifest, RouteStationManifest } from "@/lib/types";

const DEFAULT_ISK_TOLERANCE = 1;
const DEFAULT_VOLUME_TOLERANCE = 0.1;

type Severity = "error" | "warning";

export interface RouteManifestValidationIssue {
  severity: Severity;
  code:
    | "RMV_HOP_ITEM_COUNT_MISMATCH"
    | "RMV_HOP_TOTAL_BUY_MISMATCH"
    | "RMV_HOP_TOTAL_SELL_MISMATCH"
    | "RMV_HOP_TOTAL_PROFIT_MISMATCH"
    | "RMV_HOP_TOTAL_VOLUME_MISMATCH"
    | "RMV_ROUTE_TOTAL_BUY_MISMATCH"
    | "RMV_ROUTE_TOTAL_SELL_MISMATCH"
    | "RMV_ROUTE_TOTAL_PROFIT_MISMATCH"
    | "RMV_ROUTE_TOTAL_VOLUME_MISMATCH"
    | "RMV_ROUTE_TOTAL_ITEMS_MISMATCH"
    | "RMV_HOP_MISSING_JUMPS_TO_BUY"
    | "RMV_HOP_MISSING_JUMPS_BUY_TO_SELL"
    | "RMV_HOP_JUMPS_TO_BUY_NOT_MONOTONIC"
    | "RMV_HOP_JUMPS_TO_BUY_DERIVATION_MISMATCH";
  message: string;
  stationKey?: string;
  hopIndex?: number;
}

export interface RouteManifestValidationResult {
  errors: RouteManifestValidationIssue[];
  warnings: RouteManifestValidationIssue[];
  isValid: boolean;
  isUsable: boolean;
}

function nearlyEqual(left: number, right: number, tolerance: number): boolean {
  return Math.abs(left - right) <= tolerance;
}

function sumStationLines(station: RouteStationManifest) {
  return station.lines.reduce(
    (acc, line) => {
      acc.buy += line.buy_total_isk;
      acc.sell += line.sell_total_isk;
      acc.profit += line.profit_isk;
      acc.volume += line.volume_m3;
      return acc;
    },
    { buy: 0, sell: 0, profit: 0, volume: 0 },
  );
}

export function validateOrderedRouteManifest(manifest: OrderedRouteManifest): RouteManifestValidationResult {
  const issues: RouteManifestValidationIssue[] = [];

  let expectedNextJumpToBuy = 0;
  let lastKnownJumpToBuy = 0;

  for (const [index, station] of manifest.stations.entries()) {
    const lineSums = sumStationLines(station);
    const id = { stationKey: station.station_key, hopIndex: index };

    if (station.item_count !== station.lines.length) {
      issues.push({
        severity: "error",
        code: "RMV_HOP_ITEM_COUNT_MISMATCH",
        message: `Hop ${index + 1} (${station.station_key}) item_count=${station.item_count} but lines=${station.lines.length}.`,
        ...id,
      });
    }

    if (!nearlyEqual(station.total_buy_isk, lineSums.buy, DEFAULT_ISK_TOLERANCE)) {
      issues.push({
        severity: "error",
        code: "RMV_HOP_TOTAL_BUY_MISMATCH",
        message: `Hop ${index + 1} (${station.station_key}) total_buy_isk=${station.total_buy_isk} but sum(lines.buy_total_isk)=${lineSums.buy}.`,
        ...id,
      });
    }
    if (!nearlyEqual(station.total_sell_isk, lineSums.sell, DEFAULT_ISK_TOLERANCE)) {
      issues.push({
        severity: "error",
        code: "RMV_HOP_TOTAL_SELL_MISMATCH",
        message: `Hop ${index + 1} (${station.station_key}) total_sell_isk=${station.total_sell_isk} but sum(lines.sell_total_isk)=${lineSums.sell}.`,
        ...id,
      });
    }
    if (!nearlyEqual(station.total_profit_isk, lineSums.profit, DEFAULT_ISK_TOLERANCE)) {
      issues.push({
        severity: "error",
        code: "RMV_HOP_TOTAL_PROFIT_MISMATCH",
        message: `Hop ${index + 1} (${station.station_key}) total_profit_isk=${station.total_profit_isk} but sum(lines.profit_isk)=${lineSums.profit}.`,
        ...id,
      });
    }
    if (!nearlyEqual(station.total_volume_m3, lineSums.volume, DEFAULT_VOLUME_TOLERANCE)) {
      issues.push({
        severity: "error",
        code: "RMV_HOP_TOTAL_VOLUME_MISMATCH",
        message: `Hop ${index + 1} (${station.station_key}) total_volume_m3=${station.total_volume_m3} but sum(lines.volume_m3)=${lineSums.volume}.`,
        ...id,
      });
    }

    if (station.jumps_to_buy_station == null) {
      issues.push({
        severity: "warning",
        code: "RMV_HOP_MISSING_JUMPS_TO_BUY",
        message: `Hop ${index + 1} (${station.station_key}) is missing jumps_to_buy_station; cumulative progression check skipped for this hop.`,
        ...id,
      });
    } else {
      if (station.jumps_to_buy_station < lastKnownJumpToBuy) {
        issues.push({
          severity: "error",
          code: "RMV_HOP_JUMPS_TO_BUY_NOT_MONOTONIC",
          message: `Hop ${index + 1} (${station.station_key}) jumps_to_buy_station=${station.jumps_to_buy_station} decreased from previous ${lastKnownJumpToBuy}.`,
          ...id,
        });
      }
      if (station.jumps_to_buy_station !== expectedNextJumpToBuy) {
        issues.push({
          severity: "error",
          code: "RMV_HOP_JUMPS_TO_BUY_DERIVATION_MISMATCH",
          message: `Hop ${index + 1} (${station.station_key}) jumps_to_buy_station=${station.jumps_to_buy_station} expected=${expectedNextJumpToBuy} from prior cumulative jumps_buy_to_sell.`,
          ...id,
        });
      }
      lastKnownJumpToBuy = station.jumps_to_buy_station;
    }

    if (station.jumps_buy_to_sell == null) {
      issues.push({
        severity: "warning",
        code: "RMV_HOP_MISSING_JUMPS_BUY_TO_SELL",
        message: `Hop ${index + 1} (${station.station_key}) is missing jumps_buy_to_sell; cumulative progression check for later hops may be incomplete.`,
        ...id,
      });
    } else {
      expectedNextJumpToBuy += Math.trunc(station.jumps_buy_to_sell);
    }
  }

  if (manifest.summary) {
    const summary = manifest.summary;
    const hopTotals = manifest.stations.reduce(
      (acc, station) => {
        acc.buy += station.total_buy_isk;
        acc.sell += station.total_sell_isk;
        acc.profit += station.total_profit_isk;
        acc.volume += station.total_volume_m3;
        acc.items += station.item_count;
        return acc;
      },
      { buy: 0, sell: 0, profit: 0, volume: 0, items: 0 },
    );

    if (!nearlyEqual(summary.total_buy_isk, hopTotals.buy, DEFAULT_ISK_TOLERANCE)) {
      issues.push({ severity: "error", code: "RMV_ROUTE_TOTAL_BUY_MISMATCH", message: `Route summary total_buy_isk=${summary.total_buy_isk} but sum(hops.total_buy_isk)=${hopTotals.buy}.` });
    }
    if (!nearlyEqual(summary.total_sell_isk, hopTotals.sell, DEFAULT_ISK_TOLERANCE)) {
      issues.push({ severity: "error", code: "RMV_ROUTE_TOTAL_SELL_MISMATCH", message: `Route summary total_sell_isk=${summary.total_sell_isk} but sum(hops.total_sell_isk)=${hopTotals.sell}.` });
    }
    if (!nearlyEqual(summary.total_profit_isk, hopTotals.profit, DEFAULT_ISK_TOLERANCE)) {
      issues.push({ severity: "error", code: "RMV_ROUTE_TOTAL_PROFIT_MISMATCH", message: `Route summary total_profit_isk=${summary.total_profit_isk} but sum(hops.total_profit_isk)=${hopTotals.profit}.` });
    }
    if (!nearlyEqual(summary.total_volume_m3, hopTotals.volume, DEFAULT_VOLUME_TOLERANCE)) {
      issues.push({ severity: "error", code: "RMV_ROUTE_TOTAL_VOLUME_MISMATCH", message: `Route summary total_volume_m3=${summary.total_volume_m3} but sum(hops.total_volume_m3)=${hopTotals.volume}.` });
    }
    if (summary.item_count !== hopTotals.items) {
      issues.push({ severity: "error", code: "RMV_ROUTE_TOTAL_ITEMS_MISMATCH", message: `Route summary item_count=${summary.item_count} but sum(hops.item_count)=${hopTotals.items}.` });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
    isUsable: errors.length === 0,
  };
}

export function formatRouteManifestValidationIssues(issues: RouteManifestValidationIssue[]): string {
  return issues
    .map((issue) => {
      const loc = issue.stationKey ? ` [hop=${(issue.hopIndex ?? 0) + 1}, station=${issue.stationKey}]` : "";
      return `[${issue.code}]${loc} ${issue.message}`;
    })
    .join("\n");
}
