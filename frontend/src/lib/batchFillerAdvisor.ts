import { routeLineKey } from "@/lib/batchMetrics";
import type { BatchRouteFillerSuggestionRow, FlipResult } from "@/lib/types";

export interface BatchBuilderFillerSuggestion extends BatchRouteFillerSuggestionRow {
  lineKey: string;
  iskPerM3: number;
  roiPct: number;
  score: number;
  sameLeg: boolean;
  safetyLabel: "safe" | "risky";
  profitLabel: "best_profit" | "best_safe" | "zero_volume_profit" | "risky_profit";
  warnings: string[];
  reasons: string[];
}

export function planRouteFillSuggestions(input: {
  rows: FlipResult[];
  suggestions: BatchRouteFillerSuggestionRow[];
  selectedLineKeys: string[];
  remainingCargoM3: number;
  minConfidence?: number;
  maxStaleRisk?: number;
  maxSlippageRisk?: number;
}): BatchBuilderFillerSuggestion[] {
  const {
    rows,
    suggestions,
    selectedLineKeys,
    remainingCargoM3,
    minConfidence = 0.5,
    maxStaleRisk = 0.7,
    maxSlippageRisk = 0.7,
  } = input;

  const selected = new Set(selectedLineKeys);
  const tuples = new Set(
    rows
      .filter((r) => !selected.has(routeLineKey(r)))
      .map((r) =>
        [r.TypeID, r.BuyLocationID || r.BuySystemID, r.SellLocationID || r.SellSystemID].join(":")
      ),
  );
  const preferredLegs = new Set(
    rows.map((r) => [r.BuyLocationID || r.BuySystemID, r.SellLocationID || r.SellSystemID].join(":")),
  );

  const planned = suggestions
    .map((s) => ({
      ...s,
      tuple: [s.type_id, s.buy_location_id || s.buy_system_id, s.sell_location_id || s.sell_system_id].join(":"),
      lineKey: `${s.type_id}:${s.buy_location_id}:${s.sell_location_id}`,
    }))
    .filter((s) => tuples.has(s.tuple) && !selected.has(s.lineKey) && s.added_profit_isk > 0 && s.volume_m3 >= 0)
    .filter((s) => s.volume_m3 === 0 || s.volume_m3 <= Math.max(0, remainingCargoM3))
    .map((s) => {
      const slippageRisk = 1 - s.filler_score / 100;
      const sameLeg = preferredLegs.has([s.buy_location_id || s.buy_system_id, s.sell_location_id || s.sell_system_id].join(":"));
      const safetyOk = s.fill_confidence >= minConfidence && s.stale_risk <= maxStaleRisk && slippageRisk <= maxSlippageRisk;
      const iskPerM3 = s.volume_m3 > 0 ? s.added_profit_isk / s.volume_m3 : s.added_profit_isk;
      const roiPct = s.added_capital_isk > 0 ? (s.added_profit_isk / s.added_capital_isk) * 100 : 0;
      const quality = s.fill_confidence * 45 + s.filler_score * 0.35 + (1 - slippageRisk) * 20;
      const riskPenalty = (s.stale_risk + slippageRisk) * 30;
      const score = (s.added_profit_isk / 1000) + (iskPerM3 / 100) + roiPct + quality - riskPenalty + (sameLeg ? 10 : 0);
      const warnings: string[] = [];
      if (!safetyOk) warnings.push("elevated execution risk");
      if (s.volume_m3 === 0) warnings.push("zero-volume estimate");
      const reasons = [sameLeg ? "same buy/sell leg" : "alternate leg", `fill ${(s.fill_confidence * 100).toFixed(0)}%`];
      const profitLabel: BatchBuilderFillerSuggestion["profitLabel"] = s.volume_m3 === 0 ? "zero_volume_profit" : safetyOk ? "best_safe" : "risky_profit";
      const safetyLabel: BatchBuilderFillerSuggestion["safetyLabel"] = safetyOk ? "safe" : "risky";
      return { ...s, sameLeg, safetyLabel, profitLabel, warnings, reasons, iskPerM3, roiPct, score };
    })
    .sort((a,b)=> b.score-a.score || b.added_profit_isk-a.added_profit_isk || b.iskPerM3-a.iskPerM3 || b.fill_confidence-a.fill_confidence || a.stale_risk-b.stale_risk);
  const bestProfitKey = planned[0]?.lineKey;
  return planned.map((s) => ({ ...s, profitLabel: s.lineKey === bestProfitKey ? "best_profit" : s.profitLabel }));
}
