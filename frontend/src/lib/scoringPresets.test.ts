import { describe, expect, it } from "vitest";
import { SCORING_RECIPES } from "@/lib/scoringPresets";

describe("SCORING_RECIPES", () => {
  it("emits expected payloads for each recipe", () => {
    expect(SCORING_RECIPES.fast_run).toMatchObject({
      sortKey: "RealIskPerJump",
      sortDir: "desc",
    });
    expect(SCORING_RECIPES.high_confidence).toMatchObject({
      sortKey: "ExecutionQuality",
      urgencyFilter: "stable",
    });
    expect(SCORING_RECIPES.cargo_efficient).toMatchObject({
      sortKey: "RealIskPerM3PerJump",
    });
    expect(SCORING_RECIPES.capital_efficient).toMatchObject({
      sortKey: "RoutePackDailyProfitOverCapital",
    });
    expect(SCORING_RECIPES.fragile_first).toMatchObject({
      sortKey: "UrgencyScore",
      urgencyFilter: "fragile",
    });
    expect(SCORING_RECIPES.backhaul_builder).toMatchObject({
      sortKey: "DailyIskPerJump",
      urgencyFilter: "aging",
    });
  });
});
