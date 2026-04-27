import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import { buildRadiusContextMenuItems } from "@/lib/radiusContextMenuItems";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 77,
    TypeName: "Nanite Repair Paste",
    BuyStation: "Jita",
    SellStation: "Amarr",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellSystemID: 30002187,
    BuyLocationID: 60003760,
    SellLocationID: 60008494,
    BuyRegionID: 10000002,
    SellRegionID: 10000043,
    UnitsToBuy: 100,
    ...overrides,
  } as FlipResult;
}

describe("buildRadiusContextMenuItems", () => {
  it("hides login-gated actions when logged out", () => {
    const items = buildRadiusContextMenuItems({
      surface: "radius_table",
      row: makeRow(),
      isLoggedIn: false,
      isTracked: false,
      isPinned: false,
      hasLegLocks: false,
      canQueueRoute: false,
      canAssignRoute: false,
      canVerifyRoute: false,
    });

    expect(items.find((item) => item.action === "open_market")?.visible).toBe(false);
    expect(items.find((item) => item.action === "set_destination_buy")?.visible).toBe(false);
  });

  it("switches hide/unhide actions based on hidden entry", () => {
    const visibleItems = buildRadiusContextMenuItems({
      surface: "radius_table",
      row: makeRow(),
      isLoggedIn: true,
      isTracked: false,
      isPinned: false,
      hasLegLocks: false,
      canQueueRoute: false,
      canAssignRoute: false,
      canVerifyRoute: false,
    });
    expect(visibleItems.find((item) => item.action === "hide_done")?.visible).toBe(true);
    expect(visibleItems.find((item) => item.action === "unhide")?.visible).toBe(false);

    const hiddenItems = buildRadiusContextMenuItems({
      surface: "radius_table",
      row: makeRow(),
      isLoggedIn: true,
      isTracked: false,
      isPinned: false,
      hiddenEntryKey: "abc",
      hasLegLocks: false,
      canQueueRoute: false,
      canAssignRoute: false,
      canVerifyRoute: false,
    });
    expect(hiddenItems.find((item) => item.action === "hide_done")?.visible).toBe(false);
    expect(hiddenItems.find((item) => item.action === "unhide")?.visible).toBe(true);
  });

  it("suppresses station actions for invalid station IDs", () => {
    const items = buildRadiusContextMenuItems({
      surface: "radius_table",
      row: makeRow({ BuyLocationID: 0, SellLocationID: 0 }),
      isLoggedIn: true,
      isTracked: false,
      isPinned: false,
      hasLegLocks: false,
      canQueueRoute: false,
      canAssignRoute: false,
      canVerifyRoute: false,
    });

    expect(items.find((item) => item.action === "ignore_buy_station")?.visible).toBe(false);
    expect(items.find((item) => item.action === "ignore_sell_station")?.visible).toBe(false);
    expect(items.find((item) => item.action === "deprioritize_station")?.visible).toBe(false);
  });

  it("enables route actions only when callbacks are available", () => {
    const items = buildRadiusContextMenuItems({
      surface: "radius_route",
      row: makeRow(),
      isLoggedIn: true,
      isTracked: false,
      isPinned: false,
      hasLegLocks: false,
      canQueueRoute: true,
      canAssignRoute: true,
      canVerifyRoute: true,
    });

    expect(items.find((item) => item.action === "queue_route")?.enabled).toBe(true);
    expect(items.find((item) => item.action === "assign_route")?.enabled).toBe(true);
    expect(items.find((item) => item.action === "verify_route")?.enabled).toBe(true);
  });
});
