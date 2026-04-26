import { describe, expect, it } from "vitest";
import { makeFlipResult } from "@/lib/testFixtures";
import {
  buildRadiusDealSnapshots,
  compareRadiusDealSnapshots,
} from "@/lib/radiusDealMovement";

function row(overrides: Parameters<typeof makeFlipResult>[0] = {}) {
  return makeFlipResult({
    TypeID: 34,
    BuyLocationID: 60003760,
    SellLocationID: 60008494,
    BuySystemID: 30000142,
    SellSystemID: 30002187,
    ExpectedProfit: 100_000_000,
    UnitsToBuy: 100,
    FilledQty: 100,
    SlippageBuyPct: 2,
    SlippageSellPct: 1,
    ...overrides,
  });
}

describe("radiusDealMovement", () => {
  it("marks first scan rows as new", () => {
    const current = buildRadiusDealSnapshots([row()]);
    const compared = compareRadiusDealSnapshots(new Map(), current);
    const movement = [...compared.movementByKey.values()][0];
    expect(movement?.label).toBe("new");
    expect(compared.disappearedKeys.size).toBe(0);
  });

  it("classifies improving/worse/collapsing and stable deltas", () => {
    const prev = buildRadiusDealSnapshots([
      row({ TypeID: 1, ExpectedProfit: 100_000_000, UnitsToBuy: 100, SlippageBuyPct: 2 }),
      row({ TypeID: 2, ExpectedProfit: 100_000_000, UnitsToBuy: 100, SlippageBuyPct: 2 }),
      row({ TypeID: 3, ExpectedProfit: 100_000_000, UnitsToBuy: 100, SlippageBuyPct: 2 }),
      row({ TypeID: 4, ExpectedProfit: 100_000_000, UnitsToBuy: 100, SlippageBuyPct: 2 }),
    ]);
    const curr = buildRadiusDealSnapshots([
      row({ TypeID: 1, ExpectedProfit: 118_000_000, UnitsToBuy: 110, SlippageBuyPct: 1 }),
      row({ TypeID: 2, ExpectedProfit: 85_000_000, UnitsToBuy: 100, SlippageBuyPct: 8 }),
      row({ TypeID: 3, ExpectedProfit: 58_000_000, UnitsToBuy: 40, SlippageBuyPct: 12 }),
      row({ TypeID: 4, ExpectedProfit: 103_000_000, UnitsToBuy: 99, SlippageBuyPct: 2 }),
    ]);

    const compared = compareRadiusDealSnapshots(prev, curr);
    const byLabel = [...compared.movementByKey.values()].reduce<Record<string, string>>((acc, entry) => {
      acc[String(entry.key.split("|")[1])] = entry.label;
      return acc;
    }, {});

    expect(byLabel["1"]).toBe("improving");
    expect(byLabel["2"]).toBe("worse");
    expect(byLabel["3"]).toBe("collapsing");
    expect(byLabel["4"]).toBe("stable");
  });

  it("tracks disappeared keys", () => {
    const prev = buildRadiusDealSnapshots([row({ TypeID: 77 }), row({ TypeID: 78 })]);
    const curr = buildRadiusDealSnapshots([row({ TypeID: 77 })]);
    const compared = compareRadiusDealSnapshots(prev, curr);
    expect(compared.disappearedKeys.size).toBe(1);
    const disappeared = [...compared.disappearedKeys][0];
    expect(disappeared.includes("|78|")).toBe(true);
  });
});
