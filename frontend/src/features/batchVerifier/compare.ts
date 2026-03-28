import type { ExportItem, ManifestItem } from "@/features/batchVerifier/parsing";
import { normalizeItemName } from "@/features/batchVerifier/parsing";

export type ComparisonState =
  | "safe"
  | "do_not_buy"
  | "quantity_mismatch"
  | "missing_from_export"
  | "unexpected_in_export";

export type ThresholdMode = "strict" | "isk_tolerance" | "percent_tolerance" | "sell_value_evaluate";

export type ComparisonOptions = {
  thresholdMode?: ThresholdMode;
  iskTolerance?: number;
  percentTolerance?: number;
  priceDiffAlertPercent?: number;
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
  priceDiffPercent?: number;
  crossesPriceDiffAlert?: boolean;
  reason: string;
  extraIskVsPlan?: number;
  estimatedProfitLost?: number;
};

export type ComparisonSummary = {
  counts: Record<ComparisonState, number>;
  extraIskRequiredVsPlan: number;
  estimatedProfitLost: number;
  alertThresholdPercent?: number;
  alertingRowsCount: number;
  maxPriceDiffPercent?: number;
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

function getAllowedBuyPer(manifestItem: ManifestItem, options: ComparisonOptions): number | undefined {
  const plannedBuyPer = manifestItem.buyPer ?? 0;
  const mode = options.thresholdMode ?? "strict";

  if (mode === "isk_tolerance") {
    return plannedBuyPer + (options.iskTolerance ?? 0);
  }

  if (mode === "percent_tolerance") {
    return plannedBuyPer * (1 + (options.percentTolerance ?? 0) / 100);
  }

  if (mode === "sell_value_evaluate") {
    return manifestItem.sellPer;
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
  const manifestSellPer = row.manifestItem?.sellPer;
  const alertSuffix = row.crossesPriceDiffAlert ? " Also exceeds configured % difference." : "";

  switch (row.state) {
    case "safe":
      return `Within configured buy-per threshold and quantity rules.${alertSuffix}`;
    case "do_not_buy": {
      if (typeof row.allowedBuyPer !== "number" && typeof manifestSellPer !== "number") {
        return `Sell Value Evaluate mode requires manifest sell-per; missing sell-per so item is do-not-buy.${alertSuffix}`;
      }

      if (typeof manifestSellPer === "number" && row.allowedBuyPer === manifestSellPer) {
        return `Export buy-per ${row.exportItem?.buyPer ?? 0} exceeds sell-per target ${row.allowedBuyPer}.${alertSuffix}`;
      }

      return `Buy-per ${row.exportItem?.buyPer ?? 0} exceeds allowed ${row.allowedBuyPer ?? 0}.${alertSuffix}`;
    }
    case "quantity_mismatch":
      return `Quantity mismatch: manifest ${row.manifestItem?.qty ?? 0}, export ${row.exportItem?.qty ?? 0}.${alertSuffix}`;
    case "missing_from_export":
      return "Present in manifest but missing from export.";
    case "unexpected_in_export":
      return "Present in export but not listed in manifest.";
  }
}

function getPriceDiffBaseline(manifestItem: ManifestItem, _options: ComparisonOptions): number | undefined {
  // We intentionally keep deviation baseline anchored to planned buy-per in all modes
  // (including sell_value_evaluate). Rationale: the alert is a "how far from plan did
  // this execution drift?" signal, not a profitability/sell-threshold gate.
  return manifestItem.buyPer;
}

function computePriceDiffPercent(
  manifestItem: ManifestItem,
  exportItem: ExportItem,
  options: ComparisonOptions,
): number | undefined {
  const baseline = getPriceDiffBaseline(manifestItem, options);

  if (typeof baseline !== "number" || !Number.isFinite(baseline) || baseline <= 0) {
    return undefined;
  }

  const actual = exportItem.buyPer;
  if (!Number.isFinite(actual)) {
    return undefined;
  }

  return (Math.abs(actual - baseline) / baseline) * 100;
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
  const mode = options.thresholdMode ?? "strict";
  const priceDiffPercent = computePriceDiffPercent(safeManifest, safeExport, options);
  const threshold = options.priceDiffAlertPercent;
  const hasValidThreshold = typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 0;
  const crossesPriceDiffAlert = hasValidThreshold && typeof priceDiffPercent === "number" && priceDiffPercent > threshold;

  let state: ComparisonState = "safe";
  // In sell-value mode, missing sellPer cannot produce a meaningful threshold,
  // so we fail closed as do_not_buy.
  if (mode === "sell_value_evaluate" && typeof safeManifest.sellPer !== "number") {
    state = "do_not_buy";
  } else if (typeof allowedBuyPer === "number" && safeExport.buyPer > allowedBuyPer) {
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
    priceDiffPercent,
    crossesPriceDiffAlert,
    extraIskVsPlan: buyTotalDelta,
    estimatedProfitLost: state === "do_not_buy" ? Math.max(0, estimatedProfitForManifestItem(safeManifest)) : 0,
  };

  return { ...row, reason: buildReasonText(row) };
}

export function computeSummary(rows: ComparisonRow[], options: ComparisonOptions = {}): ComparisonSummary {
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

  const alertThresholdPercent =
    typeof options.priceDiffAlertPercent === "number" && Number.isFinite(options.priceDiffAlertPercent)
      ? options.priceDiffAlertPercent
      : undefined;
  const rowsWithComputedDiff = rows.filter((row) => typeof row.priceDiffPercent === "number");
  const alertingRowsCount = rows.filter((row) => row.crossesPriceDiffAlert).length;

  return {
    counts,
    extraIskRequiredVsPlan: rows.reduce((sum, row) => sum + (row.extraIskVsPlan ?? 0), 0),
    estimatedProfitLost: rows.reduce((sum, row) => sum + (row.estimatedProfitLost ?? 0), 0),
    alertThresholdPercent,
    alertingRowsCount,
    maxPriceDiffPercent:
      rowsWithComputedDiff.length > 0
        ? Math.max(...rowsWithComputedDiff.map((row) => row.priceDiffPercent as number))
        : undefined,
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
    summary: computeSummary(rows, options),
  };
}
