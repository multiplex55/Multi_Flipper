import type { RoutePlanValidationResult } from "@/lib/routePlanValidation";
import type { RouteResult } from "@/lib/types";

export interface RoutePlannerExportSelection {
  route: RouteResult;
}

function fmtISK(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("en-US");
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  return value.toFixed(1);
}

export function formatMultibuyByStop(selection: RoutePlannerExportSelection): string {
  const lines: string[] = ["=== MULTIBUY BY STOP ==="];
  selection.route.Hops.forEach((hop, idx) => {
    lines.push("");
    lines.push(`Stop ${idx + 1}: ${hop.StationName || "Unknown Station"} (${hop.SystemName || "Unknown System"})`);
    lines.push(`${hop.TypeName || "Unknown Item"} ${Math.max(0, Math.trunc(hop.Units ?? 0))}`);
  });
  return lines.join("\n");
}

export function formatSellChecklistByStop(selection: RoutePlannerExportSelection): string {
  const lines: string[] = ["=== SELL CHECKLIST BY STOP ==="];
  selection.route.Hops.forEach((hop, idx) => {
    lines.push("");
    lines.push(`Stop ${idx + 1}: ${hop.DestStationName || "Unknown Station"} (${hop.DestSystemName || "Unknown System"})`);
    lines.push(`Sell ${hop.TypeName || "Unknown Item"} x${Math.max(0, Math.trunc(hop.Units ?? 0))}`);
    lines.push(`Snapshot sell: ${fmtISK((hop.SellPrice ?? 0) * (hop.Units ?? 0))} ISK`);
  });
  return lines.join("\n");
}

export function formatValidationSummary(validation: RoutePlanValidationResult | null): string {
  if (!validation) return "Validation data unavailable.";
  const lines: string[] = [
    "=== VALIDATION SUMMARY ===",
    `Validation status: ${validation.band}`,
    `Snapshot age: ${validation.snapshot_age_minutes == null ? "N/A" : `${fmtPct(validation.snapshot_age_minutes)} min`}`,
    `Edge retained %: ${fmtPct(validation.edge_retained_pct)}%`,
    `Degraded stop count: ${validation.degraded_stop_count}`,
    `Fill confidence: ${fmtPct(validation.avg_fill_confidence_pct)}%`,
  ];
  for (const stop of validation.stops) {
    lines.push(
      `- ${stop.stop_key}: status ${stop.band}, expected net ${fmtISK(stop.expected_net_isk)} ISK, fill confidence ${fmtPct(stop.fill_confidence_pct)}%`,
    );
  }
  return lines.join("\n");
}

export function formatFullRunSummary(
  selection: RoutePlannerExportSelection,
  validation: RoutePlanValidationResult | null,
): string {
  const lines: string[] = [
    "=== FULL RUN SUMMARY ===",
    `Stops: ${selection.route.HopCount}`,
    `Snapshot buy: ${fmtISK(validation?.snapshot_buy_isk ?? 0)} ISK`,
    `Snapshot sell: ${fmtISK(validation?.snapshot_sell_isk ?? 0)} ISK`,
    `Expected net: ${fmtISK(validation?.expected_net_isk ?? selection.route.TotalProfit)} ISK`,
    `Validation status: ${validation?.band ?? "unknown"}`,
    `Fill confidence: ${fmtPct(validation?.avg_fill_confidence_pct ?? 0)}%`,
    `Snapshot age: ${validation?.snapshot_age_minutes == null ? "N/A" : `${fmtPct(validation.snapshot_age_minutes)} min`}`,
    `Edge retained %: ${fmtPct(validation?.edge_retained_pct ?? 0)}%`,
    `Degraded stop count: ${validation?.degraded_stop_count ?? 0}`,
  ];

  selection.route.Hops.forEach((hop, idx) => {
    const stop = validation?.stops[idx];
    lines.push("");
    lines.push(`Stop ${idx + 1}: ${hop.SystemName} -> ${hop.DestSystemName}`);
    lines.push(`Snapshot buy: ${fmtISK(stop?.snapshot_buy_isk ?? (hop.BuyPrice ?? 0) * (hop.Units ?? 0))} ISK`);
    lines.push(`Snapshot sell: ${fmtISK(stop?.snapshot_sell_isk ?? (hop.SellPrice ?? 0) * (hop.Units ?? 0))} ISK`);
    lines.push(`Expected net: ${fmtISK(stop?.expected_net_isk ?? ((hop.effective_sell ?? hop.SellPrice ?? 0) - (hop.effective_buy ?? hop.BuyPrice ?? 0)) * (hop.Units ?? 0))} ISK`);
    lines.push(`Validation status: ${stop?.band ?? "unknown"}`);
    lines.push(`Fill confidence: ${fmtPct(stop?.fill_confidence_pct ?? 0)}%`);
  });

  return lines.join("\n");
}
