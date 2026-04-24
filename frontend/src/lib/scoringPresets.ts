import type { StrategyScoreConfig } from "@/lib/types";

export type ScoringPresetId = "conservative" | "balanced" | "aggressive";

export interface ScoringPresetOption {
  id: ScoringPresetId;
  label: string;
  value: StrategyScoreConfig;
}

export type ScoringRecipeId =
  | "fast_run"
  | "high_confidence"
  | "cargo_efficient"
  | "capital_efficient"
  | "fragile_first"
  | "backhaul_builder";

export type ScoringRecipePayload = {
  sortKey: string;
  sortDir: "asc" | "desc";
  urgencyFilter?: "all" | "stable" | "aging" | "fragile";
  filters?: Record<string, string>;
};

export const SCORING_PRESETS: Record<ScoringPresetId, StrategyScoreConfig> = {
  conservative: {
    profit_weight: 20,
    risk_weight: 40,
    velocity_weight: 15,
    jump_weight: 10,
    capital_weight: 15,
  },
  balanced: {
    profit_weight: 35,
    risk_weight: 25,
    velocity_weight: 20,
    jump_weight: 10,
    capital_weight: 10,
  },
  aggressive: {
    profit_weight: 45,
    risk_weight: 10,
    velocity_weight: 25,
    jump_weight: 10,
    capital_weight: 10,
  },
};

export const SCORING_PRESET_OPTIONS: ScoringPresetOption[] = [
  {
    id: "conservative",
    label: "Conservative",
    value: SCORING_PRESETS.conservative,
  },
  { id: "balanced", label: "Balanced", value: SCORING_PRESETS.balanced },
  { id: "aggressive", label: "Aggressive", value: SCORING_PRESETS.aggressive },
];

export const SCORING_RECIPES: Record<ScoringRecipeId, ScoringRecipePayload> = {
  fast_run: {
    sortKey: "RealIskPerJump",
    sortDir: "desc",
    urgencyFilter: "all",
    filters: {},
  },
  high_confidence: {
    sortKey: "ExecutionQuality",
    sortDir: "desc",
    urgencyFilter: "stable",
    filters: {},
  },
  cargo_efficient: {
    sortKey: "RealIskPerM3PerJump",
    sortDir: "desc",
    urgencyFilter: "all",
    filters: {},
  },
  capital_efficient: {
    sortKey: "RoutePackDailyProfitOverCapital",
    sortDir: "desc",
    urgencyFilter: "all",
    filters: {},
  },
  fragile_first: {
    sortKey: "UrgencyScore",
    sortDir: "desc",
    urgencyFilter: "fragile",
    filters: {},
  },
  backhaul_builder: {
    sortKey: "DailyIskPerJump",
    sortDir: "desc",
    urgencyFilter: "aging",
    filters: {},
  },
};

export const SCORING_RECIPE_OPTIONS: Array<{ id: ScoringRecipeId; label: string }> = [
  { id: "fast_run", label: "Fast run" },
  { id: "high_confidence", label: "High confidence" },
  { id: "cargo_efficient", label: "Cargo efficient" },
  { id: "capital_efficient", label: "Capital efficient" },
  { id: "fragile_first", label: "Fragile first" },
  { id: "backhaul_builder", label: "Backhaul builder" },
];

export const DEFAULT_STRATEGY_SCORE: StrategyScoreConfig =
  SCORING_PRESETS.balanced;
