import { routeGroupKey } from "@/lib/batchMetrics";
import type { FlipResult } from "@/lib/types";

export type RadiusContextMenuAction =
  | "copy_item"
  | "copy_buy_station"
  | "copy_sell_station"
  | "copy_trade_route"
  | "build_batch"
  | "fill_cargo"
  | "filter_leg"
  | "lock_buy"
  | "lock_sell"
  | "clear_locks"
  | "copy_system_autopilot"
  | "ignore_buy_station"
  | "ignore_sell_station"
  | "deprioritize_station"
  | "clear_station_filters"
  | "queue_route"
  | "assign_route"
  | "assign_route_active"
  | "assign_route_best"
  | "verify_route"
  | "compare_route"
  | "place_draft"
  | "open_everef"
  | "open_jita_space"
  | "watchlist_toggle"
  | "hide_done"
  | "hide_ignored"
  | "unhide"
  | "open_market"
  | "set_destination_buy"
  | "set_destination_sell"
  | "pin_toggle"
  | "save_pattern_item"
  | "save_pattern_buy_station"
  | "save_pattern_sell_station"
  | "save_pattern_route"
  | "apply_saved_pattern";

export type RadiusContextMenuSection =
  | "copy"
  | "route_workflow"
  | "cargo"
  | "lens"
  | "filtering"
  | "verification"
  | "external_tools"
  | "tracking"
  | "hidden"
  | "eve_ui"
  | "pinning"
  | "saved_patterns";

export type RadiusContextMenuItem = {
  action: RadiusContextMenuAction;
  section: RadiusContextMenuSection;
  label: string;
  enabled: boolean;
  visible?: boolean;
  danger?: boolean;
  accent?: boolean;
  routeKey?: string;
};

export type BuildRadiusContextMenuInput = {
  row: FlipResult;
  isLoggedIn: boolean;
  isTracked: boolean;
  isPinned: boolean;
  hiddenEntryKey?: string;
  hasLegLocks: boolean;
  canQueueRoute: boolean;
  canAssignRoute: boolean;
  canVerifyRoute: boolean;
};

function hasPositiveInt(value: number | null | undefined): boolean {
  return Math.trunc(value ?? 0) > 0;
}

export function buildRadiusContextMenuItems(
  input: BuildRadiusContextMenuInput,
): RadiusContextMenuItem[] {
  const { row } = input;
  const buyLocationID = Math.trunc(row.BuyLocationID ?? 0);
  const sellLocationID = Math.trunc(row.SellLocationID ?? 0);
  const routeKey = routeGroupKey(row);
  const hasRouteKey = routeKey.length > 0;
  const hasValidTypeID = hasPositiveInt(row.TypeID);
  const canOpenDraft = row.BuyRegionID != null || row.SellRegionID != null;
  const buySystemID = Math.trunc(row.BuySystemID ?? 0);
  const sellSystemID = Math.trunc(row.SellSystemID ?? 0);

  const items: RadiusContextMenuItem[] = [
    { action: "copy_item", section: "copy", label: "Copy item", enabled: true },
    { action: "copy_buy_station", section: "copy", label: "Copy buy station", enabled: true },
    { action: "copy_sell_station", section: "copy", label: "Copy sell station", enabled: true },
    { action: "copy_trade_route", section: "copy", label: "Copy trade route", enabled: true },

    { action: "build_batch", section: "cargo", label: "Build batch", enabled: true, accent: true },
    { action: "fill_cargo", section: "cargo", label: "Fill Cargo", enabled: true },

    { action: "queue_route", section: "route_workflow", label: "Queue route", enabled: input.canQueueRoute && hasRouteKey, visible: input.canQueueRoute },
    { action: "assign_route", section: "route_workflow", label: "Assign route", enabled: input.canAssignRoute && hasRouteKey, visible: input.canAssignRoute },
    { action: "assign_route_active", section: "route_workflow", label: "Assign active pilot", enabled: input.canAssignRoute && hasRouteKey, visible: input.canAssignRoute },
    { action: "assign_route_best", section: "route_workflow", label: "Assign best pilot", enabled: input.canAssignRoute && hasRouteKey, visible: input.canAssignRoute },

    { action: "filter_leg", section: "lens", label: "Filter to this leg", enabled: buyLocationID > 0 && sellLocationID > 0 },
    { action: "lock_buy", section: "lens", label: "Lock this buy", enabled: buyLocationID > 0 },
    { action: "lock_sell", section: "lens", label: "Lock this sell", enabled: sellLocationID > 0 },
    { action: "clear_locks", section: "lens", label: "Clear locks", enabled: input.hasLegLocks, visible: input.hasLegLocks, danger: true },

    { action: "copy_system_autopilot", section: "filtering", label: "Copy system for autopilot", enabled: true },
    { action: "ignore_buy_station", section: "filtering", label: "Ignore this buy station (session)", enabled: buyLocationID > 0, visible: buyLocationID > 0 },
    { action: "ignore_sell_station", section: "filtering", label: "Ignore this sell station (session)", enabled: sellLocationID > 0, visible: sellLocationID > 0 },
    { action: "deprioritize_station", section: "filtering", label: "Deprioritize this station", enabled: buyLocationID > 0 || sellLocationID > 0, visible: buyLocationID > 0 || sellLocationID > 0 },
    { action: "clear_station_filters", section: "filtering", label: "Clear all temporary station filters", enabled: true, danger: true },

    { action: "verify_route", section: "verification", label: "Verify now", enabled: input.canVerifyRoute && hasRouteKey, visible: input.canVerifyRoute },
    { action: "compare_route", section: "verification", label: "Add route to compare", enabled: hasRouteKey, visible: hasRouteKey },
    { action: "place_draft", section: "verification", label: "Place draft", enabled: canOpenDraft, visible: canOpenDraft },

    { action: "open_everef", section: "external_tools", label: "Open in EVE Ref", enabled: hasValidTypeID },
    { action: "open_jita_space", section: "external_tools", label: "Open in jita.space", enabled: hasValidTypeID },

    {
      action: "watchlist_toggle",
      section: "tracking",
      label: input.isTracked ? "Untrack item" : "⭐ Track item",
      enabled: hasValidTypeID,
      accent: !input.isTracked,
    },

    {
      action: "unhide",
      section: "hidden",
      label: "Unhide row",
      enabled: Boolean(input.hiddenEntryKey),
      visible: Boolean(input.hiddenEntryKey),
    },
    {
      action: "hide_done",
      section: "hidden",
      label: "Mark done",
      enabled: !input.hiddenEntryKey,
      visible: !input.hiddenEntryKey,
    },
    {
      action: "hide_ignored",
      section: "hidden",
      label: "Ignore row",
      enabled: !input.hiddenEntryKey,
      visible: !input.hiddenEntryKey,
      danger: true,
    },

    {
      action: "open_market",
      section: "eve_ui",
      label: "🎮 Open market",
      enabled: input.isLoggedIn && hasValidTypeID,
      visible: input.isLoggedIn,
    },
    {
      action: "set_destination_buy",
      section: "eve_ui",
      label: "🎯 Set destination (Buy)",
      enabled: input.isLoggedIn && hasPositiveInt(buySystemID),
      visible: input.isLoggedIn,
    },
    {
      action: "set_destination_sell",
      section: "eve_ui",
      label: "🎯 Set destination (Sell)",
      enabled: input.isLoggedIn && hasPositiveInt(sellSystemID) && sellSystemID !== buySystemID,
      visible: input.isLoggedIn && sellSystemID !== buySystemID,
    },

    {
      action: "pin_toggle",
      section: "pinning",
      label: input.isPinned ? "Unpin row" : "Pin row",
      enabled: true,
    },

    { action: "save_pattern_item", section: "saved_patterns", label: "Save item pattern", enabled: hasValidTypeID },
    { action: "save_pattern_buy_station", section: "saved_patterns", label: "Save buy station pattern", enabled: buyLocationID > 0 || String(row.BuyStation ?? "").length > 0 },
    { action: "save_pattern_sell_station", section: "saved_patterns", label: "Save sell station pattern", enabled: sellLocationID > 0 || String(row.SellStation ?? "").length > 0 },
    { action: "save_pattern_route", section: "saved_patterns", label: "Save route pattern", enabled: (buyLocationID > 0 || sellLocationID > 0) && hasValidTypeID },
    { action: "apply_saved_pattern", section: "saved_patterns", label: "Apply saved pattern", enabled: true },

  ];
  return items.map((item) => ({ ...item, routeKey: hasRouteKey ? routeKey : undefined }));
}
