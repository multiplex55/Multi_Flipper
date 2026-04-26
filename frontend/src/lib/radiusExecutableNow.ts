import type { RadiusRouteStatus } from "@/lib/radiusRouteStatus";
import type { RadiusVerificationState } from "@/lib/radiusVerificationStatus";
import { breakevenBufferForFlip, executionQualityForFlip, requestedUnitsForFlip } from "@/lib/executionQuality";
import { turnoverDays } from "@/lib/radiusMetrics";
import type { FlipResult } from "@/lib/types";

export type RadiusExecutableNowOptions = {
  minProfit: number;
  minFillRatio: number;
  minExecutionQuality: number;
  maxTurnoverDays: number;
  minBreakevenBufferPct: number;
  excludedRouteStatuses: RadiusRouteStatus[];
  excludeAssignedRoutes: boolean;
  excludeVerificationAbort: boolean;
};

export type RadiusExecutableNowInput = {
  row: FlipResult;
  routeStatus?: RadiusRouteStatus;
  assignedPilotName?: string | null;
  verificationState?: RadiusVerificationState | null;
};

const DEFAULT_RADIUS_EXECUTABLE_NOW_OPTIONS: RadiusExecutableNowOptions = {
  minProfit: 0,
  minFillRatio: 0.75,
  minExecutionQuality: 55,
  maxTurnoverDays: 21,
  minBreakevenBufferPct: 0.5,
  excludedRouteStatuses: ["queued", "assigned", "buying", "hauling", "selling"],
  excludeAssignedRoutes: true,
  excludeVerificationAbort: true,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function radiusExecutableNowDefaults(
  overrides: Partial<RadiusExecutableNowOptions> = {},
): RadiusExecutableNowOptions {
  return {
    ...DEFAULT_RADIUS_EXECUTABLE_NOW_OPTIONS,
    ...overrides,
  };
}

export function isRadiusTradeExecutableNow(
  input: RadiusExecutableNowInput,
  overrides: Partial<RadiusExecutableNowOptions> = {},
): boolean {
  const options = radiusExecutableNowDefaults(overrides);

  const status = input.routeStatus;
  if (status && options.excludedRouteStatuses.includes(status)) return false;
  if (options.excludeAssignedRoutes && (input.assignedPilotName ?? "").trim().length > 0) return false;
  if (options.excludeVerificationAbort && input.verificationState === "abort") return false;

  const expectedProfit = Math.max(
    Number(input.row.ExpectedProfit ?? Number.NEGATIVE_INFINITY),
    Number(input.row.RealProfit ?? Number.NEGATIVE_INFINITY),
    Number(input.row.TotalProfit ?? 0),
  );
  if (!Number.isFinite(expectedProfit) || expectedProfit < options.minProfit) return false;

  const requestedUnits = requestedUnitsForFlip(input.row);
  const filledUnits = Math.max(
    0,
    input.row.FilledQty ?? Math.min(input.row.BuyOrderRemain ?? 0, input.row.SellOrderRemain ?? 0),
  );
  const fillRatio = requestedUnits > 0
    ? clamp01(filledUnits / requestedUnits)
    : input.row.CanFill === false
      ? 0
      : 1;
  if (fillRatio < options.minFillRatio) return false;

  const quality = executionQualityForFlip(input.row).score;
  if (quality < options.minExecutionQuality) return false;

  const turnover = turnoverDays(input.row);
  if (turnover == null || !Number.isFinite(turnover) || turnover > options.maxTurnoverDays) return false;

  const beBuffer = breakevenBufferForFlip(input.row);
  if (beBuffer < options.minBreakevenBufferPct) return false;

  return true;
}
