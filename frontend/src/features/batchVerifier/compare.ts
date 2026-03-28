import type { ExportItem, ManifestItem } from "@/features/batchVerifier/parsing";
import { normalizeItemName } from "@/features/batchVerifier/parsing";

export type ComparisonState =
  | "safe"
  | "do_not_buy"
  | "quantity_mismatch"
  | "missing_from_export"
  | "unexpected_in_export";

export type ThresholdMode = "strict" | "isk_tolerance" | "percent_tolerance";

export type ComparisonOptions = {
  thresholdMode?: ThresholdMode;
  iskTolerance?: number;
  percentTolerance?: number;
  enableQuantityMismatch?: boolean;
  includeReview?: boolean;
};

export type ComparisonRow = {
  name: string;
  state: ComparisonState;
  manifestItem?: ManifestItem;
  exportItem?: ExportItem;
  qtyDelta?: number;
  buyPerDelta?: number;
  buyTotalDelta?: number;
  allowedBuyPer?: number;
  reason: string;
  extraIskVsPlan?: number;
  estimatedProfitLost?: number;
};

export type ComparisonSummary = {
  counts: Record<ComparisonState, number>;
  extraIskRequiredVsPlan: number;
  estimatedProfitLost: number;
};

export type ComparisonResult = {
  rows: ComparisonRow[];
  buyThese: ComparisonRow[];
  doNotBuy: ComparisonRow[];
  missing: ComparisonRow[];
  unexpected: ComparisonRow[];
  review?: ComparisonRow[];
  summary: ComparisonSummary;
};

function getAllowedBuyPer(manifestItem: ManifestItem, options: ComparisonOptions): number {
  const plannedBuyPer = manifestItem.buyPer ?? 0;
  const mode = options.thresholdMode ?? "strict";

  if (mode === "isk_tolerance") {
    return plannedBuyPer + (options.iskTolerance ?? 0);
  }

  if (mode === "percent_tolerance") {
    return plannedBuyPer * (1 + (options.percentTolerance ?? 0) / 100);
  }

  return plannedBuyPer;
}

function estimatedProfitForManifestItem(manifestItem: ManifestItem): number {
  if (typeof manifestItem.profit === "number") {
    return manifestItem.profit;
  }

  if (typeof manifestItem.sellTotal === "number" && typeof manifestItem.buyTotal === "number") {
    return manifestItem.sellTotal - manifestItem.buyTotal;
  }

  if (typeof manifestItem.sellPer === "number" && typeof manifestItem.buyPer === "number") {
    return (manifestItem.sellPer - manifestItem.buyPer) * manifestItem.qty;
  }

  return 0;
}

export function buildReasonText(row: Omit<ComparisonRow, "reason">): string {
  switch (row.state) {
    case "safe":
      return "Within configured buy-per threshold and quantity rules.";
    case "do_not_buy":
      return `Buy-per ${row.exportItem?.buyPer ?? 0} exceeds allowed ${row.allowedBuyPer ?? 0}.`;
    case "quantity_mismatch":
      return `Quantity mismatch: manifest ${row.manifestItem?.qty ?? 0}, export ${row.exportItem?.qty ?? 0}.`;
    case "missing_from_export":
      return "Present in manifest but missing from export.";
    case "unexpected_in_export":
      return "Present in export but not listed in manifest.";
  }
}

export function classifyRow(
  manifestItem: ManifestItem | undefined,
  exportItem: ExportItem | undefined,
  options: ComparisonOptions,
): ComparisonRow {
  const name = manifestItem?.name ?? exportItem?.name ?? "";

  if (manifestItem && !exportItem) {
    const row: Omit<ComparisonRow, "reason"> = {
      name,
      state: "missing_from_export",
      manifestItem,
      qtyDelta: -manifestItem.qty,
      estimatedProfitLost: Math.max(0, estimatedProfitForManifestItem(manifestItem)),
    };
    return { ...row, reason: buildReasonText(row) };
  }

  if (!manifestItem && exportItem) {
    const row: Omit<ComparisonRow, "reason"> = {
      name,
      state: "unexpected_in_export",
      exportItem,
    };
    return { ...row, reason: buildReasonText(row) };
  }

  const safeManifest = manifestItem as ManifestItem;
  const safeExport = exportItem as ExportItem;
  const qtyDelta = safeExport.qty - safeManifest.qty;
  const buyPerDelta = safeExport.buyPer - (safeManifest.buyPer ?? 0);
  const buyTotalDelta = safeExport.buyTotal - (safeManifest.buyTotal ?? (safeManifest.buyPer ?? 0) * safeManifest.qty);
  const allowedBuyPer = getAllowedBuyPer(safeManifest, options);

  let state: ComparisonState = "safe";
  if (safeExport.buyPer > allowedBuyPer) {
    state = "do_not_buy";
  } else if (options.enableQuantityMismatch !== false && qtyDelta !== 0) {
    state = "quantity_mismatch";
  }

  const row: Omit<ComparisonRow, "reason"> = {
    name,
    state,
    manifestItem: safeManifest,
    exportItem: safeExport,
    qtyDelta,
    buyPerDelta,
    buyTotalDelta,
    allowedBuyPer,
    extraIskVsPlan: buyTotalDelta,
    estimatedProfitLost: state === "do_not_buy" ? Math.max(0, estimatedProfitForManifestItem(safeManifest)) : 0,
  };

  return { ...row, reason: buildReasonText(row) };
}

export function computeSummary(rows: ComparisonRow[]): ComparisonSummary {
  const counts: Record<ComparisonState, number> = {
    safe: 0,
    do_not_buy: 0,
    quantity_mismatch: 0,
    missing_from_export: 0,
    unexpected_in_export: 0,
  };

  for (const row of rows) {
    counts[row.state] += 1;
  }

  return {
    counts,
    extraIskRequiredVsPlan: rows.reduce((sum, row) => sum + (row.extraIskVsPlan ?? 0), 0),
    estimatedProfitLost: rows.reduce((sum, row) => sum + (row.estimatedProfitLost ?? 0), 0),
  };
}

export function compareManifestToExport(
  manifestItems: ManifestItem[],
  exportItems: ExportItem[],
  options: ComparisonOptions = {},
): ComparisonResult {
  const manifestByName = new Map<string, ManifestItem>();
  const exportByName = new Map<string, ExportItem>();

  for (const item of manifestItems) {
    manifestByName.set(normalizeItemName(item.name), item);
  }

  for (const item of exportItems) {
    exportByName.set(normalizeItemName(item.name), item);
  }

  const allNames = new Set<string>([...manifestByName.keys(), ...exportByName.keys()]);
  const sortedNames = [...allNames].sort((a, b) => a.localeCompare(b));

  const rows = sortedNames.map((name) => classifyRow(manifestByName.get(name), exportByName.get(name), options));

  const buyThese = rows.filter((row) => row.state === "safe");
  const doNotBuy = rows.filter((row) => row.state === "do_not_buy");
  const missing = rows.filter((row) => row.state === "missing_from_export");
  const unexpected = rows.filter((row) => row.state === "unexpected_in_export");
  const reviewRows = rows.filter((row) => row.state === "quantity_mismatch");

  return {
    rows,
    buyThese,
    doNotBuy,
    missing,
    unexpected,
    review: options.includeReview === false || reviewRows.length === 0 ? undefined : reviewRows,
    summary: computeSummary(rows),
  };
}
