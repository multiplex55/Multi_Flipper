import { describe, expect, it } from "vitest";
import {
  buildRouteStopCardData,
  formatRouteExecutionManifestText,
} from "@/lib/routeManifestFormat";
import type { RouteExecutionManifest } from "@/lib/types";

const fixtureManifest: RouteExecutionManifest = {
  corridor: {
    origin: {
      system_id: 30000142,
      system_name: "Jita",
      location_id: 60003760,
      location_name: "Jita IV - Moon 4",
    },
    stop_sequence: [
      {
        stop_key: "30000142:60003760",
        system_id: 30000142,
        system_name: "Jita",
        location_id: 60003760,
        location_name: "Jita IV - Moon 4",
      },
      {
        stop_key: "30002187:60008494",
        system_id: 30002187,
        system_name: "Amarr",
        location_id: 60008494,
        location_name: "Amarr VIII",
      },
    ],
    total_jumps: 8,
    distinct_stop_count: 2,
  },
  stops: [
    {
      stop_key: "30000142:60003760",
      system_id: 30000142,
      system_name: "Jita",
      location_id: 60003760,
      location_name: "Jita IV - Moon 4",
      jumps_from_previous: 0,
      buy_actions: [
        {
          type_id: 34,
          type_name: "Tritanium",
          units: 1000,
          unit_volume_m3: 0.01,
          volume_m3: 10,
          buy_system_id: 30000142,
          buy_location_id: 60003760,
          sell_system_id: 30002187,
          sell_location_id: 60008494,
          buy_total_isk: 8000,
          sell_total_isk: 10500,
          net_delta_isk: 2500,
        },
      ],
      sell_actions: [],
      stop_buy_total_isk: 8000,
      stop_sell_total_isk: 0,
      stop_net_delta_isk: -8000,
      cargo_used_after_m3: 10,
      cargo_remain_after_m3: 90,
      warnings: ["negative_net_delta"],
    },
    {
      stop_key: "30002187:60008494",
      system_id: 30002187,
      system_name: "Amarr",
      location_id: 60008494,
      location_name: "Amarr VIII",
      jumps_from_previous: 8,
      buy_actions: [
        {
          type_id: 34,
          type_name: "Tritanium",
          units: 500,
          unit_volume_m3: 0.01,
          volume_m3: 5,
          buy_system_id: 30002187,
          buy_location_id: 60008494,
          sell_system_id: 30000142,
          sell_location_id: 60003760,
          buy_total_isk: 5000,
          sell_total_isk: 6500,
          net_delta_isk: 1500,
        },
      ],
      sell_actions: [
        {
          type_id: 34,
          type_name: "Tritanium",
          units: 1000,
          unit_volume_m3: 0.01,
          volume_m3: 10,
          buy_system_id: 30000142,
          buy_location_id: 60003760,
          sell_system_id: 30002187,
          sell_location_id: 60008494,
          buy_total_isk: 8000,
          sell_total_isk: 10500,
          net_delta_isk: 2500,
        },
      ],
      stop_buy_total_isk: 5000,
      stop_sell_total_isk: 10500,
      stop_net_delta_isk: 5500,
      cargo_used_after_m3: 15,
      cargo_remain_after_m3: 85,
    },
  ],
  run_totals: {
    capital_isk: 13000,
    gross_sell_isk: 17000,
    net_isk: 4000,
    cargo_used_m3: 15,
    cargo_remaining_m3: 85,
  },
  validation: {
    candidate_context_seen: true,
    candidate_snapshot_rows: 12,
    included_rows: 2,
    excluded_zero_rows: 1,
  },
};

describe("routeManifestFormat", () => {
  it("builds per-stop card data with jump and warning metadata", () => {
    const card = buildRouteStopCardData(fixtureManifest.stops[0]);
    expect(card.jumpsFromPrevious).toBe(0);
    expect(card.buyTotalISK).toBe(8000);
    expect(card.sellTotalISK).toBe(0);
    expect(card.netDeltaISK).toBe(-8000);
    expect(card.warningMetadata).toEqual(["negative_net_delta"]);
  });

  it("clipboard output includes stop headings and summary fields", () => {
    const text = formatRouteExecutionManifestText(fixtureManifest);
    expect(text).toContain("=== ROUTE EXECUTION MANIFEST ===");
    expect(text).toContain("Capital: 13,000 ISK");
    expect(text).toContain("Gross sell: 17,000 ISK");
    expect(text).toContain("Net: 4,000 ISK");
    expect(text).toContain("-- Stop 1: Jita IV - Moon 4 (Jita) --");
    expect(text).toContain("-- Stop 2: Amarr VIII (Amarr) --");
  });

  it("prints repeated items separately across stops", () => {
    const text = formatRouteExecutionManifestText(fixtureManifest);
    const occurrences = text.split("Tritanium x").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  it("includes zero-row exclusion summary from validation snapshot", () => {
    const text = formatRouteExecutionManifestText(fixtureManifest);
    expect(text).toContain("excluded zero rows 1");
  });
});
