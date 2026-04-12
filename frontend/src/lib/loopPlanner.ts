import type { FlipResult } from "@/lib/types";
import { safeNumber } from "@/lib/batchMetrics";

export type LoopPlannerOptions = {
  homeSystemId?: number;
  homeSystemName?: string;
  maxDetourJumps: number;
  cargoCapacityM3?: number | null;
  minLegProfit: number;
  minTotalLoopProfit: number;
  maxResults?: number;
};

export type LoopLegSummary = {
  rowIndex: number;
  row: FlipResult;
  profit: number;
  jumps: number;
  cargoM3: number;
};

export type LoopOpportunity = {
  id: string;
  outbound: LoopLegSummary;
  returnLeg: LoopLegSummary;
  detourJumps: number;
  outboundProfit: number;
  returnProfit: number;
  totalLoopProfit: number;
  totalLoopJumps: number;
  emptyJumpsAvoided: number;
  deadheadRatio: number;
  loopEfficiencyScore: number;
};

function legUnits(row: FlipResult): number {
  const filled = Math.floor(Math.max(0, safeNumber(row.FilledQty)));
  if (filled > 0) return filled;
  const units = Math.floor(Math.max(0, safeNumber(row.UnitsToBuy)));
  if (units > 0) return units;
  const buyRemain = Math.floor(Math.max(0, safeNumber(row.BuyOrderRemain)));
  const sellRemain = Math.floor(Math.max(0, safeNumber(row.SellOrderRemain)));
  if (buyRemain > 0 && sellRemain > 0) return Math.min(buyRemain, sellRemain);
  return Math.max(buyRemain, sellRemain);
}

function legProfit(row: FlipResult): number {
  const real = safeNumber(row.RealProfit);
  if (real > 0) return real;
  return safeNumber(row.TotalProfit);
}

function legJumps(row: FlipResult): number {
  return Math.max(1, safeNumber(row.TotalJumps));
}

function isHomeAnchorStart(row: FlipResult, homeSystemId: number, homeSystemName: string): boolean {
  return (
    safeNumber(row.BuySystemID) === homeSystemId ||
    (homeSystemName.length > 0 && (row.BuySystemName || "").toLowerCase() === homeSystemName)
  );
}

function isHomeAnchorEnd(row: FlipResult, homeSystemId: number, homeSystemName: string): boolean {
  return (
    safeNumber(row.SellSystemID) === homeSystemId ||
    (homeSystemName.length > 0 && (row.SellSystemName || "").toLowerCase() === homeSystemName)
  );
}

function connectorDetourJumps(outbound: FlipResult, returnLeg: FlipResult): number {
  const outDest = safeNumber(outbound.SellSystemID);
  const retOrigin = safeNumber(returnLeg.BuySystemID);
  if (outDest > 0 && retOrigin > 0 && outDest === retOrigin) return 0;

  const outDestName = (outbound.SellSystemName || "").trim().toLowerCase();
  const retOriginName = (returnLeg.BuySystemName || "").trim().toLowerCase();
  if (outDestName.length > 0 && outDestName === retOriginName) return 0;

  const outRegion = safeNumber(outbound.SellRegionID);
  const retRegion = safeNumber(returnLeg.BuyRegionID);
  if (outRegion > 0 && retRegion > 0 && outRegion === retRegion) return 1;

  return 2;
}

export function computeLoopOpportunities(
  rows: FlipResult[],
  options: LoopPlannerOptions,
): LoopOpportunity[] {
  const homeSystemId = Math.floor(safeNumber(options.homeSystemId));
  const homeSystemName = (options.homeSystemName || "").trim().toLowerCase();
  if (homeSystemId <= 0 && homeSystemName.length === 0) return [];

  const maxDetourJumps = Math.max(0, Math.floor(safeNumber(options.maxDetourJumps)));
  const minLegProfit = Math.max(0, safeNumber(options.minLegProfit));
  const minTotalLoopProfit = Math.max(0, safeNumber(options.minTotalLoopProfit));
  const cargoLimit = safeNumber(options.cargoCapacityM3);
  const hasCargoLimit = cargoLimit > 0;
  const maxResults = Math.max(1, Math.floor(safeNumber(options.maxResults) || 25));

  const outboundCandidates = rows
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ row }) => isHomeAnchorStart(row, homeSystemId, homeSystemName));

  const returnCandidates = rows
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ row }) => isHomeAnchorEnd(row, homeSystemId, homeSystemName));

  const loops: LoopOpportunity[] = [];

  for (const outboundEntry of outboundCandidates) {
    for (const returnEntry of returnCandidates) {
      if (outboundEntry.rowIndex === returnEntry.rowIndex) continue;

      const outboundRow = outboundEntry.row;
      const returnRow = returnEntry.row;
      const detourJumps = connectorDetourJumps(outboundRow, returnRow);
      if (detourJumps > maxDetourJumps) continue;

      const outboundUnits = legUnits(outboundRow);
      const returnUnits = legUnits(returnRow);
      if (outboundUnits <= 0 || returnUnits <= 0) continue;

      const outboundCargo = outboundUnits * Math.max(0, safeNumber(outboundRow.Volume));
      const returnCargo = returnUnits * Math.max(0, safeNumber(returnRow.Volume));
      if (hasCargoLimit && (outboundCargo > cargoLimit || returnCargo > cargoLimit)) {
        continue;
      }

      const outboundProfit = legProfit(outboundRow);
      const returnProfit = legProfit(returnRow);
      if (outboundProfit < minLegProfit || returnProfit < minLegProfit) continue;

      const totalLoopProfit = outboundProfit + returnProfit;
      if (totalLoopProfit < minTotalLoopProfit) continue;

      const outboundJumps = legJumps(outboundRow);
      const returnJumps = legJumps(returnRow);
      const totalLoopJumps = outboundJumps + detourJumps + returnJumps;

      const standaloneEmptyJumps =
        Math.max(0, safeNumber(outboundRow.SellJumps)) +
        Math.max(0, safeNumber(returnRow.BuyJumps));
      const emptyJumpsAvoided = Math.max(0, standaloneEmptyJumps - detourJumps);
      const deadheadRatio =
        totalLoopJumps > 0 ? Math.max(0, Math.min(1, detourJumps / totalLoopJumps)) : 0;

      const iskPerJump = totalLoopProfit / Math.max(1, totalLoopJumps);
      const profitNorm = Math.max(0, Math.min(1, iskPerJump / 1_000_000));
      const avoidedNorm =
        standaloneEmptyJumps > 0
          ? Math.max(0, Math.min(1, emptyJumpsAvoided / standaloneEmptyJumps))
          : detourJumps === 0
            ? 1
            : 0;
      const deadheadPenalty = 1 - deadheadRatio * 0.4;
      const loopEfficiencyScore = Math.max(
        0,
        Math.min(100, (0.65 * profitNorm + 0.35 * avoidedNorm) * deadheadPenalty * 100),
      );

      loops.push({
        id: `${outboundEntry.rowIndex}:${returnEntry.rowIndex}:${detourJumps}`,
        outbound: {
          rowIndex: outboundEntry.rowIndex,
          row: outboundRow,
          profit: outboundProfit,
          jumps: outboundJumps,
          cargoM3: outboundCargo,
        },
        returnLeg: {
          rowIndex: returnEntry.rowIndex,
          row: returnRow,
          profit: returnProfit,
          jumps: returnJumps,
          cargoM3: returnCargo,
        },
        detourJumps,
        outboundProfit,
        returnProfit,
        totalLoopProfit,
        totalLoopJumps,
        emptyJumpsAvoided,
        deadheadRatio,
        loopEfficiencyScore,
      });
    }
  }

  return loops
    .sort((left, right) => {
      if (right.totalLoopProfit !== left.totalLoopProfit) {
        return right.totalLoopProfit - left.totalLoopProfit;
      }
      if (right.loopEfficiencyScore !== left.loopEfficiencyScore) {
        return right.loopEfficiencyScore - left.loopEfficiencyScore;
      }
      if (left.totalLoopJumps !== right.totalLoopJumps) {
        return left.totalLoopJumps - right.totalLoopJumps;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, maxResults);
}
