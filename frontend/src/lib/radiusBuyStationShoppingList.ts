import { routeGroupKey } from "@/lib/batchMetrics";
import { executionQualityForFlip, requestedUnitsForFlip } from "@/lib/executionQuality";
import { classifyRadiusDealRisk } from "@/lib/radiusDealRisk";
import type { FlipResult } from "@/lib/types";
import {
  combineComparators,
  compareNumberDesc,
  compareTextAsc,
  createMetricNormalizer,
  finiteNumber,
} from "@/lib/radiusDecisionGuardrails";

export type RadiusBuyStationShoppingListLine = {
  row: FlipResult;
  units: number;
  volumeM3: number;
  capitalIsk: number;
  grossSellIsk: number;
  profitIsk: number;
  routeKey: string;
  executionQuality: number;
  confidence: number;
  trapRisk: number;
};

export type RadiusBuyStationShoppingList = {
  id: string;
  buyGroupId: number;
  buyStationName: string;
  buySystemName: string;
  buySystemId: number;
  routeCount: number;
  itemCount: number;
  units: number;
  volumeM3: number;
  cargoFillPercent: number;
  capitalIsk: number;
  grossSellIsk: number;
  totalProfitIsk: number;
  capitalEfficiency: number;
  bestIskPerJump: number;
  avgExecutionQuality: number;
  confidence: number;
  worstTrapRisk: number;
  actionableScore: number;
  primarySellStation: string;
  lines: RadiusBuyStationShoppingListLine[];
};

export type BuildRadiusBuyStationShoppingListsInput = {
  rows: FlipResult[];
  cargoCapacityM3?: number;
  maxCapitalIsk?: number;
  maxLists?: number;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function stableBuyGroupId(row: FlipResult): number {
  return Math.trunc(row.BuyLocationID ?? row.BuySystemID ?? 0);
}

function resolveBuyStationName(row: FlipResult): string {
  return (row.BuyStation || row.BuySystemName || "Unknown buy station").trim();
}

function resolveSellStationName(row: FlipResult): string {
  return (row.SellStation || row.SellSystemName || "Unknown sell station").trim();
}

function rowPricing(row: FlipResult) {
  const units = Math.max(0, requestedUnitsForFlip(row));
  const volume = Math.max(0, Number(row.Volume ?? 0));
  const buyPrice = Math.max(0, Number(row.ExpectedBuyPrice ?? row.BuyPrice ?? 0));
  const sellPrice = Math.max(0, Number(row.ExpectedSellPrice ?? row.SellPrice ?? 0));
  const profitPerUnit = Math.max(0, Number(row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? 0)) > 0
    ? Math.max(0, Number(row.ProfitPerUnit ?? 0))
    : Math.max(0, Number(row.ProfitPerUnit ?? 0));
  return { units, volume, buyPrice, sellPrice, profitPerUnit };
}

function isValidRow(row: FlipResult): boolean {
  const pricing = rowPricing(row);
  const totalProfit = Number(row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? 0);
  return (
    stableBuyGroupId(row) > 0 &&
    pricing.units > 0 &&
    pricing.volume >= 0 &&
    pricing.buyPrice > 0 &&
    pricing.sellPrice > pricing.buyPrice &&
    pricing.profitPerUnit > 0 &&
    Number.isFinite(totalProfit) &&
    totalProfit > 0
  );
}

function rowConfidence(row: FlipResult): number {
  const fillUnits = Math.max(0, Number(row.FilledQty ?? requestedUnitsForFlip(row)));
  const requested = Math.max(0, requestedUnitsForFlip(row));
  const fillRatio = requested > 0 ? clamp(fillUnits / requested, 0, 1) : row.CanFill === false ? 0 : 1;
  const historyBonus = row.HistoryAvailable === false ? 0.8 : 1;
  const slipPenalty = clamp((Number(row.SlippageBuyPct ?? 0) + Number(row.SlippageSellPct ?? 0)) / 25, 0, 1);
  return clamp((fillRatio * 100 * historyBonus) - slipPenalty * 20, 0, 100);
}

function isThinFakeSpread(row: FlipResult): boolean {
  const requested = Math.max(0, requestedUnitsForFlip(row));
  const filled = Math.max(0, Number(row.FilledQty ?? requested));
  const fillRatio = requested > 0 ? filled / requested : row.CanFill === false ? 0 : 1;
  const slip = Math.max(0, Number(row.SlippageBuyPct ?? 0) + Number(row.SlippageSellPct ?? 0));
  return row.CanFill === false || fillRatio < 0.5 || slip >= 20;
}

function compareLists(a: RadiusBuyStationShoppingList, b: RadiusBuyStationShoppingList): number {
  return combineComparators<RadiusBuyStationShoppingList>(
    (left, right) => compareNumberDesc(left.actionableScore, right.actionableScore),
    (left, right) => compareTextAsc(left.buyStationName, right.buyStationName),
    (left, right) => left.buyGroupId - right.buyGroupId,
  )(a, b);
}

export function buildRadiusBuyStationShoppingLists(
  input: BuildRadiusBuyStationShoppingListsInput,
): RadiusBuyStationShoppingList[] {
  // Integration point: ScanResultsTable shopping-list view depends on this entrypoint staying sparse-row safe.
  const byStation = new Map<number, RadiusBuyStationShoppingListLine[]>();

  for (const row of input.rows) {
    if (!isValidRow(row)) continue;
    const groupId = stableBuyGroupId(row);
    const routeKey = routeGroupKey(row);
    const pricing = rowPricing(row);
    const units = pricing.units;
    const volumeM3 = units * pricing.volume;
    const capitalIsk = units * pricing.buyPrice;
    const grossSellIsk = units * pricing.sellPrice;
    const profitIsk = units * pricing.profitPerUnit;
    if (volumeM3 < 0 || capitalIsk <= 0 || grossSellIsk <= 0 || profitIsk <= 0) continue;
    const executionQuality = executionQualityForFlip(row).score;
    const confidence = rowConfidence(row);
    const trapRisk = classifyRadiusDealRisk(row).score;

    const line: RadiusBuyStationShoppingListLine = {
      row,
      units,
      volumeM3,
      capitalIsk,
      grossSellIsk,
      profitIsk,
      routeKey,
      executionQuality,
      confidence,
      trapRisk,
    };
    const existing = byStation.get(groupId);
    if (existing) existing.push(line);
    else byStation.set(groupId, [line]);
  }

  const out: RadiusBuyStationShoppingList[] = [];
  for (const [buyGroupId, sourceLines] of byStation) {
    const lines = [...sourceLines].sort((a, b) => {
      if (a.profitIsk !== b.profitIsk) return b.profitIsk - a.profitIsk;
      const nameCmp = a.row.TypeName.localeCompare(b.row.TypeName);
      if (nameCmp !== 0) return nameCmp;
      return a.row.TypeID - b.row.TypeID;
    });

    const selected: RadiusBuyStationShoppingListLine[] = [];
    let usedVolume = 0;
    let usedCapital = 0;
    for (const line of lines) {
      if (input.cargoCapacityM3 != null && input.cargoCapacityM3 > 0 && usedVolume + line.volumeM3 > input.cargoCapacityM3) continue;
      if (input.maxCapitalIsk != null && input.maxCapitalIsk > 0 && usedCapital + line.capitalIsk > input.maxCapitalIsk) continue;
      selected.push(line);
      usedVolume += line.volumeM3;
      usedCapital += line.capitalIsk;
    }
    if (selected.length === 0) continue;

    const anchor = selected[0].row;
    const units = selected.reduce((sum, line) => sum + line.units, 0);
    const volumeM3 = selected.reduce((sum, line) => sum + line.volumeM3, 0);
    const capitalIsk = selected.reduce((sum, line) => sum + line.capitalIsk, 0);
    const grossSellIsk = selected.reduce((sum, line) => sum + line.grossSellIsk, 0);
    const totalProfitIsk = selected.reduce((sum, line) => sum + line.profitIsk, 0);
    const routeCount = new Set(selected.map((line) => line.routeKey)).size;
    const itemCount = new Set(selected.map((line) => line.row.TypeID)).size;
    const bestIskPerJump = selected.reduce((best, line) => {
      const jumps = Math.max(1, Math.trunc(line.row.TotalJumps ?? 0));
      return Math.max(best, line.profitIsk / jumps);
    }, 0);
    const avgExecutionQuality = selected.reduce((sum, line) => sum + line.executionQuality, 0) / selected.length;
    const confidence = selected.reduce((sum, line) => sum + line.confidence, 0) / selected.length;
    const worstTrapRisk = selected.reduce((worst, line) => Math.max(worst, line.trapRisk), 0);
    const capitalEfficiency = totalProfitIsk / Math.max(1, capitalIsk);
    const cargoFillPercent = input.cargoCapacityM3 && input.cargoCapacityM3 > 0
      ? clamp((volumeM3 / input.cargoCapacityM3) * 100, 0, 100)
      : 100;

    const destinations = new Map<string, number>();
    for (const line of selected) {
      const key = resolveSellStationName(line.row);
      destinations.set(key, (destinations.get(key) ?? 0) + line.profitIsk);
    }
    const primarySellStation = [...destinations.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "Unknown sell station";

    const executableProfit = totalProfitIsk *
      (avgExecutionQuality / 100) *
      (confidence / 100) *
      (1 - clamp(worstTrapRisk / 100, 0, 0.95));
    const normalizeProfit = createMetricNormalizer([totalProfitIsk, executableProfit]);
    const normalizeVolume = createMetricNormalizer([volumeM3, input.cargoCapacityM3 ?? volumeM3]);
    const normalizeJumps = createMetricNormalizer(selected.map((line) => line.row.TotalJumps), true);
    const normalizeQuality = createMetricNormalizer([avgExecutionQuality, confidence, capitalEfficiency * 100]);
    const normalizeRisk = createMetricNormalizer([worstTrapRisk], true);
    const actionableScore = finiteNumber(
      normalizeProfit(executableProfit) * 45 +
        normalizeVolume(volumeM3) * 10 +
        normalizeJumps(selected[0]?.row.TotalJumps ?? 0) * 10 +
        normalizeQuality((avgExecutionQuality + confidence) / 2) * 20 +
        normalizeRisk(worstTrapRisk) * 15 -
        selected.filter((line) => isThinFakeSpread(line.row)).length * 5,
      0,
    );

    out.push({
      id: `buy:${buyGroupId}`,
      buyGroupId,
      buyStationName: resolveBuyStationName(anchor),
      buySystemName: anchor.BuySystemName || "Unknown",
      buySystemId: Math.trunc(anchor.BuySystemID ?? 0),
      routeCount,
      itemCount,
      units,
      volumeM3,
      cargoFillPercent,
      capitalIsk,
      grossSellIsk,
      totalProfitIsk,
      capitalEfficiency,
      bestIskPerJump,
      avgExecutionQuality,
      confidence,
      worstTrapRisk,
      actionableScore,
      primarySellStation,
      lines: selected,
    });
  }

  const sorted = out.sort(compareLists);
  return sorted.slice(0, input.maxLists ?? 12);
}
