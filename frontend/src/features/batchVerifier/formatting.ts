import type { ComparisonResult, ComparisonRow, FinalVerdict } from "@/features/batchVerifier/compare";

const DISALLOWED_STATES: ComparisonRow["state"][] = [
  "do_not_buy",
  "quantity_mismatch",
  "missing_from_export",
  "unexpected_in_export",
];

export type SummaryReportOptions = {
  modeLabel: string;
  locale?: string;
};

export function formatSummaryTotal(value: number | undefined, locale = "en-US"): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toLocaleString(locale, { maximumFractionDigits: 2 });
}

type VerdictMeta = {
  label: "Good" | "Reduced edge" | "Abort";
  className: string;
};

const VERDICT_META: Record<FinalVerdict, VerdictMeta> = {
  good: {
    label: "Good",
    className: "bg-emerald-950 text-emerald-200 border border-emerald-700",
  },
  reduced_edge: {
    label: "Reduced edge",
    className: "bg-amber-950 text-amber-200 border border-amber-700",
  },
  abort: {
    label: "Abort",
    className: "bg-rose-950 text-rose-200 border border-rose-700",
  },
};

export function getVerdictPresentation(verdict: FinalVerdict): VerdictMeta {
  return VERDICT_META[verdict];
}

export function formatDecisionReason(row: Pick<ComparisonRow, "state" | "exportItem" | "manifestItem" | "allowedBuyPer">): string {
  if (row.state === "do_not_buy") {
    if (typeof row.allowedBuyPer !== "number" && typeof row.manifestItem?.sellPer !== "number") {
      return "Cannot evaluate sell-value threshold: manifest sell-per is missing.";
    }

    if (typeof row.manifestItem?.sellPer === "number" && row.allowedBuyPer === row.manifestItem.sellPer) {
      return `Sell target exceeded: export ${formatNumber(row.exportItem?.buyPer)} ISK > sell-per target ${formatNumber(row.allowedBuyPer)} ISK.`;
    }

    return `Overpriced: ${formatNumber(row.exportItem?.buyPer)} ISK > allowed ${formatNumber(row.allowedBuyPer)} ISK.`;
  }

  if (row.state === "quantity_mismatch") {
    return `Quantity mismatch: manifest ${formatNumber(row.manifestItem?.qty, 0)} vs export ${formatNumber(row.exportItem?.qty, 0)}.`;
  }

  if (row.state === "missing_from_export") {
    return "Missing from export order.";
  }

  if (row.state === "unexpected_in_export") {
    return "Unexpected item in export order.";
  }

  return "Within configured limits.";
}

export function formatSummaryReport(
  result: Pick<ComparisonResult, "summary">,
  options: SummaryReportOptions,
): string {
  const locale = options.locale ?? "en-US";
  const lines = [
    `Mode: ${options.modeLabel}`,
    `Safe: ${result.summary.counts.safe}`,
    `Do not buy: ${result.summary.counts.do_not_buy}`,
    `Quantity mismatch: ${result.summary.counts.quantity_mismatch}`,
    `Missing from export: ${result.summary.counts.missing_from_export}`,
    `Unexpected in export: ${result.summary.counts.unexpected_in_export}`,
    `Price diff alert threshold (%): ${formatNumber(result.summary.alertThresholdPercent, 2, locale)}`,
    `Rows above alert threshold: ${result.summary.alertingRowsCount}`,
    `Max price diff (%): ${formatNumber(result.summary.maxPriceDiffPercent, 2, locale)}`,
    `Extra ISK vs plan: ${formatNumber(result.summary.extraIskRequiredVsPlan, 2, locale)} ISK`,
    `Profit impact: ${formatNumber(result.summary.estimatedProfitLost, 2, locale)} ISK`,
  ];

  return lines.join("\n");
}

export function formatDoNotBuyList(result: Pick<ComparisonResult, "rows">): string {
  const disallowedRows = result.rows.filter((row) => DISALLOWED_STATES.includes(row.state));

  if (disallowedRows.length === 0) {
    return "No do-not-buy items.";
  }

  return disallowedRows.map((row) => `${row.name} — ${formatDecisionReason(row)}`).join("\n");
}

function formatNumber(value: number | undefined, minimumFractionDigits = 2, locale = "en-US"): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits,
  });
}
