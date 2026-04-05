import { describe, expect, it } from "vitest";
import type { RouteResult } from "@/lib/types";
import {
  formatFullRunSummary,
  formatMultibuyByStop,
  formatSellChecklistByStop,
  formatValidationSummary,
} from "@/lib/routePlannerExportFormat";
import type { RoutePlanValidationResult } from "@/lib/routePlanValidation";

const route: RouteResult = {
  Hops: [
    {
      SystemName: "Jita",
      StationName: "Jita IV - Moon 4",
      SystemID: 30000142,
      DestSystemName: "Amarr",
      DestStationName: "Amarr VIII",
      DestSystemID: 30002187,
      TypeName: "Tritanium",
      TypeID: 34,
      BuyPrice: 5,
      SellPrice: 7,
      Units: 1000,
      Profit: 2000,
      Jumps: 9,
      RegionID: 10000002,
    },
  ],
  TotalProfit: 2000,
  TotalJumps: 9,
  ProfitPerJump: 222,
  HopCount: 1,
};

const validation: RoutePlanValidationResult = {
  band: "yellow",
  snapshot_stale: true,
  snapshot_age_minutes: 19.4,
  total_buy_drift_pct: 3.2,
  total_sell_drift_pct: 1.1,
  snapshot_buy_isk: 5000,
  snapshot_sell_isk: 7000,
  expected_net_isk: 1800,
  route_profit_retained_pct: 90,
  edge_retained_pct: 90,
  min_stop_liquidity_retained_pct: 88,
  avg_fill_confidence_pct: 88,
  degraded_stop_count: 1,
  checkpoints: [
    { name: "pre-undock", band: "yellow" },
    { name: "pre-sale", band: "green" },
  ],
  stops: [
    {
      stop_key: "30000142:30002187:0",
      snapshot_buy_isk: 5000,
      snapshot_sell_isk: 7000,
      expected_net_isk: 1800,
      fill_confidence_pct: 88,
      buy_ceiling_isk: 5250,
      sell_floor_isk: 6650,
      buy_drift_pct: 3.2,
      sell_drift_pct: 1.1,
      retained_profit_pct: 90,
      liquidity_retained_pct: 88,
      band: "yellow",
    },
  ],
};

describe("routePlannerExportFormat", () => {
  it("formats multibuy by stop", () => {
    expect(formatMultibuyByStop({ route })).toMatchInlineSnapshot(`
      "=== MULTIBUY BY STOP ===

      Stop 1: Jita IV - Moon 4 (Jita)
      Tritanium 1000"
    `);
  });

  it("formats sell checklist by stop", () => {
    expect(formatSellChecklistByStop({ route })).toMatchInlineSnapshot(`
      "=== SELL CHECKLIST BY STOP ===

      Stop 1: Amarr VIII (Amarr)
      Sell Tritanium x1000
      Snapshot sell: 7,000 ISK"
    `);
  });

  it("formats full run summary", () => {
    expect(formatFullRunSummary({ route }, validation)).toContain(
      "Degraded stop count: 1",
    );
    expect(formatFullRunSummary({ route }, validation)).toContain(
      "Validation status: yellow",
    );
  });

  it("formats validation summary", () => {
    expect(formatValidationSummary(validation)).toContain("Snapshot age: 19.4 min");
    expect(formatValidationSummary(validation)).toContain("Edge retained %: 90.0%");
  });
});
