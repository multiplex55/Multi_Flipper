import { buildFillerCandidates } from "@/lib/fillerCandidates";
import type { LoopOpportunity } from "@/lib/loopPlanner";
import { buildOneLegSuggestions } from "@/features/oneLegMode/oneLegMode";
import { routeLineKey } from "@/lib/batchMetrics";
import type { FlipResult, SavedRoutePack } from "@/lib/types";

export type RouteFillSuggestionType = "core" | "filler" | "loop_backhaul";

export interface RouteFillPlannerSuggestion {
  id: string;
  title: string;
  type: RouteFillSuggestionType;
  incrementalProfitIsk: number;
  addedJumps: number;
  addedM3: number;
  confidencePercent: number;
  rationale: string;
  sourceLineKeys: string[];
}

export interface RouteFillPlannerSections {
  sameEndpointFiller: RouteFillPlannerSuggestion[];
  alongTheWayDetourFiller: RouteFillPlannerSuggestion[];
  backhaulReturnLegFiller: RouteFillPlannerSuggestion[];
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function expectedProfit(row: FlipResult): number {
  return row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? 0;
}

function rowVolume(row: FlipResult): number {
  return Math.max(0, (row.Volume ?? 0) * (row.UnitsToBuy ?? 0));
}

function rankSuggestions(rows: RouteFillPlannerSuggestion[]): RouteFillPlannerSuggestion[] {
  return [...rows].sort((left, right) => {
    if (right.incrementalProfitIsk !== left.incrementalProfitIsk) {
      return right.incrementalProfitIsk - left.incrementalProfitIsk;
    }
    if (right.confidencePercent !== left.confidencePercent) {
      return right.confidencePercent - left.confidencePercent;
    }
    if (left.addedJumps !== right.addedJumps) {
      return left.addedJumps - right.addedJumps;
    }
    return left.id.localeCompare(right.id);
  });
}

export function buildRouteFillPlannerSections(input: {
  rows: FlipResult[];
  pack: SavedRoutePack;
  loops: LoopOpportunity[];
  cargoCapacityM3?: number;
  limitPerSection?: number;
}): RouteFillPlannerSections {
  const { rows, pack, loops, cargoCapacityM3 = 0, limitPerSection = 5 } = input;
  if (rows.length === 0) {
    return {
      sameEndpointFiller: [],
      alongTheWayDetourFiller: [],
      backhaulReturnLegFiller: [],
    };
  }

  const selectedKeys = new Set(pack.selectedLineKeys);
  const anchor = rows.find((row) => selectedKeys.has(routeLineKey(row))) ?? rows[0];
  const anchorJumps = Math.max(0, anchor.TotalJumps ?? 0);

  const selectedVolumeM3 = rows
    .filter((row) => selectedKeys.has(routeLineKey(row)))
    .reduce((sum, row) => sum + rowVolume(row), 0);
  const remainingCargoM3 =
    cargoCapacityM3 > 0 ? Math.max(0, cargoCapacityM3 - selectedVolumeM3) : Number.MAX_SAFE_INTEGER;

  const sameEndpointFiller = rankSuggestions(
    buildFillerCandidates({
      routeRows: rows,
      selectedCoreLineKeys: pack.selectedLineKeys,
      remainingCargoM3,
      remainingCapitalIsk: Number.POSITIVE_INFINITY,
      minConfidencePercent: 0,
      minExecutionQuality: 0,
    }).map((candidate) => ({
      id: `filler:${candidate.lineKey}`,
      title: candidate.typeName,
      type: "filler" as const,
      incrementalProfitIsk: candidate.incrementalProfitIsk,
      addedJumps: Math.max(0, (candidate.row.TotalJumps ?? 0) - anchorJumps),
      addedM3: candidate.incrementalVolumeM3,
      confidencePercent: clamp((candidate.confidencePercent + candidate.executionQuality) / 2, 0, 100),
      rationale: candidate.reason,
      sourceLineKeys: [candidate.lineKey],
    })),
  ).slice(0, limitPerSection);

  const oneLeg = buildOneLegSuggestions({
    rows,
    anchor,
    cargoLimit: cargoCapacityM3,
    limit: limitPerSection * 2,
  });

  const alongTheWayDetourFiller = rankSuggestions(
    oneLeg.sameOriginOrDestination.map((entry) => ({
      id: `core:${entry.lineKey}`,
      title: entry.row.TypeName,
      type: "core" as const,
      incrementalProfitIsk: expectedProfit(entry.row),
      addedJumps: Math.max(0, (entry.row.TotalJumps ?? 0) - anchorJumps),
      addedM3: rowVolume(entry.row),
      confidencePercent: clamp(entry.opportunityScore * 100, 0, 100),
      rationale: `Along-the-way detour candidate (${entry.reason.replaceAll("_", " ")})`,
      sourceLineKeys: [entry.lineKey],
    })),
  ).slice(0, limitPerSection);

  const backhaulReturnLegFiller = rankSuggestions(
    loops.map((loop) => ({
      id: `loop:${loop.id}`,
      title: `${loop.returnLeg.row.TypeName} return leg`,
      type: "loop_backhaul" as const,
      incrementalProfitIsk: loop.totalLoopProfit,
      addedJumps: Math.max(0, loop.detourJumps),
      addedM3: loop.returnLeg.cargoM3,
      confidencePercent: clamp(loop.loopEfficiencyScore, 0, 100),
      rationale: `Backhaul pair ${loop.outbound.row.BuySystemName} → ${loop.returnLeg.row.SellSystemName}`,
      sourceLineKeys: [routeLineKey(loop.outbound.row), routeLineKey(loop.returnLeg.row)],
    })),
  ).slice(0, limitPerSection);

  return {
    sameEndpointFiller,
    alongTheWayDetourFiller,
    backhaulReturnLegFiller,
  };
}
