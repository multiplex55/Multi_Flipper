import { describe, expect, it } from "vitest";
import { compareRadiusDealSnapshots, computeNewValueScore, summarizeRadiusMovement, type RadiusDealSnapshot } from "@/lib/radiusDealMovement";

function snap(key: string, profit: number, qty: number): RadiusDealSnapshot {
  return { key, routeKey: "a", typeId: 1, buyLocationId: 1, sellLocationId: 2, expectedProfitIsk: profit, quantity: qty, executionQuality: 70, trapRisk: 20 };
}

describe("radiusDealMovement", () => {
  it("detects new trade when absent in prior snapshot", () => {
    const res = compareRadiusDealSnapshots(new Map(), new Map([["k1", snap("k1", 100, 10)]]));
    expect(res.movementByKey.get("k1")?.label).toBe("new");
  });

  it("detects improving and collapsing from meaningful deltas", () => {
    const prev = new Map([["i", snap("i", 100, 10)], ["c", snap("c", 100, 10)]]);
    const curr = new Map([["i", snap("i", 130, 10)], ["c", snap("c", 40, 4)]]);
    const res = compareRadiusDealSnapshots(prev, curr);
    expect(res.movementByKey.get("i")?.label).toBe("improving");
    expect(res.movementByKey.get("c")?.label).toBe("collapsing");
  });

  it("reports disappeared keys from previous snapshot", () => {
    const res = compareRadiusDealSnapshots(new Map([["gone", snap("gone", 100, 10)]]), new Map());
    expect(res.disappearedKeys.has("gone")).toBe(true);
    const summary = summarizeRadiusMovement(res.movementByKey, res.disappearedKeys);
    expect(summary.disappeared).toBe(1);
  });

  it("computes deterministic value score with movement multipliers", () => {
    const n = computeNewValueScore({ realProfitIsk: 50_000_000, executionQuality: 80, liquidity: 1, movementLabel: "new" });
    const w = computeNewValueScore({ realProfitIsk: 50_000_000, executionQuality: 80, liquidity: 1, movementLabel: "worse" });
    expect(n).toBeGreaterThan(w);
  });
});
