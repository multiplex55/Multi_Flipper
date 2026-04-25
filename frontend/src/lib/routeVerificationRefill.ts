import { routeLineKey, safeNumber } from "@/lib/batchMetrics";
import { buildFillerCandidates } from "@/lib/fillerCandidates";
import type { FlipResult } from "@/lib/types";

type RefillInput = {
  rows: FlipResult[];
  selectedLineKeys: string[];
  offenderLineKeys: string[];
  cargoCapacityM3: number;
  maxCapitalIsk?: number;
  minConfidencePercent?: number;
  minExecutionQuality?: number;
  maxNewLines?: number;
};

export type RefillResult = {
  selectedLineKeys: string[];
  removedLineKeys: string[];
  addedLineKeys: string[];
  remainingCargoM3: number;
  remainingCapitalIsk: number;
};

function rowVolumeM3(row: FlipResult): number {
  return Math.max(0, safeNumber(row.Volume) * safeNumber(row.UnitsToBuy));
}

function rowCapitalIsk(row: FlipResult): number {
  const buyPrice = safeNumber(row.ExpectedBuyPrice) || safeNumber(row.BuyPrice);
  return Math.max(0, buyPrice * safeNumber(row.UnitsToBuy));
}

export function removeOffendersAndRefill(input: RefillInput): RefillResult {
  const selectedSet = new Set(input.selectedLineKeys);
  const offenderSet = new Set(input.offenderLineKeys);
  const removedLineKeys = input.selectedLineKeys.filter((key) => offenderSet.has(key));
  for (const key of removedLineKeys) selectedSet.delete(key);

  let selectedCargoM3 = 0;
  let selectedCapitalIsk = 0;
  for (const row of input.rows) {
    if (!selectedSet.has(routeLineKey(row))) continue;
    selectedCargoM3 += rowVolumeM3(row);
    selectedCapitalIsk += rowCapitalIsk(row);
  }

  const cargoCapacityM3 = Math.max(0, safeNumber(input.cargoCapacityM3));
  const capitalBudgetIsk = Math.max(0, safeNumber(input.maxCapitalIsk ?? Number.MAX_SAFE_INTEGER));
  const remainingCargoM3 = Math.max(0, cargoCapacityM3 - selectedCargoM3);
  const remainingCapitalIsk = Math.max(0, capitalBudgetIsk - selectedCapitalIsk);

  const candidates = buildFillerCandidates({
    routeRows: input.rows,
    selectedCoreLineKeys: selectedSet,
    remainingCargoM3,
    remainingCapitalIsk,
    minConfidencePercent: input.minConfidencePercent ?? 45,
    minExecutionQuality: input.minExecutionQuality ?? 45,
  });

  const addedLineKeys: string[] = [];
  const maxNewLines = Math.max(0, input.maxNewLines ?? 3);
  for (const candidate of candidates) {
    if (addedLineKeys.length >= maxNewLines) break;
    if (offenderSet.has(candidate.lineKey) || selectedSet.has(candidate.lineKey)) continue;
    selectedSet.add(candidate.lineKey);
    addedLineKeys.push(candidate.lineKey);
  }

  return {
    selectedLineKeys: Array.from(selectedSet).sort((a, b) => a.localeCompare(b)),
    removedLineKeys,
    addedLineKeys,
    remainingCargoM3,
    remainingCapitalIsk,
  };
}
