import { routeGroupKey } from "@/lib/batchMetrics";
import { executionQualityForFlip, requestedUnitsForFlip } from "@/lib/executionQuality";
import { classifyRadiusDealRisk } from "@/lib/radiusDealRisk";
import type { FlipResult } from "@/lib/types";

export type RadiusDealSnapshot = {
  key: string;
  routeKey: string;
  typeId: number;
  buyLocationId: number;
  sellLocationId: number;
  expectedProfitIsk: number;
  quantity: number;
  executionQuality: number;
  trapRisk: number;
};

export type RadiusDealMovementLabel = "new" | "stable" | "improving" | "worse" | "collapsing";

export type RadiusDealMovement = {
  key: string;
  label: RadiusDealMovementLabel;
  profitDeltaPct: number;
  quantityDeltaPct: number;
  executionDelta: number;
  trapRiskDelta: number;
};

export type RadiusDealMovementComparison = {
  movementByKey: Map<string, RadiusDealMovement>;
  disappearedKeys: Set<string>;
};

export const RADIUS_DEAL_MOVEMENT_THRESHOLDS = {
  improvingProfitPct: 12,
  worseProfitPct: -12,
  collapsingProfitPct: -35,
  collapsingQuantityPct: -55,
  stableProfitPct: 6,
  stableExecutionDrift: 6,
  stableTrapRiskDrift: 6,
  executionWorseDrift: -12,
  trapRiskWorseDrift: 12,
};

function toFinite(value: number | null | undefined): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function pctDelta(previous: number, current: number): number {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

export function buildRadiusDealSnapshotKey(row: Pick<FlipResult, "TypeID" | "BuyLocationID" | "BuySystemID" | "SellLocationID" | "SellSystemID">): string {
  const buyLocationId = Math.trunc(row.BuyLocationID ?? row.BuySystemID ?? 0);
  const sellLocationId = Math.trunc(row.SellLocationID ?? row.SellSystemID ?? 0);
  const routeKey = routeGroupKey(row as FlipResult);
  return `${routeKey}|${row.TypeID}|${buyLocationId}|${sellLocationId}`;
}

export function buildRadiusDealSnapshots(rows: FlipResult[]): Map<string, RadiusDealSnapshot> {
  const out = new Map<string, RadiusDealSnapshot>();
  for (const row of rows) {
    const key = buildRadiusDealSnapshotKey(row);
    out.set(key, {
      key,
      routeKey: routeGroupKey(row),
      typeId: row.TypeID,
      buyLocationId: Math.trunc(row.BuyLocationID ?? row.BuySystemID ?? 0),
      sellLocationId: Math.trunc(row.SellLocationID ?? row.SellSystemID ?? 0),
      expectedProfitIsk: toFinite(row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit),
      quantity: Math.max(0, requestedUnitsForFlip(row)),
      executionQuality: executionQualityForFlip(row).score,
      trapRisk: classifyRadiusDealRisk(row).score,
    });
  }
  return out;
}

export function compareRadiusDealSnapshots(
  previous: Map<string, RadiusDealSnapshot>,
  current: Map<string, RadiusDealSnapshot>,
): RadiusDealMovementComparison {
  const movementByKey = new Map<string, RadiusDealMovement>();
  const disappearedKeys = new Set<string>();

  for (const [key, curr] of current) {
    const prev = previous.get(key);
    if (!prev) {
      movementByKey.set(key, {
        key,
        label: "new",
        profitDeltaPct: 100,
        quantityDeltaPct: 100,
        executionDelta: 0,
        trapRiskDelta: 0,
      });
      continue;
    }

    const profitDeltaPct = pctDelta(prev.expectedProfitIsk, curr.expectedProfitIsk);
    const quantityDeltaPct = pctDelta(prev.quantity, curr.quantity);
    const executionDelta = curr.executionQuality - prev.executionQuality;
    const trapRiskDelta = curr.trapRisk - prev.trapRisk;

    const collapsing =
      profitDeltaPct <= RADIUS_DEAL_MOVEMENT_THRESHOLDS.collapsingProfitPct ||
      quantityDeltaPct <= RADIUS_DEAL_MOVEMENT_THRESHOLDS.collapsingQuantityPct;
    const improving =
      profitDeltaPct >= RADIUS_DEAL_MOVEMENT_THRESHOLDS.improvingProfitPct &&
      executionDelta > -RADIUS_DEAL_MOVEMENT_THRESHOLDS.stableExecutionDrift &&
      trapRiskDelta < RADIUS_DEAL_MOVEMENT_THRESHOLDS.stableTrapRiskDrift;
    const worse =
      profitDeltaPct <= RADIUS_DEAL_MOVEMENT_THRESHOLDS.worseProfitPct ||
      executionDelta <= RADIUS_DEAL_MOVEMENT_THRESHOLDS.executionWorseDrift ||
      trapRiskDelta >= RADIUS_DEAL_MOVEMENT_THRESHOLDS.trapRiskWorseDrift;

    const stable =
      Math.abs(profitDeltaPct) <= RADIUS_DEAL_MOVEMENT_THRESHOLDS.stableProfitPct &&
      Math.abs(executionDelta) <= RADIUS_DEAL_MOVEMENT_THRESHOLDS.stableExecutionDrift &&
      Math.abs(trapRiskDelta) <= RADIUS_DEAL_MOVEMENT_THRESHOLDS.stableTrapRiskDrift;

    movementByKey.set(key, {
      key,
      label: collapsing ? "collapsing" : improving ? "improving" : worse ? "worse" : stable ? "stable" : "stable",
      profitDeltaPct,
      quantityDeltaPct,
      executionDelta,
      trapRiskDelta,
    });
  }

  for (const key of previous.keys()) {
    if (!current.has(key)) disappearedKeys.add(key);
  }

  return { movementByKey, disappearedKeys };
}
