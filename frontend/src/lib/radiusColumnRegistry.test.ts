import { describe, expect, it } from "vitest";
import {
  assertKnownRadiusColumnKeys,
  findMissingRadiusGuideEntries,
  radiusColumnRegistry,
} from "@/lib/radiusColumnRegistry";

const expectedTableGuideKeys = [
  "UrgencyScore",
  "OpportunityScore",
  "TrapRisk",
  "IskPerM3",
  "UnitsToBuy",
  "FilledQty",
  "CanFill",
  "BuyOrderRemain",
  "RoutePackTotalProfit",
  "RoutePackRealIskPerJump",
  "RoutePackWeakestExecutionQuality",
  "RoutePackTurnoverDays",
  "RoutePackBreakevenBuffer",
] as const;

describe("radiusColumnRegistry", () => {
  it("has unique keys", () => {
    const keys = radiusColumnRegistry.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes required metadata", () => {
    for (const entry of radiusColumnRegistry) {
      expect(entry.key).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.tooltip).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(["row", "route", "both"]).toContain(entry.applicability);
      expect(entry.guideCopy.whatItIs).toBeTruthy();
      expect(entry.guideCopy.whyImportant).toBeTruthy();
      expect(entry.guideCopy.goodValue).toBeTruthy();
      expect(entry.guideCopy.ideaFlipHeuristic).toBeTruthy();
    }
  });

  it("includes trap risk metadata", () => {
    const entry = radiusColumnRegistry.find((item) => item.key === "TrapRisk");
    expect(entry).toBeDefined();
    expect(entry?.category).toBe("Risk & Resilience");
  });

  it("supports table/guide parity helper", () => {
    expect(findMissingRadiusGuideEntries(expectedTableGuideKeys)).toEqual([]);
    expect(() =>
      assertKnownRadiusColumnKeys(expectedTableGuideKeys, "radiusColumnRegistry.test"),
    ).not.toThrow();
  });
});
