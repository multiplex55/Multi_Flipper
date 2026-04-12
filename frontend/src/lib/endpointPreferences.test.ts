import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
  EndpointPreferenceApplicationMode,
  evaluateEndpointPreferences,
  isLikelyStructureStation,
  isMajorHubSystem,
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
  SellPrice: 12,
  SellStation: "Amarr VIII (Oris) - Emperor Family Academy",
  SellSystemName: "Amarr",
  SellSystemID: 30002187,
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

  it("hides rows with negative violations in hide mode", () => {
    const evaluated = evaluateEndpointPreferences(
      baseRow,
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      ["Jita", "Amarr", "Dodixie", "Rens", "Hek"],
      EndpointPreferenceApplicationMode.Hide,
    );
    expect(evaluated.excluded).toBe(true);
    expect(evaluated.appliedRules).toContain("buy_hub_penalty");
  });

  it("keeps row visible in deprioritize mode while applying score deltas", () => {
    const evaluated = evaluateEndpointPreferences(
      { ...baseRow, BuySystemName: "Perimeter", SellSystemName: "Jita" },
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.Deprioritize,
    );
    expect(evaluated.excluded).toBe(false);
    expect(evaluated.scoreDelta).not.toBe(0);
    expect(evaluated.appliedRules).toContain("route_direction_bonus");
  });

  it("applies hub penalty in deprioritize mode without forced exclusion and lowers relative rank", () => {
    const majorHubs = ["Jita", "Amarr"];
    const hubBuy = evaluateEndpointPreferences(
      { ...baseRow, BuySystemName: "Jita", SellSystemName: "Perimeter" },
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      majorHubs,
      EndpointPreferenceApplicationMode.Deprioritize,
    );
    const nonHubBuy = evaluateEndpointPreferences(
      { ...baseRow, BuySystemName: "Perimeter", SellSystemName: "Jita" },
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      majorHubs,
      EndpointPreferenceApplicationMode.Deprioritize,
    );

    expect(hubBuy.excluded).toBe(false);
    expect(hubBuy.scoreDelta).toBeLessThan(nonHubBuy.scoreDelta);
  });

  it("structure sell bonus improves ordering versus non-structure sell endpoints", () => {
    const majorHubs = ["Jita", "Amarr"];
    const structureSell = evaluateEndpointPreferences(
      { ...baseRow, BuySystemName: "Perimeter", SellSystemName: "Amarr", SellStation: "Perimeter Keepstar Freeport" },
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      majorHubs,
      EndpointPreferenceApplicationMode.Deprioritize,
    );
    const normalSell = evaluateEndpointPreferences(
      { ...baseRow, BuySystemName: "Perimeter", SellSystemName: "Amarr", SellStation: "Amarr VIII (Oris) - Emperor Family Academy" },
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      majorHubs,
      EndpointPreferenceApplicationMode.Deprioritize,
    );

    expect(structureSell.appliedRules).toContain("sell_structure_bonus");
    expect(structureSell.scoreDelta).toBeGreaterThan(normalSell.scoreDelta);
  });

  it("hide mode excludes rows that deprioritize mode keeps", () => {
    const row = { ...baseRow, BuySystemName: "Jita", SellSystemName: "Amarr" };
    const hideEval = evaluateEndpointPreferences(
      row,
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.Hide,
    );
    const deprioritizeEval = evaluateEndpointPreferences(
      row,
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      ["Jita", "Amarr"],
      EndpointPreferenceApplicationMode.Deprioritize,
    );

    expect(hideEval.excluded).toBe(true);
    expect(deprioritizeEval.excluded).toBe(false);
  });

  it("uses user-defined major hub lists over defaults", () => {
    const row = { ...baseRow, BuySystemName: "Jita", SellSystemName: "Amarr" };
    const defaultLikeEval = evaluateEndpointPreferences(
      row,
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      ["Jita", "Amarr", "Dodixie", "Rens", "Hek"],
      EndpointPreferenceApplicationMode.Deprioritize,
    );
    const customEval = evaluateEndpointPreferences(
      row,
      DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
      ["Perimeter"],
      EndpointPreferenceApplicationMode.Deprioritize,
    );

    expect(defaultLikeEval.appliedRules).toContain("buy_hub_penalty");
    expect(customEval.appliedRules).not.toContain("buy_hub_penalty");
    expect(customEval.appliedRules).toContain("non_hub_buy_bonus");
  });
});
