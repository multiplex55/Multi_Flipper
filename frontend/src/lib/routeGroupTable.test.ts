import { describe, expect, it } from "vitest";
import {
  clampRouteGroupPage,
  filterRadiusRouteGroups,
  RADIUS_ROUTE_GROUP_COLUMNS,
  sortRadiusRouteGroups,
  type RadiusRouteGroupSort,
} from "@/lib/routeGroupTable";
import type { RadiusRouteGroupAggregate } from "@/lib/radiusRouteGroups";

function makeGroup(overrides: Partial<RadiusRouteGroupAggregate> = {}): RadiusRouteGroupAggregate {
  return {
    routeKey: "route-a",
    routeLabel: "Amarr → Jita",
    totalProfit: 1_000_000,
    totalCapital: 2_000_000,
    roiPercent: 50,
    iskPerJump: 100_000,
    jumps: 10,
    itemCount: 2,
    cargoUsedPercent: 20,
    weakestExecutionQuality: 80,
    urgencyBand: "stable",
    status: "idle",
    assignedPilot: "",
    verificationStatus: "Fresh",
    ...overrides,
  };
}

describe("routeGroupTable", () => {
  it("applies default totalProfit desc sort", () => {
    const rows = [
      makeGroup({ routeKey: "k1", totalProfit: 1_000 }),
      makeGroup({ routeKey: "k2", totalProfit: 3_000 }),
      makeGroup({ routeKey: "k3", totalProfit: 2_000 }),
    ];
    expect(sortRadiusRouteGroups(rows).map((row) => row.routeKey)).toEqual(["k2", "k3", "k1"]);
  });

  it("sorts iskPerJump asc and desc", () => {
    const rows = [
      makeGroup({ routeKey: "k1", iskPerJump: 30 }),
      makeGroup({ routeKey: "k2", iskPerJump: 10 }),
      makeGroup({ routeKey: "k3", iskPerJump: 20 }),
    ];
    const asc: RadiusRouteGroupSort = { key: "iskPerJump", direction: "asc" };
    const desc: RadiusRouteGroupSort = { key: "iskPerJump", direction: "desc" };
    expect(sortRadiusRouteGroups(rows, asc).map((row) => row.routeKey)).toEqual(["k2", "k3", "k1"]);
    expect(sortRadiusRouteGroups(rows, desc).map((row) => row.routeKey)).toEqual(["k1", "k3", "k2"]);
  });

  it("uses deterministic tie-breakers for text sorting", () => {
    const rows = [
      makeGroup({ routeKey: "b", routeLabel: "Same", assignedPilot: "Kai" }),
      makeGroup({ routeKey: "a", routeLabel: "Same", assignedPilot: "Kai" }),
      makeGroup({ routeKey: "c", routeLabel: "Alpha", assignedPilot: "Kai" }),
    ];
    expect(sortRadiusRouteGroups(rows, { key: "assignedPilot", direction: "asc" }).map((row) => row.routeKey)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("supports numeric filter grammar", () => {
    const rows = [
      makeGroup({ routeKey: "k1", totalProfit: 100 }),
      makeGroup({ routeKey: "k2", totalProfit: 200 }),
      makeGroup({ routeKey: "k3", totalProfit: 300 }),
    ];
    expect(filterRadiusRouteGroups(rows, RADIUS_ROUTE_GROUP_COLUMNS, { totalProfit: ">=200" }).map((r) => r.routeKey)).toEqual(["k2", "k3"]);
    expect(filterRadiusRouteGroups(rows, RADIUS_ROUTE_GROUP_COLUMNS, { totalProfit: "<200" }).map((r) => r.routeKey)).toEqual(["k1"]);
    expect(filterRadiusRouteGroups(rows, RADIUS_ROUTE_GROUP_COLUMNS, { totalProfit: "=200" }).map((r) => r.routeKey)).toEqual(["k2"]);
    expect(filterRadiusRouteGroups(rows, RADIUS_ROUTE_GROUP_COLUMNS, { totalProfit: "100-250" }).map((r) => r.routeKey)).toEqual(["k1", "k2"]);
    expect(filterRadiusRouteGroups(rows, RADIUS_ROUTE_GROUP_COLUMNS, { totalProfit: "250" }).map((r) => r.routeKey)).toEqual(["k3"]);
  });

  it("filters text case-insensitively", () => {
    const rows = [makeGroup({ routeKey: "k1", routeLabel: "Jita → Amarr" }), makeGroup({ routeKey: "k2", routeLabel: "Dodixie → Hek" })];
    expect(filterRadiusRouteGroups(rows, RADIUS_ROUTE_GROUP_COLUMNS, { routeLabel: "JITA" }).map((row) => row.routeKey)).toEqual(["k1"]);
  });

  it("supports filter before pagination flow", () => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      makeGroup({ routeKey: `k-${index + 1}`, routeLabel: `Route ${index + 1}`, totalProfit: index + 1 }),
    );
    const filtered = filterRadiusRouteGroups(rows, RADIUS_ROUTE_GROUP_COLUMNS, { totalProfit: ">55" });
    const sorted = sortRadiusRouteGroups(filtered, { key: "totalProfit", direction: "desc" });
    const paged = sorted.slice(0, 3);
    expect(paged.map((row) => row.totalProfit)).toEqual([60, 59, 58]);
  });

  it("clamps page after filter shrink", () => {
    expect(clampRouteGroupPage(4, 30, 25)).toBe(1);
  });
});
