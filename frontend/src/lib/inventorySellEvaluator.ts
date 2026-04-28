import type { ClipboardInventoryLine } from "@/lib/clipboardSellList";
import type { FlipResult } from "@/lib/types";

export type SellEvaluatorOptions = {
  compareJita?: boolean;
  includeStructures?: boolean;
  requireDepthCoverage?: boolean;
};

export type SellItemCandidate = {
  locationKey: string;
  stationName: string;
  systemName: string;
  bidPrice: number;
  depthQty: number;
  totalJumps?: number;
};

export type SellItemEvaluation = {
  item: ClipboardInventoryLine;
  resolved: boolean;
  unresolvedReason?: string;
  candidates: SellItemCandidate[];
  best?: SellItemCandidate;
  depthCoveragePct: number;
  grossSellIsk: number;
  jitaPrice?: number;
  jitaBaselineIsk?: number;
  upliftIsk?: number;
  upliftPct?: number;
  confidence: "high" | "medium" | "low" | "missing";
  volumeM3: number;
};

export type SellLocationSummary = {
  locationKey: string;
  stationName: string;
  systemName: string;
  totalGrossSellIsk: number;
  totalJitaBaselineIsk: number;
  totalUpliftIsk: number;
  totalVolumeM3: number;
  totalItems: number;
  totalUnits: number;
  averageUpliftPct: number;
  avgIskPerJump?: number;
  jumps?: number;
};

export type InventorySellEvaluationResult = {
  items: SellItemEvaluation[];
  summaries: SellLocationSummary[];
  unresolvedItems: ClipboardInventoryLine[];
};

const normalize = (v: string) => v.trim().toLocaleLowerCase();

function confidenceFor(item: SellItemEvaluation, requireDepthCoverage = false) {
  if (!item.resolved || !item.best) return "missing" as const;
  if (requireDepthCoverage && item.depthCoveragePct < 100) return "low" as const;
  if (item.depthCoveragePct >= 100 && item.candidates.length >= 2) return "high" as const;
  if (item.depthCoveragePct >= 80) return "medium" as const;
  return "low" as const;
}

export function evaluateInventorySell(
  parsedItems: ClipboardInventoryLine[],
  rows: FlipResult[],
  options: SellEvaluatorOptions = {},
): InventorySellEvaluationResult {
  const grouped = new Map<string, FlipResult[]>();
  for (const row of rows) {
    const key = normalize(row.TypeName);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const jitaByType = new Map<string, number>();
  for (const row of rows) {
    if (row.BuySystemName?.toLocaleLowerCase() === "jita") {
      const current = jitaByType.get(normalize(row.TypeName)) ?? 0;
      jitaByType.set(normalize(row.TypeName), Math.max(current, row.BuyPrice || 0));
    }
  }

  const items: SellItemEvaluation[] = parsedItems.map((item) => {
    const key = normalize(item.name);
    const matched = grouped.get(key) ?? rows.filter((row) => row.TypeName === item.name);

    if (matched.length === 0) {
      return {
        item,
        resolved: false,
        unresolvedReason: "No market snapshot rows matched",
        candidates: [],
        depthCoveragePct: 0,
        grossSellIsk: 0,
        confidence: "missing",
        volumeM3: 0,
      };
    }

    const candidates: SellItemCandidate[] = matched
      .map((row) => ({
        locationKey: String(row.BuyLocationID ?? row.BuySystemID ?? row.BuyStation),
        stationName: row.BuyStation,
        systemName: row.BuySystemName,
        bidPrice: row.BuyPrice,
        depthQty: Math.max(row.BuyOrderRemain ?? 0, row.BestBidQty ?? 0),
        totalJumps: Number.isFinite(row.TotalJumps) ? row.TotalJumps : undefined,
      }))
      .filter((c) => c.bidPrice > 0);

    const best = [...candidates].sort((a, b) => b.bidPrice - a.bidPrice)[0];
    const depthQty = best?.depthQty ?? 0;
    const depthCoveragePct = item.quantity > 0 ? Math.min(100, (depthQty / item.quantity) * 100) : 0;
    const grossSellIsk = (best?.bidPrice ?? 0) * item.quantity;
    const rowVolume = matched[0]?.Volume ?? 0;
    const volumeM3 = rowVolume * item.quantity;
    const jitaPrice = jitaByType.get(key);
    const jitaBaselineIsk = options.compareJita && jitaPrice ? jitaPrice * item.quantity : undefined;
    const upliftIsk =
      options.compareJita && jitaBaselineIsk != null ? grossSellIsk - jitaBaselineIsk : undefined;
    const upliftPct =
      upliftIsk != null && jitaBaselineIsk && jitaBaselineIsk > 0
        ? (upliftIsk / jitaBaselineIsk) * 100
        : undefined;

    const evaluation: SellItemEvaluation = {
      item,
      resolved: Boolean(best),
      unresolvedReason: best ? undefined : "No positive bids",
      candidates,
      best,
      depthCoveragePct,
      grossSellIsk,
      jitaPrice,
      jitaBaselineIsk,
      upliftIsk,
      upliftPct,
      confidence: "missing",
      volumeM3,
    };
    evaluation.confidence = confidenceFor(evaluation, options.requireDepthCoverage);
    return evaluation;
  });

  const summaryMap = new Map<string, SellLocationSummary>();
  for (const item of items) {
    if (!item.best) continue;
    const key = item.best.locationKey;
    const existing =
      summaryMap.get(key) ?? {
        locationKey: key,
        stationName: item.best.stationName,
        systemName: item.best.systemName,
        totalGrossSellIsk: 0,
        totalJitaBaselineIsk: 0,
        totalUpliftIsk: 0,
        totalVolumeM3: 0,
        totalItems: 0,
        totalUnits: 0,
        averageUpliftPct: 0,
        avgIskPerJump: undefined,
        jumps: item.best.totalJumps,
      };
    existing.totalGrossSellIsk += item.grossSellIsk;
    existing.totalJitaBaselineIsk += item.jitaBaselineIsk ?? 0;
    existing.totalUpliftIsk += item.upliftIsk ?? 0;
    existing.totalVolumeM3 += item.volumeM3;
    existing.totalItems += 1;
    existing.totalUnits += item.item.quantity;
    summaryMap.set(key, existing);
  }

  const summaries = [...summaryMap.values()]
    .map((entry) => {
      entry.averageUpliftPct =
        entry.totalJitaBaselineIsk > 0
          ? (entry.totalUpliftIsk / entry.totalJitaBaselineIsk) * 100
          : 0;
      if (entry.jumps != null && entry.jumps > 0) {
        entry.avgIskPerJump = entry.totalGrossSellIsk / entry.jumps;
      }
      return entry;
    })
    .sort((a, b) => b.totalGrossSellIsk - a.totalGrossSellIsk || a.stationName.localeCompare(b.stationName));

  return {
    items,
    summaries,
    unresolvedItems: items.filter((item) => !item.resolved).map((item) => item.item),
  };
}

export function formatSellPlanText(result: InventorySellEvaluationResult): string {
  const top = result.summaries[0];
  const lines: string[] = [];
  lines.push("Sell Clipboard Plan");
  lines.push(`Station: ${top?.stationName ?? "N/A"}`);
  lines.push(`Jumps: ${top?.jumps ?? "N/A"}`);
  lines.push(`Items: ${result.items.length}`);
  lines.push(`Total Volume: ${top?.totalVolumeM3.toFixed(2) ?? "0.00"} m3`);
  lines.push(`Jita Baseline: ${Math.round(top?.totalJitaBaselineIsk ?? 0)} ISK`);
  lines.push(`Best Sell Value: ${Math.round(top?.totalGrossSellIsk ?? 0)} ISK`);
  lines.push(`Uplift: ${Math.round(top?.totalUpliftIsk ?? 0)} ISK (${(top?.averageUpliftPct ?? 0).toFixed(2)}%)`);
  lines.push("");
  for (const item of [...result.items].sort((a, b) => a.item.name.localeCompare(b.item.name))) {
    lines.push(
      `${item.item.name}\tqty=${item.item.quantity}\tbestBid=${item.best?.bidPrice ?? 0}\tjita=${item.jitaPrice ?? 0}\tuplift=${Math.round(item.upliftIsk ?? 0)}`,
    );
  }
  return lines.join("\n");
}
