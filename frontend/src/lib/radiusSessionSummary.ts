import type { FlipResult } from "@/lib/types";
import { isRadiusTradeExecutableNow } from "@/lib/radiusExecutableNow";
import type { RadiusRouteStatus } from "@/lib/radiusRouteStatus";
import type { RadiusVerificationState } from "@/lib/radiusVerificationStatus";

export type RadiusSummaryRouteState = {
  status?: RadiusRouteStatus;
  assignedPilotName?: string | null;
  verificationState?: RadiusVerificationState | null;
};

export type RadiusSessionSummaryInput = {
  totalRows: FlipResult[];
  visibleRows: FlipResult[];
  hiddenRowCount: number;
  activeFilterCount: number;
  getRouteKey: (row: FlipResult) => string;
  routeStateByKey?: Record<string, RadiusSummaryRouteState>;
};

export type RadiusSessionSummary = {
  totalRowCount: number;
  visibleRowCount: number;
  routeCount: number;
  executableRowCount: number;
  queuedRowCount: number;
  assignedRowCount: number;
  staleRowCount: number;
  hiddenRowCount: number;
  activeFilterCount: number;
};

export function computeRadiusSessionSummary(
  input: RadiusSessionSummaryInput,
): RadiusSessionSummary {
  const routeKeys = new Set<string>();
  for (const row of input.totalRows) {
    routeKeys.add(input.getRouteKey(row));
  }

  let executableRowCount = 0;
  let queuedRowCount = 0;
  let assignedRowCount = 0;
  let staleRowCount = 0;

  for (const row of input.visibleRows) {
    const routeKey = input.getRouteKey(row);
    const routeState = input.routeStateByKey?.[routeKey];
    const status = routeState?.status;
    const assignedPilotName = routeState?.assignedPilotName;
    const verificationState = routeState?.verificationState;

    if (status === "queued") queuedRowCount += 1;
    if (status === "assigned" || (assignedPilotName ?? "").trim().length > 0) assignedRowCount += 1;
    if (verificationState === "stale" || status === "needs_verify") staleRowCount += 1;

    if (
      isRadiusTradeExecutableNow({
        row,
        routeStatus: status,
        assignedPilotName,
        verificationState,
      })
    ) {
      executableRowCount += 1;
    }
  }

  return {
    totalRowCount: input.totalRows.length,
    visibleRowCount: input.visibleRows.length,
    routeCount: routeKeys.size,
    executableRowCount,
    queuedRowCount,
    assignedRowCount,
    staleRowCount,
    hiddenRowCount: input.hiddenRowCount,
    activeFilterCount: input.activeFilterCount,
  };
}
