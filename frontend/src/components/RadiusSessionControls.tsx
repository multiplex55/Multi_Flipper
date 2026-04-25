import type { ReactNode } from "react";

type LensSource =
  | "scan_origin"
  | "active_character"
  | "selected_character"
  | "manual_system";

type RadiusSessionControlsProps = {
  autoRefreshRadius: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
  radiusHubFilterLabel?: ReactNode;
  onClearHubFilter?: () => void;
  radiusLensSource: LensSource;
  onLensSourceChange: (next: LensSource) => void;
  radiusLensSelectedCharacterID: number;
  onLensSelectedCharacterChange: (characterID: number) => void;
  authCharacters: Array<{ character_id: number; character_name: string }>;
  radiusLensManualSystem: string;
  onLensManualSystemChange: (systemName: string) => void;
  onRecalculateLens: () => void;
  radiusLensRecalculating: boolean;
  recalcDisabled: boolean;
  onClearLens: () => void;
  radiusDistanceLensLabel?: ReactNode;
  onResetSession: () => void;
};

export function RadiusSessionControls({
  autoRefreshRadius,
  onAutoRefreshChange,
  radiusHubFilterLabel,
  onClearHubFilter,
  radiusLensSource,
  onLensSourceChange,
  radiusLensSelectedCharacterID,
  onLensSelectedCharacterChange,
  authCharacters,
  radiusLensManualSystem,
  onLensManualSystemChange,
  onRecalculateLens,
  radiusLensRecalculating,
  recalcDisabled,
  onClearLens,
  radiusDistanceLensLabel,
  onResetSession,
}: RadiusSessionControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-eve-dim hover:text-eve-text transition-colors">
        <input
          type="checkbox"
          checked={autoRefreshRadius}
          onChange={(event) => onAutoRefreshChange(event.target.checked)}
          className="accent-eve-accent"
        />
        Auto-refresh
      </label>
      {autoRefreshRadius ? (
        <span className="flex items-center gap-1 text-eve-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-eve-accent animate-pulse" />
          active
        </span>
      ) : null}
      {radiusHubFilterLabel && onClearHubFilter ? (
        <button
          type="button"
          className="px-2 py-0.5 rounded-sm border border-eve-border text-eve-dim hover:text-eve-text"
          onClick={onClearHubFilter}
        >
          {radiusHubFilterLabel}
        </button>
      ) : null}
      <select
        value={radiusLensSource}
        onChange={(event) => onLensSourceChange(event.target.value as LensSource)}
        className="px-1.5 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark text-eve-text"
      >
        <option value="scan_origin">Scan origin</option>
        <option value="active_character">Active character</option>
        <option value="selected_character">Selected character</option>
        <option value="manual_system">Manual system</option>
      </select>
      {radiusLensSource === "selected_character" ? (
        <select
          value={radiusLensSelectedCharacterID}
          onChange={(event) => onLensSelectedCharacterChange(Number(event.target.value))}
          className="px-1.5 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark text-eve-text"
        >
          <option value={0}>Pick character</option>
          {authCharacters.map((character) => (
            <option key={character.character_id} value={character.character_id}>
              {character.character_name}
            </option>
          ))}
        </select>
      ) : null}
      {radiusLensSource === "manual_system" ? (
        <input
          value={radiusLensManualSystem}
          onChange={(event) => onLensManualSystemChange(event.target.value)}
          placeholder="Manual system"
          className="px-1.5 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark text-eve-text"
        />
      ) : null}
      <button
        type="button"
        onClick={onRecalculateLens}
        disabled={radiusLensRecalculating || recalcDisabled}
        className="px-2 py-0.5 rounded-sm border border-eve-border text-eve-dim hover:text-eve-text disabled:opacity-50"
      >
        {radiusLensRecalculating ? "Recalc…" : "Recalc"}
      </button>
      <button
        type="button"
        onClick={onClearLens}
        className="px-2 py-0.5 rounded-sm border border-eve-border text-eve-dim hover:text-eve-text"
      >
        Clear
      </button>
      {radiusDistanceLensLabel ? (
        <span className="px-1.5 py-0.5 rounded-sm border border-eve-accent/40 text-eve-accent">
          {radiusDistanceLensLabel}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onResetSession}
        className="px-2 py-0.5 rounded-sm border border-eve-border/60 text-eve-dim hover:text-eve-text hover:border-eve-border-light transition-colors"
      >
        Reset session
      </button>
    </div>
  );
}
