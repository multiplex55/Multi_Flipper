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
  buyStation?: string;
  jumpsToBuyStation: number;
  sellStation?: string;
  jumpsBuyToSell: number;
  cargoM3?: number;
};

export function parseBatchManifestHeader(manifestText: string): BatchManifestHeader {
  const normalizedText = manifestText.replace(/\r/g, "");
  const buyStation = extractHeaderText(normalizedText, /buy\s*station\s*[:=]\s*(.+)$/im);
  const jumpsToBuyStation = extractHeaderNumber(normalizedText, [
    /jumps\s*to\s*buy\s*station\s*[:=]\s*(\d+)/i,
    /buy\s*station\s*jumps\s*[:=]\s*(\d+)/i,
  ]);
  const sellStation = extractHeaderText(normalizedText, /sell\s*station\s*[:=]\s*(.+)$/im);
  const jumpsBuyToSell = extractHeaderNumber(normalizedText, [
    /jumps\s*(?:buy\s*to\s*sell|to\s*sell\s*station)\s*[:=]\s*(\d+)/i,
    /jumps\s*buy\s*->\s*sell\s*[:=]\s*(\d+)/i,
    /sell\s*station\s*jumps\s*[:=]\s*(\d+)/i,
  ]);
  const cargoM3 = extractHeaderDecimal(normalizedText, [/cargo\s*m3\s*[:=]\s*([\d,.]+)/i]);

  return {
    buyStation,
    jumpsToBuyStation,
    sellStation,
    jumpsBuyToSell,
    cargoM3,
  };
}

function extractHeaderText(text: string, pattern: RegExp): string | undefined {
  const matched = text.match(pattern)?.[1]?.trim();
  return matched ? matched : undefined;
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

function extractHeaderDecimal(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const parsed = Number.parseFloat(match[1].replace(/,/g, ""));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return undefined;
}

function formatFilteredBuyManifestText(input: {
  lines: FilteredBuyManifestLine[];
  summary: FilteredBuyManifestSummary;
  header: BatchManifestHeader;
}): string {
  const out: string[] = [];
  if (input.header.buyStation) out.push(`Buy station: ${input.header.buyStation}`);
  out.push(`Jumps to buy station: ${input.summary.jumpsToBuyStation}`);
  if (input.header.sellStation) out.push(`Sell station: ${input.header.sellStation}`);
  out.push(`Jumps buy -> sell: ${input.summary.jumpsBuyToSell}`);
  out.push(`Cargo m3: ${formatVolume(input.header.cargoM3 ?? input.summary.totalVolume)}`);
  out.push(`Items: ${input.summary.keptLineCount}`);
  out.push(`Total volume: ${formatVolume(input.summary.totalVolume)} m3`);
  out.push(`Total capital: ${formatIsk(input.summary.totalBuyCost)} ISK`);
  out.push(`Total gross sell: ${formatIsk(input.summary.totalPlannedSell)} ISK`);
  out.push(`Total profit: ${formatIsk(input.summary.totalAdjustedProfit)} ISK`);
  out.push(`Total isk/jump: ${formatIsk(input.summary.iskPerJump)} ISK`);
  out.push("");

  for (const line of input.lines) {
    out.push(
      `${line.name} | qty ${Math.max(0, Math.trunc(line.qty)).toLocaleString("en-US")} | buy total ${formatIsk(line.buyTotal)} ISK | buy per ${formatIsk(line.buyPer)} ISK | sell total ${formatIsk(line.sellTotal)} ISK | sell per ${formatIsk(line.sellPer)} ISK | vol ${formatVolume(line.volume)} m3 | profit ${formatIsk(line.profit)} ISK`,
    );
  }

  out.push("");
  for (const line of input.lines) {
    out.push(`${line.name} ${Math.max(0, Math.trunc(line.qty))}`);
  }

  return out.join("\n");
}

function formatIsk(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("en-US");
}

function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
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
    text: formatFilteredBuyManifestText({ lines, summary, header }),
    hasDuplicateNormalizedManifestNames: duplicateNormalizedManifestNames.length > 0,
    duplicateNormalizedManifestNames,
  };
}
