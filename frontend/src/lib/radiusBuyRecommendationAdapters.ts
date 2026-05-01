import type { RadiusCargoBuild, RadiusRejectedCargoBuild } from "@/lib/radiusCargoBuilds";
import type { RadiusBuyStationShoppingList } from "@/lib/radiusBuyStationShoppingList";
import { routeGroupKey } from "@/lib/batchMetrics";
import type { FlipResult } from "@/lib/types";
import type {
  RadiusBuyRecommendation,
  RadiusBuyRecommendationAction,
  RadiusBuyRecommendationLine,
} from "@/lib/radiusBuyRecommendation";

export type RadiusBuyRecommendationContext = { source?: string };

function normalizeLine(row: FlipResult, qtyInput?: number): RadiusBuyRecommendationLine | null {
  const qty = Math.max(0, Math.trunc(Number(qtyInput ?? row.UnitsToBuy ?? row.FilledQty ?? 0)));
  const unitVolumeM3 = Number(row.Volume ?? 0);
  if (unitVolumeM3 < 0) return null;
  const volumeM3 = unitVolumeM3 * qty;
  const buyUnitIsk = Number(row.ExpectedBuyPrice ?? row.BuyPrice ?? 0);
  const sellUnitIsk = Number(row.ExpectedSellPrice ?? row.SellPrice ?? 0);
  const profitUnitIsk = Number(row.RealProfit ?? row.ExpectedProfit ?? row.TotalProfit ?? Number(row.ProfitPerUnit ?? 0) * qty) / Math.max(1, qty);
  return {
    typeId: Math.trunc(Number(row.TypeID ?? 0)),
    typeName: row.TypeName || "Unknown",
    qty,
    unitVolumeM3,
    volumeM3,
    buyUnitIsk,
    sellUnitIsk,
    profitUnitIsk,
    buyTotalIsk: buyUnitIsk * qty,
    sellTotalIsk: sellUnitIsk * qty,
    profitTotalIsk: profitUnitIsk * qty,
    routeKey: routeGroupKey(row),
    row,
  };
}

function rec(id: string, kind: RadiusBuyRecommendation["kind"], action: RadiusBuyRecommendationAction, title: string, lines: RadiusBuyRecommendationLine[], context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const reasons = [
    `${lines.length} line(s) normalized from ${context.source ?? kind}`,
    `Total qty ${lines.reduce((s, l) => s + l.qty, 0)}`,
  ];
  const warnings = lines.some((line) => line.qty === 0 || line.volumeM3 === 0) ? ["Contains zero-qty or zero-volume lines"] : [];
  return { id, kind, action, title, routeKey: lines[0]?.routeKey, lines, reasons, warnings, blockers: [] };
}

export function recommendationFromCargoBuild(build: RadiusCargoBuild, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const lines = build.lines.map((line) => normalizeLine(line.row, line.units)).filter((line): line is RadiusBuyRecommendationLine => Boolean(line));
  const out = rec(build.id, "cargo_build", "buy", build.routeLabel, lines, { ...context, source: "cargo build" });
  out.reasons.push(`Build score ${build.finalScore.toFixed(1)} and fill ${build.cargoFillPercent.toFixed(1)}%`);
  return out;
}

export function recommendationFromBuyStationShoppingList(list: RadiusBuyStationShoppingList, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const lines = list.lines.map((line) => normalizeLine(line.row, line.units)).filter((line): line is RadiusBuyRecommendationLine => Boolean(line));
  const out = rec(list.id, "buy_station_list", "buy", list.buyStationName, lines, { ...context, source: "buy station list" });
  out.reasons.push(`Station ${list.buyStationName} score ${list.actionableScore.toFixed(1)}`);
  return out;
}

export function recommendationFromSingleRow(row: FlipResult, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const line = normalizeLine(row, Number(row.UnitsToBuy ?? row.FilledQty ?? 0));
  return rec(`row:${row.TypeID}:${routeGroupKey(row)}`, "single_row", "buy", row.TypeName || "Row", line ? [line] : [], context);
}

export function recommendationFromRouteGroup(routeKey: string, rows: FlipResult[], context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const lines = rows.map((row) => normalizeLine(row, Number(row.UnitsToBuy ?? row.FilledQty ?? 0))).filter((line): line is RadiusBuyRecommendationLine => Boolean(line));
  return rec(`route:${routeKey}`, "route_group", "buy", routeKey, lines, context);
}

export function recommendationFromRejectedCargoBuild(rejected: RadiusRejectedCargoBuild, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const action: RadiusBuyRecommendationAction = rejected.suggestedAction === "trim_lines" ? "trim" : rejected.suggestedAction === "skip" ? "watch" : "verify";
  const out = rec(`rejected:${rejected.routeKey}`, "rejected_cargo_build", action, rejected.routeLabel, [], context);
  out.blockers = rejected.blockers.map((b) => b.message);
  out.diagnostics = rejected.blockers.map((b) => ({ kind: b.kind, message: b.message, actual: b.actual, required: b.required, severity: b.severity }));
  out.warnings.push("Near miss recommendation; manual verification required.");
  return out;
}
