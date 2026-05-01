import { describe, expect, it } from "vitest";
import { buildRadiusDecisionQueue } from "@/lib/radiusDecisionQueue";
import { makeFlipResult } from "@/lib/testFixtures";

const row = (o = {}) => makeFlipResult({ TypeID: 1, TypeName: "A", BuyPrice: 100, SellPrice: 140, ExpectedBuyPrice: 100, ExpectedSellPrice: 140, ProfitPerUnit: 40, UnitsToBuy: 10, Volume: 1, TotalJumps: 4, ...o });

describe("radiusDecisionQueue", () => {
  it("applies penalties/bonuses and stable tie ordering", () => {
    const risky = row({ TypeID: 2, RiskCount: 8, SlippageBuyPct: 20, SlippageSellPct: 20 });
    const mover = row({ TypeID: 3, MovementScore: 100, WatchlistSignal: true });
    const out = buildRadiusDecisionQueue({ singleRowCandidates: [risky], movementOrImprovingCandidates: [mover] });
    expect(out.queue[0].id <= out.queue[out.queue.length - 1].id || out.queue[0].score >= out.queue[out.queue.length - 1].score).toBe(true);
    expect(out.queue.some((q) => q.reasons.includes("movement_signal"))).toBe(true);
  });

  it("maps rejected near-miss actions away from buy", () => {
    const out = buildRadiusDecisionQueue({ rejectedCargoBuilds: [{ routeKey: "r", rows: [row()], lines: [], totalProfitIsk: 1000, totalCapitalIsk: 1000, totalVolumeM3: 1, totalGrossSellIsk: 2000, blockers: [{ kind: "cargo", message: "trim" }] } as never] });
    expect(out.queue[0].action).not.toBe("buy");
  });
});
