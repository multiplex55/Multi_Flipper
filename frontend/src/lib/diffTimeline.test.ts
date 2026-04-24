import { describe, expect, it } from "vitest";
import { buildDeterministicDiffTimeline } from "@/lib/diffTimeline";

describe("buildDeterministicDiffTimeline", () => {
  it("orders by timestamp then key and computes deterministic deltas", () => {
    const timeline = buildDeterministicDiffTimeline([
      {
        timeline_key: "b",
        label: "B",
        timestamp: "2026-01-02T00:00:00Z",
        fields: { buy: "Jita", sell: "Amarr", net_profit: 200, margin: 10, daily_volume: 40, route_risk: 2, confidence_proxy: 0.4 },
      },
      {
        timeline_key: "a",
        label: "A",
        timestamp: "2026-01-01T00:00:00Z",
        fields: { buy: "Jita", sell: "Amarr", net_profit: 100, margin: 7, daily_volume: 30, route_risk: 1, confidence_proxy: 0.2 },
      },
    ]);

    expect(timeline.map((item) => item.timeline_key)).toEqual(["a", "b"]);
    expect(timeline[0].delta.net_profit).toBeUndefined();
    expect(timeline[1].delta.net_profit).toBe(100);
    expect(timeline[1].delta.margin).toBe(3);
    expect(timeline[1].delta.buy_changed).toBe(false);
    expect(timeline[1].delta.sell_changed).toBe(false);
  });

  it("handles location changes and missing values", () => {
    const timeline = buildDeterministicDiffTimeline([
      {
        timeline_key: "a",
        label: "A",
        timestamp: "2026-01-01T00:00:00Z",
        fields: { buy: "Jita", sell: "Amarr", net_profit: 100 },
      },
      {
        timeline_key: "b",
        label: "B",
        timestamp: "2026-01-02T00:00:00Z",
        fields: { buy: "Dodixie", sell: "Hek" },
      },
    ]);

    expect(timeline[1].delta.buy_changed).toBe(true);
    expect(timeline[1].delta.sell_changed).toBe(true);
    expect(timeline[1].delta.net_profit).toBeUndefined();
  });
});
