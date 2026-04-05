import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpportunityScoreDetails } from "@/components/OpportunityScorePopover";
import { scoreFlipResult } from "@/lib/opportunityScore";
import { executionQualityForFlip } from "@/lib/executionQuality";
import type { FlipResult } from "@/lib/types";

function makeFlip(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 34,
    TypeName: "Tritanium",
    Volume: 0.01,
    BuyPrice: 5,
    BuyStation: "Jita",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellPrice: 7,
    SellStation: "Amarr",
    SellSystemName: "Amarr",
    SellSystemID: 30002187,
    ProfitPerUnit: 1,
    MarginPercent: 20,
    UnitsToBuy: 10000,
    BuyOrderRemain: 12000,
    SellOrderRemain: 10000,
    TotalProfit: 100000,
    ProfitPerJump: 20000,
    BuyJumps: 0,
    SellJumps: 4,
    TotalJumps: 4,
    DailyVolume: 25000,
    Velocity: 40,
    PriceTrend: 1,
    BuyCompetitors: 2,
    SellCompetitors: 3,
    DailyProfit: 50000,
    FilledQty: 9000,
    DayNowProfit: 200,
    DayPeriodProfit: -50,
    DayTargetPeriodPrice: 7,
    SlippageBuyPct: 4,
    SlippageSellPct: 3,
    ...overrides,
  };
}

describe("OpportunityScoreDetails", () => {
  it("shows dominant execution quality factors in explanation text", () => {
    const row = makeFlip();
    render(
      <OpportunityScoreDetails
        explanation={scoreFlipResult(row)}
        executionQuality={executionQualityForFlip(row)}
      />,
    );

    const dominant = screen.getByText(/Dominant drivers:/i);
    expect(dominant.textContent).toMatch(/penalty from/i);
    expect(dominant.textContent).toMatch(/Fill ratio|Slippage burden|Destination spike|History coverage|Top-of-book depth/);
  });
});
