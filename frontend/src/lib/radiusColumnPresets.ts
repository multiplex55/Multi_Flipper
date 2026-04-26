import { assertKnownRadiusColumnKeys } from "@/lib/radiusColumnRegistry";

export type RadiusColumnPresetId =
  | "scout"
  | "route"
  | "cargo"
  | "execute"
  | "audit";

export type RadiusColumnPreset = {
  id: RadiusColumnPresetId;
  label: string;
  description: string;
  columns: readonly string[];
  defaultSort: {
    key: string;
    dir: "asc" | "desc";
  };
};

export const radiusColumnPresets: readonly RadiusColumnPreset[] = [
  {
    id: "scout",
    label: "Scout",
    description: "Fast triage of opportunities by urgency, score, and execution confidence.",
    columns: [
      "UrgencyScore",
      "OpportunityScore",
      "MarginPercent",
      "ExecutionQuality",
      "RouteSafety",
      "S2BPerDay",
      "TurnoverDays",
    ],
    defaultSort: { key: "UrgencyScore", dir: "desc" },
  },
  {
    id: "route",
    label: "Route",
    description: "Route-pack level travel efficiency and risk-adjusted pathing.",
    columns: [
      "RoutePackTotalProfit",
      "RoutePackRealIskPerJump",
      "RoutePackWeakestExecutionQuality",
      "RoutePackTurnoverDays",
      "RoutePackBreakevenBuffer",
      "RouteSafety",
    ],
    defaultSort: { key: "RoutePackRealIskPerJump", dir: "desc" },
  },
  {
    id: "cargo",
    label: "Cargo",
    description: "Cargo efficiency and depth-aware sizing when hold space is constrained.",
    columns: [
      "IskPerM3",
      "RealIskPerM3PerJump",
      "UnitsToBuy",
      "FilledQty",
      "CanFill",
      "BuyOrderRemain",
      "SlippageCostIsk",
      "TrapRisk",
    ],
    defaultSort: { key: "IskPerM3", dir: "desc" },
  },
  {
    id: "execute",
    label: "Execute",
    description: "Immediate execution prioritization with verification and fill realism.",
    columns: [
      "UrgencyScore",
      "ExecutionQuality",
      "TrapRisk",
      "ExpectedBuyPrice",
      "ExpectedSellPrice",
      "FilledQty",
      "CanFill",
      "BuyOrderRemain",
    ],
    defaultSort: { key: "ExecutionQuality", dir: "desc" },
  },
  {
    id: "audit",
    label: "Audit",
    description: "Post-pass risk and resilience review for slower, safer capital recycling.",
    columns: [
      "TurnoverDays",
      "BreakevenBuffer",
      "ExitOverhangDays",
      "SlippageCostIsk",
      "TrapRisk",
      "ExecutionQuality",
      "S2BBfSRatio",
      "OpportunityScore",
    ],
    defaultSort: { key: "TurnoverDays", dir: "asc" },
  },
] as const;

for (const preset of radiusColumnPresets) {
  assertKnownRadiusColumnKeys(preset.columns, `radiusColumnPresets:${preset.id}`);
  assertKnownRadiusColumnKeys([preset.defaultSort.key], `radiusColumnPresets:${preset.id}:defaultSort`);
}

export const radiusColumnPresetById: Record<RadiusColumnPresetId, RadiusColumnPreset> =
  Object.fromEntries(radiusColumnPresets.map((preset) => [preset.id, preset])) as Record<
    RadiusColumnPresetId,
    RadiusColumnPreset
  >;
