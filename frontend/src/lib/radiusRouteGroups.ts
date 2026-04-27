import { routeGroupKey, safeNumber } from "@/lib/batchMetrics";
import { getRadiusRouteExecutionBadge, type RadiusRouteStatus } from "@/lib/radiusRouteStatus";
import type { RouteAssignment } from "@/lib/routeAssignments";
import type { RouteQueueEntry } from "@/lib/routeQueue";
import type { RadiusRouteInsights } from "@/lib/useRadiusRouteInsights";
import type { FlipResult } from "@/lib/types";

export type RadiusRouteGroupAggregate = {
  routeKey: string;
  routeLabel: string;
  totalProfit: number;
  totalCapital: number;
  roiPercent: number;
  iskPerJump: number;
  jumps: number;
  itemCount: number;
  cargoUsedPercent: number;
  weakestExecutionQuality: number;
  urgencyBand: "stable" | "aging" | "fragile";
  status: RadiusRouteStatus;
  assignedPilot: string;
  verificationStatus: string;
};

export function buildRadiusRouteGroups(params: {
  rows: FlipResult[];
  routeInsightsSnapshot?: RadiusRouteInsights;
  routeQueueEntries?: RouteQueueEntry[];
  routeAssignmentsByKey?: Record<string, RouteAssignment>;
  cargoCapacityM3?: number;
}): RadiusRouteGroupAggregate[] {
  const {
    rows,
    routeInsightsSnapshot,
    routeQueueEntries = [],
    routeAssignmentsByKey = {},
    cargoCapacityM3 = 0,
  } = params;

  const routeSummaryByKey = new Map(
    (routeInsightsSnapshot?.routeSummaries ?? []).map((summary) => [summary.routeKey, summary]),
  );

  const groups = new Map<string, FlipResult[]>();
  for (const row of rows) {
    const key = routeGroupKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const aggregates = Array.from(groups.entries()).map(([key, routeRows]) => {
    const sortedRows = [...routeRows].sort((left, right) => {
      const leftName = String(left.TypeName ?? "");
      const rightName = String(right.TypeName ?? "");
      const nameCmp = leftName.localeCompare(rightName);
      if (nameCmp !== 0) return nameCmp;
      return safeNumber(left.TypeID) - safeNumber(right.TypeID);
    });
    const anchor = sortedRows[0];
    const routeSummary = routeSummaryByKey.get(key);
    const totalProfit = sortedRows.reduce((sum, row) => sum + Math.max(0, safeNumber(row.TotalProfit)), 0);
    const totalCapital = sortedRows.reduce((sum, row) => sum + Math.max(0, safeNumber(row.BuyPrice) * safeNumber(row.UnitsToBuy)), 0);
    const jumps = sortedRows.reduce((max, row) => Math.max(max, Math.max(1, safeNumber(row.TotalJumps))), 0);
    const totalCargoM3 = sortedRows.reduce((sum, row) => sum + Math.max(0, safeNumber(row.Volume) * safeNumber(row.UnitsToBuy)), 0);
    const urgencyBand = sortedRows.some((row) => row.urgency_band === "fragile")
      ? "fragile"
      : sortedRows.some((row) => row.urgency_band === "aging")
        ? "aging"
        : "stable";
    const executionBadge = getRadiusRouteExecutionBadge(key, routeQueueEntries, routeAssignmentsByKey);

    return {
      routeKey: key,
      routeLabel: routeSummary?.routeLabel ?? `${anchor.BuyStation || anchor.BuySystemName} → ${anchor.SellStation || anchor.SellSystemName}`,
      totalProfit,
      totalCapital,
      roiPercent: totalCapital > 0 ? (totalProfit / totalCapital) * 100 : 0,
      iskPerJump: jumps > 0 ? totalProfit / jumps : 0,
      jumps,
      itemCount: sortedRows.length,
      cargoUsedPercent: cargoCapacityM3 > 0 ? (totalCargoM3 / cargoCapacityM3) * 100 : 0,
      weakestExecutionQuality: routeSummary?.aggregate.weakestExecutionQuality ?? 0,
      urgencyBand,
      status: executionBadge.status,
      assignedPilot: executionBadge.assignedPilotName ?? "",
      verificationStatus: routeSummary?.verificationStatus ?? "Unknown",
    } satisfies RadiusRouteGroupAggregate;
  });

  return aggregates.sort((left, right) => {
    if (right.totalProfit !== left.totalProfit) return right.totalProfit - left.totalProfit;
    if (right.roiPercent !== left.roiPercent) return right.roiPercent - left.roiPercent;
    const labelCmp = left.routeLabel.localeCompare(right.routeLabel);
    if (labelCmp !== 0) return labelCmp;
    return left.routeKey.localeCompare(right.routeKey);
  });
}
