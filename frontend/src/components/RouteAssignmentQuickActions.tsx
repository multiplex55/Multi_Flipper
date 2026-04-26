import { useState } from "react";
import type { AuthCharacter } from "@/lib/types";

export interface RouteAssignmentActionContext {
  routeKey: string;
  routeLabel?: string;
  buySystemName?: string;
  sellSystemName?: string;
  expectedProfitIsk?: number;
  expectedCapitalIsk?: number;
  expectedCargoM3?: number;
  expectedJumps?: number;
  verificationStatusAtAssignment?: "Good" | "Reduced edge" | "Abort";
}

interface RouteAssignmentQuickActionsProps {
  context: RouteAssignmentActionContext;
  characters?: AuthCharacter[];
  onAssignActive?: (context: RouteAssignmentActionContext) => void;
  onAssignBest?: (context: RouteAssignmentActionContext) => void;
  onAssignSpecificPilot?: (context: RouteAssignmentActionContext, characterId: number) => void;
  onSetStagedSystem?: (context: RouteAssignmentActionContext, stagedSystem: string) => void;
  compact?: boolean;
}

export function RouteAssignmentQuickActions({
  context,
  characters = [],
  onAssignActive,
  onAssignBest,
  onAssignSpecificPilot,
  onSetStagedSystem,
  compact = false,
}: RouteAssignmentQuickActionsProps) {
  const [selectedPilot, setSelectedPilot] = useState("");
  const [stagedSystem, setStagedSystem] = useState("");

  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5" onClick={() => onAssignActive?.(context)}>
        Assign active
      </button>
      <button type="button" className="rounded-sm border border-indigo-400/60 px-1.5 py-0.5 text-indigo-200" onClick={() => onAssignBest?.(context)}>
        Assign best
      </button>
      <select
        aria-label={`Assign specific pilot ${context.routeKey}`}
        value={selectedPilot}
        onChange={(event) => {
          setSelectedPilot(event.target.value);
          const pilotId = Number(event.target.value);
          if (Number.isFinite(pilotId) && pilotId > 0) {
            onAssignSpecificPilot?.(context, pilotId);
          }
        }}
        className="rounded-sm border border-eve-border/60 bg-eve-dark px-1.5 py-0.5"
      >
        <option value="">Assign pilot…</option>
        {characters.map((character) => (
          <option key={character.character_id} value={String(character.character_id)}>
            {character.character_name}
          </option>
        ))}
      </select>
      <input
        aria-label={`Set staged system ${context.routeKey}`}
        value={stagedSystem}
        onChange={(event) => setStagedSystem(event.target.value)}
        placeholder="Stage system"
        className="w-28 rounded-sm border border-eve-border/60 bg-eve-dark px-1.5 py-0.5"
      />
      <button
        type="button"
        className="rounded-sm border border-cyan-500/60 px-1.5 py-0.5 text-cyan-200"
        onClick={() => {
          const value = stagedSystem.trim();
          if (!value) return;
          onSetStagedSystem?.(context, value);
        }}
      >
        Set staged
      </button>
    </div>
  );
}
