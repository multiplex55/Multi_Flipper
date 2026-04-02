import { useMemo, useState } from "react";
import type { StrategyScoreConfig } from "@/lib/types";
import {
  SCORING_PRESET_OPTIONS,
  SCORING_PRESETS,
  type ScoringPresetId,
} from "@/lib/scoringPresets";

interface Props {
  value: StrategyScoreConfig;
  onChange: (value: StrategyScoreConfig) => void;
  onPresetApply?: (preset: ScoringPresetId, value: StrategyScoreConfig) => void;
  disabled?: boolean;
  compact?: boolean;
  persistKey?: string;
}

const STORAGE_PREFIX = "eve-settings-expanded:";
const DEFAULT_PERSIST_KEY = "scoring-profile";

const sliderRows: Array<{ key: keyof StrategyScoreConfig; label: string }> = [
  { key: "profit_weight", label: "Profit" },
  { key: "risk_weight", label: "Risk" },
  { key: "velocity_weight", label: "Velocity" },
  { key: "jump_weight", label: "Jumps" },
  { key: "capital_weight", label: "Capital" },
];

export function ScoringProfileEditor({
  value,
  onChange,
  onPresetApply,
  disabled = false,
  compact = false,
  persistKey,
}: Props) {
  const storageKey = STORAGE_PREFIX + (persistKey ?? DEFAULT_PERSIST_KEY);
  const [expanded, setExpanded] = useState(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) return raw === "1";
    return true;
  });

  const total = useMemo(
    () =>
      value.profit_weight +
      value.risk_weight +
      value.velocity_weight +
      value.jump_weight +
      value.capital_weight,
    [value],
  );

  const setWeight = (key: keyof StrategyScoreConfig, next: number) => {
    onChange({ ...value, [key]: next });
  };

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  };

  const applyPreset = (presetId: ScoringPresetId) => {
    const next = SCORING_PRESETS[presetId];
    onChange(next);
    onPresetApply?.(presetId, next);
  };

  return (
    <section className="rounded-sm border border-eve-border/60 bg-gradient-to-br from-eve-panel to-eve-dark/40">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        onClick={toggleExpanded}
        disabled={disabled}
      >
        <span className="text-sm font-medium text-eve-text">
          Scoring Profile
        </span>
        <span className="text-eve-dim text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div
          className={`px-3 pb-3 border-t border-eve-border/50 ${compact ? "pt-2" : "pt-3"}`}
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {SCORING_PRESET_OPTIONS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="px-2 py-1 text-xs rounded-sm border border-eve-border text-eve-dim hover:text-eve-text hover:border-eve-border-light disabled:opacity-40"
                onClick={() => applyPreset(preset.id)}
                disabled={disabled}
              >
                {preset.label}
              </button>
            ))}
            <span
              className={`ml-auto text-[11px] ${
                total === 100 ? "text-eve-accent" : "text-eve-warn"
              }`}
            >
              Weights total: {total}%
            </span>
          </div>

          <div className="space-y-2">
            {sliderRows.map((row) => (
              <label
                key={row.key}
                className="grid grid-cols-[80px_1fr_48px] items-center gap-2 text-xs"
              >
                <span className="text-eve-dim uppercase tracking-wide">
                  {row.label}
                </span>
                <input
                  aria-label={`${row.label} weight`}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={value[row.key]}
                  onChange={(e) => setWeight(row.key, Number(e.target.value))}
                  disabled={disabled}
                />
                <span className="text-eve-text font-mono text-right">
                  {value[row.key]}%
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
