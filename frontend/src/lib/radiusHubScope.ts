import type { FlipResult } from "@/lib/types";

export type HubScopeMode = "session" | "visible";

export const HUB_SCOPE_MODES: HubScopeMode[] = ["session", "visible"];

export const DEFAULT_HUB_SCOPE_MODE: HubScopeMode = "visible";

export type RadiusHubScopeRows = Record<HubScopeMode, FlipResult[]>;

export function rowsForHubScope(
  rowsByScope: RadiusHubScopeRows,
  mode: HubScopeMode,
): FlipResult[] {
  return rowsByScope[mode] ?? [];
}
