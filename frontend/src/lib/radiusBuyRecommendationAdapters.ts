import type { RadiusCargoBuild, RadiusRejectedCargoBuild } from "@/lib/radiusCargoBuilds";
import type { RadiusBuyStationShoppingList } from "@/lib/radiusBuyStationShoppingList";
import { buildBatch, routeGroupKey, routeLineKey, safeNumber, type RouteBatchMetadata } from "@/lib/batchMetrics";
import type { FlipResult } from "@/lib/types";
import type {
  RadiusBuyRecommendation,
  RadiusBuyRecommendationAction,
  RadiusBuyRecommendationLine,
} from "@/lib/radiusBuyRecommendation";

export type RadiusBuyRecommendationContext = { source?: string };

export type RecommendationFromRouteBatchInput = {
  routeKey: string;
  rows: FlipResult[];
  metadata?: RouteBatchMetadata;
  cargoCapacityM3: number;
  originLabel?: string;
};

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

function rec(id: string, kind: RadiusBuyRecommendation["kind"], action: RadiusBuyRecommendationAction, title: string, lines: RadiusBuyRecommendationLine[], context: RadiusBuyRecommendationContext, metrics?: Partial<RadiusBuyRecommendation>): RadiusBuyRecommendation {
  const reasons = [
    `${lines.length} line(s) normalized from ${context.source ?? kind}`,
    `Total qty ${lines.reduce((s, l) => s + l.qty, 0)}`,
  ];
  const warnings = lines.some((line) => line.qty === 0 || line.volumeM3 === 0) ? ["Contains zero-qty or zero-volume lines"] : [];
  const totalVolumeM3 = lines.reduce((s, l) => s + safeNumber(l.volumeM3), 0);
  const batchCapitalIsk = lines.reduce((s, l) => s + safeNumber(l.buyTotalIsk), 0);
  const batchGrossSellIsk = lines.reduce((s, l) => s + safeNumber(l.sellTotalIsk), 0);
  const batchProfitIsk = lines.reduce((s, l) => s + safeNumber(l.profitTotalIsk), 0);
  const totalJumps = Math.max(1, ...lines.map((l) => Math.max(1, safeNumber(l.row?.TotalJumps))));
  return { id, kind, action, title, routeKey: lines[0]?.routeKey, lines, selectedLineKeys: metrics?.selectedLineKeys, sourcePackageKind: metrics?.sourcePackageKind, reasons, warnings, blockers: [],
    jumpsToBuyStation: 0, jumpsBuyToSell: 0, totalJumps, cargoCapacityM3: Math.max(0, totalVolumeM3), totalVolumeM3, remainingCargoM3: 0, cargoUsedPercent: totalVolumeM3 > 0 ? 100 : 0,
    batchProfitIsk, batchCapitalIsk, batchGrossSellIsk, batchIskPerJump: batchProfitIsk / Math.max(1,totalJumps), batchRoiPercent: batchCapitalIsk > 0 ? (batchProfitIsk / batchCapitalIsk) * 100 : 0,
    verificationSlots: [], ...metrics };
}

export function recommendationFromCargoBuild(build: RadiusCargoBuild, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const lines = build.lines.map((line) => normalizeLine(line.row, line.units)).filter((line): line is RadiusBuyRecommendationLine => Boolean(line));
  const out = rec(build.id, "cargo_build", "buy", build.routeLabel, lines, { ...context, source: "cargo build" }, { sourcePackageKind: "cargo_build", selectedLineKeys: lines.map((line) => line.row ? routeLineKey(line.row) : `${line.typeId}:${line.routeKey}`) });
  out.reasons.push(`Build score ${build.finalScore.toFixed(1)} and fill ${build.cargoFillPercent.toFixed(1)}%`);
  return out;
}

export function recommendationsFromBuyStationShoppingList(list: RadiusBuyStationShoppingList, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation[] {
  const grouped = new Map<string, RadiusBuyRecommendationLine[]>();

  for (const line of list.lines) {
    const normalized = normalizeLine(line.row, line.units);
    if (!normalized) continue;
    const buyKey = String(line.row.BuyLocationID ?? line.row.BuyStation ?? list.buyStationName ?? "unknown-buy");
    const sellKey = String(line.row.SellLocationID ?? line.row.SellStation ?? list.primarySellStation ?? "unknown-sell");
    const legKey = `${buyKey}:${sellKey}`;
    const existing = grouped.get(legKey);
    if (existing) existing.push(normalized);
    else grouped.set(legKey, [normalized]);
  }

  return [...grouped.entries()].map(([legKey, lines], index) => {
    const legRec = rec(`${list.id}:leg:${legKey}`, "buy_station_list", "buy", list.buyStationName, lines, { ...context, source: "buy station list child package" }, { sourcePackageKind: "buy_station_child", selectedLineKeys: lines.map((line) => line.row ? routeLineKey(line.row) : `${line.typeId}:${line.routeKey}`) });
    legRec.reasons.push(`Station ${list.buyStationName} score ${list.actionableScore.toFixed(1)}`);
    legRec.reasons.push(`Shopping list leg package ${index + 1}/${grouped.size}`);
    return legRec;
  });
}

export function recommendationFromBuyStationShoppingList(list: RadiusBuyStationShoppingList, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  return recommendationsFromBuyStationShoppingList(list, context)[0] ?? rec(list.id, "buy_station_list", "buy", list.buyStationName, [], { ...context, source: "buy station list" });
}

export function recommendationFromSingleRow(row: FlipResult, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const line = normalizeLine(row, Number(row.UnitsToBuy ?? row.FilledQty ?? 0));
  return rec(`row:${row.TypeID}:${routeGroupKey(row)}`, "single_row", "buy", row.TypeName || "Row", line ? [line] : [], context, { sourcePackageKind: "single_row", selectedLineKeys: line ? [routeLineKey(row)] : [] });
}


export function recommendationFromRouteBatch(input: RecommendationFromRouteBatchInput, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const { routeKey, rows, metadata, cargoCapacityM3, originLabel } = input;
  const anchor = rows[0];
  const batch = anchor ? buildBatch(anchor, rows, cargoCapacityM3) : { lines: [], totalVolume: 0, totalProfit: 0, totalCapital: 0, totalGrossSell: 0, remainingM3: cargoCapacityM3, usedPercent: 0 };
  const lines = batch.lines.map((line) => normalizeLine(line.row, line.units)).filter((line): line is RadiusBuyRecommendationLine => Boolean(line));
  const selectedLineKeys = batch.lines.map((line) => routeLineKey(line.row));
  const verificationState = (metadata as { verificationState?: RadiusBuyRecommendation["verificationState"] } | undefined)?.verificationState;
  const buyJumps = safeNumber(anchor?.BuyJumps);
  const sellJumps = safeNumber(anchor?.SellJumps);
  const totalJumps = Math.max(1, safeNumber(anchor?.TotalJumps), buyJumps + sellJumps);
  return rec(`route:${routeKey}`, "route_group", "buy", originLabel ?? routeKey, lines, context, {
    sourcePackageKind: "route_batch",
    selectedLineKeys,
    jumpsToBuyStation: buyJumps,
    jumpsBuyToSell: sellJumps,
    totalJumps,
    cargoCapacityM3: Math.max(0, cargoCapacityM3),
    totalVolumeM3: safeNumber(batch.totalVolume),
    remainingCargoM3: safeNumber(batch.remainingM3),
    cargoUsedPercent: safeNumber(batch.usedPercent),
    batchProfitIsk: safeNumber(batch.totalProfit),
    batchCapitalIsk: safeNumber(batch.totalCapital),
    batchGrossSellIsk: safeNumber(batch.totalGrossSell),
    batchIskPerJump: safeNumber(batch.totalProfit) / Math.max(1, totalJumps),
    batchRoiPercent: safeNumber(batch.totalCapital) > 0 ? (safeNumber(batch.totalProfit) / safeNumber(batch.totalCapital)) * 100 : 0,
    verificationSlots: [],
    verificationState,
  });
}

export function recommendationFromRouteGroup(routeKey: string, rows: FlipResult[], context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const lines = rows.map((row) => normalizeLine(row, Number(row.UnitsToBuy ?? row.FilledQty ?? 0))).filter((line): line is RadiusBuyRecommendationLine => Boolean(line));
  return rec(`route:${routeKey}`, "route_group", "buy", routeKey, lines, context);
}

export function recommendationFromRejectedCargoBuild(rejected: RadiusRejectedCargoBuild, context: RadiusBuyRecommendationContext): RadiusBuyRecommendation {
  const action: RadiusBuyRecommendationAction = rejected.suggestedAction === "trim_lines" ? "trim" : rejected.suggestedAction === "skip" ? "watch" : "verify";
  const maybeLines = ((rejected as unknown as { lines?: Array<{ row: FlipResult; units: number }> }).lines ?? []);
  const nearMiss = maybeLines.map((line) => normalizeLine(line.row, line.units)).filter((line): line is RadiusBuyRecommendationLine => Boolean(line));
  const out = rec(`rejected:${rejected.routeKey}`, "rejected_cargo_build", action, rejected.routeLabel, nearMiss, context, { sourcePackageKind: "near_miss", selectedLineKeys: nearMiss.map((line) => line.row ? routeLineKey(line.row) : `${line.typeId}:${line.routeKey}`) });
  out.blockers = rejected.blockers.map((b) => b.message);
  out.diagnostics = rejected.blockers.map((b) => ({ kind: b.kind, message: b.message, actual: b.actual, required: b.required, severity: b.severity }));
  out.warnings.push("Near miss recommendation; manual verification required.");
  return out;
}
