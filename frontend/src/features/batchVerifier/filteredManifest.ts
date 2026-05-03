import type { ComparisonResult, ComparisonRow } from "@/features/batchVerifier/compare";
import { normalizeItemName, type ManifestItem } from "@/features/batchVerifier/parsing";

export type FilteredBuyManifestLine = {
  name: string;
  qty: number;
  buyPer: number;
  buyTotal: number;
  sellPer: number;
  sellTotal: number;
  volume: number;
  profit: number;
};

export type FilteredBuyManifestSummary = {
  keptLineCount: number;
  originalLineCount: number;
  excludedManifestLineCount: number;
  doNotBuyLineCount: number;
  reviewLineCount: number;
  missingLineCount: number;
  totalBuyCost: number;
  totalPlannedSell: number;
  totalAdjustedProfit: number;
  totalVolume: number;
  jumpsToBuyStation: number;
  jumpsBuyToSell: number;
  totalJumps: number;
  iskPerJump: number;
};

export type FilteredBuyManifest = {
  lines: FilteredBuyManifestLine[];
  summary: FilteredBuyManifestSummary;
  text: string;
  hasDuplicateNormalizedManifestNames: boolean;
  duplicateNormalizedManifestNames: string[];
};

export type BuildFilteredBuyManifestInput = {
  manifestText: string;
  manifestItems: ManifestItem[];
  comparison: ComparisonResult;
};

type BatchManifestHeader = {
  jumpsToBuyStation: number;
  jumpsBuyToSell: number;
};

export function parseBatchManifestHeader(manifestText: string): BatchManifestHeader {
  const normalizedText = manifestText.replace(/\r/g, "");
  const jumpsToBuyStation = extractHeaderNumber(normalizedText, [
    /jumps\s*to\s*buy\s*station\s*[:=]\s*(\d+)/i,
    /buy\s*station\s*jumps\s*[:=]\s*(\d+)/i,
  ]);
  const jumpsBuyToSell = extractHeaderNumber(normalizedText, [
    /jumps\s*(?:buy\s*to\s*sell|to\s*sell\s*station)\s*[:=]\s*(\d+)/i,
    /sell\s*station\s*jumps\s*[:=]\s*(\d+)/i,
  ]);

  return {
    jumpsToBuyStation,
    jumpsBuyToSell,
  };
}

function extractHeaderNumber(text: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

function formatFilteredBuyManifestText(lines: FilteredBuyManifestLine[]): string {
  return lines
    .map(
      (line) =>
        `${line.name}\t${line.qty}\t${line.buyPer.toFixed(2)}\t${line.buyTotal.toFixed(2)}\t${line.sellPer.toFixed(2)}\t${line.sellTotal.toFixed(2)}\t${line.volume.toFixed(2)}\t${line.profit.toFixed(2)}`,
    )
    .join("\n");
}

export function computeFilteredBuyManifestSummary(input: {
  lines: FilteredBuyManifestLine[];
  comparisonRows: ComparisonRow[];
  originalLineCount: number;
  jumpsToBuyStation: number;
  jumpsBuyToSell: number;
}): FilteredBuyManifestSummary {
  const totalJumps = input.jumpsToBuyStation + input.jumpsBuyToSell;
  const totalAdjustedProfit = input.lines.reduce((sum, line) => sum + line.profit, 0);

  return {
    keptLineCount: input.lines.length,
    originalLineCount: input.originalLineCount,
    excludedManifestLineCount: Math.max(0, input.originalLineCount - input.lines.length),
    doNotBuyLineCount: input.comparisonRows.filter((row) => row.state === "do_not_buy").length,
    reviewLineCount: input.comparisonRows.filter((row) => row.state === "quantity_mismatch").length,
    missingLineCount: input.comparisonRows.filter((row) => row.state === "missing_from_export").length,
    totalBuyCost: input.lines.reduce((sum, line) => sum + line.buyTotal, 0),
    totalPlannedSell: input.lines.reduce((sum, line) => sum + line.sellTotal, 0),
    totalAdjustedProfit,
    totalVolume: input.lines.reduce((sum, line) => sum + line.volume, 0),
    jumpsToBuyStation: input.jumpsToBuyStation,
    jumpsBuyToSell: input.jumpsBuyToSell,
    totalJumps,
    iskPerJump: totalJumps > 0 ? totalAdjustedProfit / totalJumps : 0,
  };
}

export function buildFilteredBuyManifest(input: BuildFilteredBuyManifestInput): FilteredBuyManifest {
  const header = parseBatchManifestHeader(input.manifestText);
  const rowLookup = new Map(input.comparison.rows.map((row) => [normalizeItemName(row.name), row]));

  const manifestNameCounts = new Map<string, number>();
  for (const item of input.manifestItems) {
    const key = normalizeItemName(item.name);
    manifestNameCounts.set(key, (manifestNameCounts.get(key) ?? 0) + 1);
  }

  const duplicateNormalizedManifestNames = [...manifestNameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name);

  const lines: FilteredBuyManifestLine[] = [];
  for (const manifestItem of input.manifestItems) {
    const row = rowLookup.get(normalizeItemName(manifestItem.name));
    if (!row || row.state !== "safe" || !row.exportItem) {
      continue;
    }

    const plannedBuyTotal = manifestItem.buyTotal ?? (manifestItem.buyPer ?? 0) * manifestItem.qty;
    const plannedSellTotal = manifestItem.sellTotal ?? (manifestItem.sellPer ?? 0) * manifestItem.qty;
    const actualBuyTotal = row.exportItem.buyTotal;
    const plannedProfit =
      manifestItem.profit ??
      (Number.isFinite(plannedSellTotal) && Number.isFinite(plannedBuyTotal) ? plannedSellTotal - plannedBuyTotal : undefined);

    const computedProfit =
      typeof plannedProfit === "number"
        ? plannedProfit - (actualBuyTotal - plannedBuyTotal)
        : plannedSellTotal - actualBuyTotal;

    lines.push({
      name: manifestItem.rawName || manifestItem.name,
      qty: row.exportItem.qty,
      buyPer: row.exportItem.buyPer,
      buyTotal: actualBuyTotal,
      sellPer: manifestItem.sellPer ?? 0,
      sellTotal: manifestItem.sellTotal ?? 0,
      volume: manifestItem.vol ?? 0,
      profit: Number.isFinite(computedProfit) ? computedProfit : (manifestItem.sellTotal ?? 0) - actualBuyTotal,
    });
  }

  const summary = computeFilteredBuyManifestSummary({
    lines,
    comparisonRows: input.comparison.rows,
    originalLineCount: input.manifestItems.length,
    jumpsToBuyStation: header.jumpsToBuyStation,
    jumpsBuyToSell: header.jumpsBuyToSell,
  });

  return {
    lines,
    summary,
    text: formatFilteredBuyManifestText(lines),
    hasDuplicateNormalizedManifestNames: duplicateNormalizedManifestNames.length > 0,
    duplicateNormalizedManifestNames,
  };
}
