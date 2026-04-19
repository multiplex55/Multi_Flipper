import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
  ENDPOINT_PREFERENCE_PRESETS,
  EndpointPreferenceApplicationMode,
  evaluateEndpointPreferences,
  isLikelyStructureStation,
  isMajorHubSystem,
  isStructureLocationID,
  normalizeMajorHubSystems,
} from "@/lib/endpointPreferences";
import type { FlipResult } from "@/lib/types";

const baseRow: FlipResult = {
  TypeID: 1,
  TypeName: "Tritanium",
  Volume: 0.01,
  BuyPrice: 10,
  BuyStation: "Jita IV - Moon 4",
  BuySystemName: "Jita",
  BuySystemID: 30000142,
  BuyLocationID: 60003760,
  SellPrice: 12,
  SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
  SellSystemName: "Amarr",
  SellSystemID: 30002187,
  SellLocationID: 60008494,
  ProfitPerUnit: 2,
  MarginPercent: 20,
  UnitsToBuy: 100,
  BuyOrderRemain: 1000,
  SellOrderRemain: 1000,
  TotalProfit: 200,
  ProfitPerJump: 50,
  BuyJumps: 1,
  SellJumps: 3,
  TotalJumps: 4,
  DailyVolume: 10000,
  Velocity: 1,
  PriceTrend: 0,
  BuyCompetitors: 2,
  SellCompetitors: 2,
  DailyProfit: 200,
};

describe("endpointPreferences", () => {
  it("normalizes hub systems and removes blanks", () => {
    expect(normalizeMajorHubSystems([" Jita ", "", "Jita", "Amarr"]))
      .toEqual(["Jita", "Amarr"]);
  });

  it("detects known hubs case-insensitively", () => {
    expect(isMajorHubSystem("jita", ["Jita", "Amarr"]))
      .toBe(true);
    expect(isMajorHubSystem("Dodixie", ["Jita", "Amarr"]))
      .toBe(false);
  });

  it("detects structure stations by marker", () => {
    expect(isLikelyStructureStation("Perimeter Keepstar Freeport")).toBe(true);
    expect(isLikelyStructureStation("Jita IV - Moon 4")).toBe(false);
  });

  it("detects structure location IDs using numeric threshold", () => {
    expect(isStructureLocationID(1_000_000_000_001)).toBe(true);
    expect(isStructureLocationID(60_003_760)).toBe(false);
  });

  it("structure-only hard rule excludes NPC sell row in hide mode", () => {
    const profile = {
      ...DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      requireSellStructure: true,
    };

    const evaluated = evaluateEndpointPreferences(
      baseRow,
      profile,
      ["Jita", "Amarr", "Dodixie", "Rens", "Hek"],
      EndpointPreferenceApplicationMode.Hide,
    );

    expect(evaluated.excluded).toBe(true);
    expect(evaluated.excludedReasons).toContain("hard_require_sell_structure");
  });

  it("preset semantics: structure_exit activates hard sell-structure rule", () => {
    expect(ENDPOINT_PREFERENCE_PRESETS.structure_exit.requireSellStructure).toBe(true);
    expect(ENDPOINT_PREFERENCE_PRESETS.safe_arbitrage.requireSellStructure).toBe(false);
    expect(ENDPOINT_PREFERENCE_PRESETS.low_attention.requireSellStructure).toBe(false);
  });

  it("rank-only vs hide mode separation for hard-constraint outcomes", () => {
    const profile = {
      ...DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      requireSellStructure: true,
    };

    const hideEval = evaluateEndpointPreferences(
      baseRow,
      profile,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.Hide,
    );
    const rankOnlyEval = evaluateEndpointPreferences(
      baseRow,
      profile,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.RankOnly,
    );

    expect(hideEval.excluded).toBe(true);
    expect(rankOnlyEval.excluded).toBe(false);
    expect(rankOnlyEval.excludedReasons).toContain("hard_require_sell_structure");
    expect(rankOnlyEval.scoreDelta).toBe(hideEval.scoreDelta);
  });

  it("ID-first structure detection beats name fallback", () => {
    const profile = {
      ...DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      requireSellStructure: true,
    };
    const rowWithNpcNameButStructureId = {
      ...baseRow,
      SellLocationID: 1_000_000_000_777,
      SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
    };

    const evaluated = evaluateEndpointPreferences(
      rowWithNpcNameButStructureId,
      profile,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.Hide,
    );

    expect(evaluated.excluded).toBe(false);
    expect(evaluated.appliedRules).toContain("sell_structure_bonus");
  });

  it("disabled mode returns neutral output regardless of row and profile", () => {
    const profile = {
      ...DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      requireSellStructure: true,
      buyHubPenalty: -999,
      routeDirectionBonus: 777,
    };
    const row = {
      ...baseRow,
      BuySystemName: "Jita",
      SellSystemName: "Perimeter",
      SellLocationID: 60008494,
    };

    const evaluated = evaluateEndpointPreferences(
      row,
      profile,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.Disabled,
    );

    expect(evaluated).toEqual({
      scoreDelta: 0,
      excluded: false,
      excludedReasons: [],
      appliedRules: [],
    });
  });

  it("rank_only computes score delta but does not exclude", () => {
    const profile = {
      ...DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      requireNonHubBuy: true,
      nonHubBuyBonus: 11,
      routeDirectionBonus: 13,
    };
    const row = {
      ...baseRow,
      BuySystemName: "Jita",
      SellSystemName: "Amarr",
    };

    const evaluated = evaluateEndpointPreferences(
      row,
      profile,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.RankOnly,
    );

    expect(evaluated.scoreDelta).toBe(profile.buyHubPenalty);
    expect(evaluated.excluded).toBe(false);
    expect(evaluated.excludedReasons).toContain("hard_require_non_hub_buy");
  });

  it("hide mode can still exclude on hard-rule mismatch", () => {
    const profile = {
      ...DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      requireNonHubBuy: true,
    };

    const evaluated = evaluateEndpointPreferences(
      baseRow,
      profile,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.Hide,
    );

    expect(evaluated.excluded).toBe(true);
    expect(evaluated.excludedReasons).toContain("hard_require_non_hub_buy");
  });

  it("neutral preset has zero soft deltas and no exclusions in non-disabled modes", () => {
    const neutralProfile = ENDPOINT_PREFERENCE_PRESETS.neutral;
    const rankOnlyEval = evaluateEndpointPreferences(
      baseRow,
      neutralProfile,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.RankOnly,
    );
    const hideEval = evaluateEndpointPreferences(
      baseRow,
      neutralProfile,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.Hide,
    );

    expect(rankOnlyEval).toEqual({
      scoreDelta: 0,
      excluded: false,
      excludedReasons: [],
      appliedRules: [],
    });
    expect(hideEval).toEqual(rankOnlyEval);
  });

  it.each([
    {
      name: "positive delta from non-hub to hub route",
      row: { ...baseRow, BuySystemName: "Perimeter", SellSystemName: "Jita" },
      expectedSign: 1,
    },
    {
      name: "negative delta from hub buy and deadhead",
      row: { ...baseRow, BuySystemName: "Jita", SellSystemName: "Perimeter" },
      expectedSign: -1,
    },
    {
      name: "zero delta from neutral preset",
      row: { ...baseRow, BuySystemName: "Perimeter", SellSystemName: "Amarr" },
      useNeutral: true,
      expectedSign: 0,
    },
  ])("table-driven score delta scenario: $name", ({ row, expectedSign, useNeutral }) => {
    const profile = useNeutral
      ? ENDPOINT_PREFERENCE_PRESETS.neutral
      : ENDPOINT_PREFERENCE_PRESETS.safe_arbitrage;

    const evaluated = evaluateEndpointPreferences(
      row,
      profile,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.RankOnly,
    );

    if (expectedSign === 0) {
      expect(evaluated.scoreDelta).toBe(0);
      return;
    }
    expect(Math.sign(evaluated.scoreDelta)).toBe(expectedSign);
  });
});
