import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { classifyRadiusDealRisk } from "@/lib/radiusDealRisk";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 34,
    TypeName: "Tritanium",
    Volume: 0.01,
    BuyPrice: 5,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 6,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 1,
    MarginPercent: 12,
    UnitsToBuy: 100,
    BuyOrderRemain: 400,
    SellOrderRemain: 450,
    TotalProfit: 100,
    ProfitPerJump: 20,
    BuyJumps: 2,
    SellJumps: 2,
    TotalJumps: 4,
    DailyVolume: 1200,
    Velocity: 1,
    PriceTrend: 1,
    BuyCompetitors: 2,
    SellCompetitors: 3,
    DailyProfit: 50,
    FilledQty: 100,
    CanFill: true,
    SlippageBuyPct: 0.6,
    SlippageSellPct: 0.4,
    HistoryAvailable: true,
    DayTargetPeriodPrice: 6,
    DayTargetNowPrice: 6.1,
    DayPeriodProfit: 90,
    DayNowProfit: 95,
    DayPriceHistory: [5.8, 5.9, 6.0, 6.1, 6.0, 6.1],
    ...overrides,
  };
}

describe("classifyRadiusDealRisk", () => {
  it("classifies liquidity-safe rows as low risk", () => {
    const risk = classifyRadiusDealRisk(makeRow());
    expect(risk.score).toBeLessThan(25);
    expect(risk.label).toBe("Low");
    expect(risk.reasons).toEqual([]);
  });

  it("applies missing-history penalty", () => {
    const risk = classifyRadiusDealRisk(
      makeRow({ HistoryAvailable: false, DayTargetPeriodPrice: 0, DayPriceHistory: [] }),
    );
    expect(risk.score).toBeGreaterThanOrEqual(20);
    expect(risk.reasons).toContain("Missing market history");
  });

  it("applies no-volume penalty", () => {
    const risk = classifyRadiusDealRisk(makeRow({ DailyVolume: 0 }));
    expect(risk.score).toBeGreaterThanOrEqual(25);
    expect(risk.reasons).toContain("No daily volume");
  });

  it("raises risk for high slippage", () => {
    const mild = classifyRadiusDealRisk(makeRow({ SlippageBuyPct: 1.5, SlippageSellPct: 1.0 }));
    const high = classifyRadiusDealRisk(makeRow({ SlippageBuyPct: 7.5, SlippageSellPct: 6.0 }));
    expect(high.score).toBeGreaterThan(mild.score);
    expect(high.reasons).toContain("Very high slippage");
  });

  it("penalizes thin depth and weak fillability", () => {
    const risk = classifyRadiusDealRisk(
      makeRow({
        UnitsToBuy: 500,
        FilledQty: 200,
        CanFill: false,
        BuyOrderRemain: 120,
        SellOrderRemain: 30,
        DailyVolume: 300,
      }),
    );
    expect(risk.score).toBeGreaterThanOrEqual(35);
    expect(["Medium", "High", "Extreme"]).toContain(risk.label);
    expect(risk.reasons).toEqual(
      expect.arrayContaining([
        "Modeled size cannot fully fill",
        "Planned units exceed depth support",
      ]),
    );
  });
});
