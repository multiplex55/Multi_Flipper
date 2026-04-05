import { describe, expect, it } from "vitest";
import {
  ROUTE_SAFETY_RANK,
  normalizeRouteSafety,
  routeSafetyRank,
  routeSafetyRankFromState,
} from "@/lib/routeSafetySort";

describe("routeSafetySort", () => {
  it("sorts green ahead of unknown/loading", () => {
    expect(routeSafetyRank("green")).toBeLessThan(routeSafetyRank("unknown"));
    expect(routeSafetyRankFromState({ status: "loading" })).toBe(
      ROUTE_SAFETY_RANK.unknown,
    );
    expect(routeSafetyRank("green")).toBeLessThan(
      routeSafetyRankFromState({ status: "loading" }),
    );
  });

  it("never lets unknown outrank green across tie conditions", () => {
    const green = routeSafetyRank("green");
    const unknown = routeSafetyRank("unknown");
    expect(unknown).toBeGreaterThan(green);
    expect(routeSafetyRankFromState(undefined)).toBeGreaterThan(green);
    expect(routeSafetyRankFromState(null)).toBeGreaterThan(green);
  });

  it("has a full canonical ordering for all safety states", () => {
    const ordering = ["green", "yellow", "red", "unknown"] as const;
    const ranks = ordering.map((state) => ROUTE_SAFETY_RANK[state]);
    expect(ranks).toEqual([0, 1, 2, 3]);
    expect(routeSafetyRank("green")).toBeLessThan(routeSafetyRank("yellow"));
    expect(routeSafetyRank("yellow")).toBeLessThan(routeSafetyRank("red"));
    expect(routeSafetyRank("red")).toBeLessThan(routeSafetyRank("unknown"));
  });

  it("normalizes mixed-case and alias labels", () => {
    expect(normalizeRouteSafety(" GREEN ")).toBe("green");
    expect(normalizeRouteSafety("Amber")).toBe("yellow");
    expect(normalizeRouteSafety("danger")).toBe("red");
    expect(normalizeRouteSafety("N/A")).toBe("unknown");
    expect(normalizeRouteSafety("Loading")).toBe("unknown");
  });
});
