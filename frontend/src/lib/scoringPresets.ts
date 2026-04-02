import type { StrategyScoreConfig } from "@/lib/types";

export type ScoringPresetId = "conservative" | "balanced" | "aggressive";

export interface ScoringPresetOption {
  id: ScoringPresetId;
  label: string;
  value: StrategyScoreConfig;
}

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

export const DEFAULT_STRATEGY_SCORE: StrategyScoreConfig =
  SCORING_PRESETS.balanced;
