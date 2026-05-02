import { routeLineKey } from "@/lib/batchMetrics";
import type { BatchRouteFillerSuggestionRow, FlipResult } from "@/lib/types";

export interface PlannedFillerSuggestion extends BatchRouteFillerSuggestionRow {
  lineKey: string;
  iskPerM3: number;
  score: number;
}

export function planRouteFillSuggestions(input: {
  rows: FlipResult[];
  suggestions: BatchRouteFillerSuggestionRow[];
  selectedLineKeys: string[];
  remainingCargoM3: number;
  minConfidence?: number;
  maxStaleRisk?: number;
  maxSlippageRisk?: number;
}): PlannedFillerSuggestion[] {
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

  return suggestions
    .map((s) => ({
      ...s,
      tuple: [s.type_id, s.buy_location_id || s.buy_system_id, s.sell_location_id || s.sell_system_id].join(":"),
      lineKey: `${s.type_id}:${s.buy_location_id}:${s.sell_location_id}`,
    }))
    .filter(
      (s) =>
        tuples.has(s.tuple) &&
        !selected.has(s.lineKey) &&
        s.added_profit_isk > 0 &&
        s.volume_m3 >= 0 &&
        s.volume_m3 <= Math.max(0, remainingCargoM3) &&
        s.fill_confidence >= minConfidence &&
        s.stale_risk <= maxStaleRisk &&
        1 - s.filler_score / 100 <= maxSlippageRisk,
    )
    .map((s) => {
      const iskPerM3 = s.volume_m3 > 0 ? s.added_profit_isk / s.volume_m3 : 0;
      const quality = (s.fill_confidence * 100 + s.filler_score) / 2;
      const riskPenalty = (s.stale_risk + (1 - s.filler_score / 100)) * 20;
      return {
        ...s,
        iskPerM3,
        score: s.added_profit_isk / 1000 + iskPerM3 + quality - riskPenalty,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.added_profit_isk - a.added_profit_isk ||
        b.iskPerM3 - a.iskPerM3 ||
        b.fill_confidence - a.fill_confidence ||
        a.stale_risk - b.stale_risk,
    );
}
