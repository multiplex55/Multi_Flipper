import { beforeEach, describe, expect, it } from "vitest";
import type { SavedRoutePack } from "@/lib/types";
import {
  SAVED_ROUTE_PACKS_STORAGE_KEY,
  findSavedRoutePack,
  loadSavedRoutePacks,
  removeSavedRoutePack,
  saveSavedRoutePacks,
  upsertSavedRoutePack,
} from "@/lib/savedRoutePacks";

function makePack(overrides: Partial<SavedRoutePack> = {}): SavedRoutePack {
  return {
    routeKey: "loc:1->loc:2",
    routeLabel: "Jita → Amarr",
    buyLocationId: 1,
    sellLocationId: 2,
    buySystemId: 30000142,
    sellSystemId: 30002187,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastVerifiedAt: null,
    entryMode: "core",
    launchIntent: null,
    selectedLineKeys: ["200:1:2", "100:1:2"],
    excludedLineKeys: ["300:1:2"],
    summarySnapshot: {
      routeItemCount: 2,
      routeTotalProfit: 12345,
      routeTotalCapital: 200000,
      routeRealIskPerJump: 5000,
      routeDailyIskPerJump: 2500,
      routeDailyProfit: 7500,
      routeWeightedSlippagePct: 1.2,
      routeTurnoverDays: 2,
      routeSafetyRank: 0,
    },
    lines: {
      "100:1:2": {
        lineKey: "100:1:2",
        typeId: 100,
        typeName: "Type 100",
        plannedQty: 10,
        plannedBuyPrice: 100,
        plannedSellPrice: 130,
        plannedProfit: 300,
        plannedVolume: 10,
        boughtQty: 0,
        boughtTotal: 0,
        soldQty: 0,
        soldTotal: 0,
        remainingQty: 10,
        status: "planned",
        skipReason: null,
        notes: "",
      },
    },
    manifestSnapshot: null,
    verificationSnapshot: null,
    notes: "",
    tags: [],
    status: "active",
    ...overrides,
  };
}

describe("savedRoutePacks", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("load/save roundtrip", () => {
    const packs = [makePack()];
    saveSavedRoutePacks(packs);
    expect(loadSavedRoutePacks()).toEqual([
      {
        ...packs[0],
        selectedLineKeys: ["100:1:2", "200:1:2"],
      },
    ]);
  });

  it("upsert replaces by routeKey", () => {
    upsertSavedRoutePack(makePack({ routeLabel: "Old" }));
    const next = upsertSavedRoutePack(makePack({ routeLabel: "New", updatedAt: "2026-01-02T00:00:00.000Z" }));
    expect(next).toHaveLength(1);
    expect(next[0].routeLabel).toBe("New");
  });

  it("remove/find behavior", () => {
    upsertSavedRoutePack(makePack());
    expect(findSavedRoutePack("loc:1->loc:2")?.routeLabel).toBe("Jita → Amarr");
    const next = removeSavedRoutePack("loc:1->loc:2");
    expect(next).toEqual([]);
    expect(findSavedRoutePack("loc:1->loc:2")).toBeNull();
  });

  it("malformed storage fallback behavior", () => {
    localStorage.setItem(SAVED_ROUTE_PACKS_STORAGE_KEY, "{broken");
    expect(loadSavedRoutePacks()).toEqual([]);
  });

  it("stable key persistence keeps line keys unchanged when input order changes", () => {
    saveSavedRoutePacks([
      makePack({
        selectedLineKeys: ["z:1:2", "a:1:2", "m:1:2"],
      }),
    ]);
    const once = loadSavedRoutePacks()[0].selectedLineKeys;
    saveSavedRoutePacks([
      makePack({
        selectedLineKeys: ["m:1:2", "z:1:2", "a:1:2"],
      }),
    ]);
    const twice = loadSavedRoutePacks()[0].selectedLineKeys;
    expect(once).toEqual(["a:1:2", "m:1:2", "z:1:2"]);
    expect(twice).toEqual(["a:1:2", "m:1:2", "z:1:2"]);
  });
});
