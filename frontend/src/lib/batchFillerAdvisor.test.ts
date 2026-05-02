import { describe, expect, it } from "vitest";
import { planRouteFillSuggestions } from "@/lib/batchFillerAdvisor";
import type { BatchRouteFillerSuggestionRow, FlipResult } from "@/lib/types";

const row = (o: Partial<FlipResult>) => ({ TypeID: 1, TypeName: "A", BuySystemID: 10, BuyLocationID: 100, SellSystemID: 20, SellLocationID: 200, ...o } as FlipResult);
const suggestion = (o: Partial<BatchRouteFillerSuggestionRow>) => ({ type_id: 1, type_name: "A", units: 1, unit_volume_m3: 1, buy_system_id: 10, buy_location_id: 100, sell_system_id: 20, sell_location_id: 200, volume_m3: 10, added_profit_isk: 1000, added_capital_isk: 100, fill_confidence: 0.7, stale_risk: 0.1, suggested_role: "safe_filler", filler_score: 80, ...o });

describe("batchFillerAdvisor", () => {
  it("excludes already selected lines", () => {
    const out = planRouteFillSuggestions({ rows: [row({})], selectedLineKeys: ["1:100:200"], remainingCargoM3: 20, suggestions: [suggestion({})] });
    expect(out).toHaveLength(0);
  });

  it("includes zero-volume profitable candidates", () => {
    const out = planRouteFillSuggestions({ rows: [row({ TypeID: 3, BuyLocationID: 102, SellLocationID: 202 })], selectedLineKeys: [], remainingCargoM3: 0, suggestions: [suggestion({ type_id: 3, buy_location_id: 102, sell_location_id: 202, volume_m3: 0, added_profit_isk: 3000 })] });
    expect(out).toHaveLength(1);
    expect(out[0].profitLabel).toBe("best_profit");
  });

  it("respects remaining cargo constraints for positive-volume lines", () => {
    const out = planRouteFillSuggestions({ rows: [row({ TypeID: 4, BuyLocationID: 103, SellLocationID: 203 })], selectedLineKeys: [], remainingCargoM3: 5, suggestions: [suggestion({ type_id: 4, buy_location_id: 103, sell_location_id: 203, volume_m3: 10 })] });
    expect(out).toHaveLength(0);
  });

  it("groups suggestions by safety/profit/risk labels", () => {
    const out = planRouteFillSuggestions({ rows: [row({ TypeID: 5, BuyLocationID: 104, SellLocationID: 204 }), row({ TypeID: 6, BuyLocationID: 105, SellLocationID: 205 }), row({ TypeID: 7, BuyLocationID: 106, SellLocationID: 206 })], selectedLineKeys: [], remainingCargoM3: 50, suggestions: [suggestion({ type_id: 5, buy_location_id: 104, sell_location_id: 204, added_profit_isk: 9000 }), suggestion({ type_id: 6, buy_location_id: 105, sell_location_id: 205, stale_risk: 0.95 }), suggestion({ type_id: 7, buy_location_id: 106, sell_location_id: 206, volume_m3: 0, added_profit_isk: 1000 })] });
    expect(out.some((s) => s.profitLabel === "best_profit")).toBe(true);
    expect(out.some((s) => s.profitLabel === "risky_profit")).toBe(true);
    expect(out.some((s) => s.profitLabel === "zero_volume_profit" || s.profitLabel === "best_profit")).toBe(true);
  });
});
