import type { RadiusColumnPresetId } from "@/lib/radiusColumnPresets";

export type RadiusDecisionModeId = "scout" | "route" | "cargo" | "execute" | "audit";

export type RadiusDecisionMode = {
  id: RadiusDecisionModeId;
  label: string;
  description: string;
  preferredView: "rows" | "route" | "cargo_builds";
  sort: {
    key: string;
    dir: "asc" | "desc";
  };
  presetId: RadiusColumnPresetId;
  visibility: {
    insights: "show" | "hide";
    advanced: "show" | "hide";
    queue: "normal" | "emphasize";
    verification: "normal" | "emphasize";
  };
};

export const radiusDecisionModes: readonly RadiusDecisionMode[] = [
  {
    id: "scout",
    label: "Scout",
    description: "Triage opportunities quickly before committing route planning.",
    preferredView: "rows",
    sort: { key: "UrgencyScore", dir: "desc" },
    presetId: "scout",
    visibility: {
      insights: "show",
      advanced: "hide",
      queue: "normal",
      verification: "normal",
    },
  },
  {
    id: "route",
    label: "Route",
    description: "Optimize grouped routes with travel efficiency as the main constraint.",
    preferredView: "route",
    sort: { key: "RoutePackRealIskPerJump", dir: "desc" },
    presetId: "route",
    visibility: {
      insights: "show",
      advanced: "show",
      queue: "emphasize",
      verification: "normal",
    },
  },
  {
    id: "cargo",
    label: "Cargo",
    description: "Prioritize hold efficiency and build-ready routes for cargo constraints.",
    preferredView: "cargo_builds",
    sort: { key: "IskPerM3", dir: "desc" },
    presetId: "cargo",
    visibility: {
      insights: "show",
      advanced: "show",
      queue: "emphasize",
      verification: "normal",
    },
  },
  {
    id: "execute",
    label: "Execute",
    description: "Focus on fill certainty and verification-sensitive execution order.",
    preferredView: "rows",
    sort: { key: "ExecutionQuality", dir: "desc" },
    presetId: "execute",
    visibility: {
      insights: "hide",
      advanced: "show",
      queue: "emphasize",
      verification: "emphasize",
    },
  },
  {
    id: "audit",
    label: "Audit",
    description: "Slow down and validate resilience, turnover, and downside buffers.",
    preferredView: "rows",
    sort: { key: "TurnoverDays", dir: "asc" },
    presetId: "audit",
    visibility: {
      insights: "show",
      advanced: "show",
      queue: "normal",
      verification: "emphasize",
    },
  },
] as const;

export const radiusDecisionModeById: Record<RadiusDecisionModeId, RadiusDecisionMode> =
  Object.fromEntries(radiusDecisionModes.map((mode) => [mode.id, mode])) as Record<
    RadiusDecisionModeId,
    RadiusDecisionMode
  >;
