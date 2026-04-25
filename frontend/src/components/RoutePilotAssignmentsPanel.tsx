import { useEffect, useMemo, useState } from "react";
import { getCharacterLocation } from "@/lib/api";
import type { AuthCharacter } from "@/lib/types";
import {
  getRouteAssignment,
  removeRouteAssignment,
  type RouteAssignment,
  type RouteAssignmentStatus,
  updateRouteAssignment,
  upsertRouteAssignment,
  VALID_STATUSES,
} from "@/lib/routeAssignments";
import { recommendBestPilotForRoute } from "@/lib/routePilotRecommendation";

export interface RoutePilotAssignmentEndpoints {
  buySystemName?: string;
  sellSystemName?: string;
  candidateDistancesByCharacterId?: Record<
    number,
    { jumpsToBuy?: number | null; totalRunJumps?: number | null }
  >;
}

interface RoutePilotAssignmentsPanelProps {
  routeKey: string;
  routeLabel?: string;
  characters?: AuthCharacter[];
  characterLocations?: Record<number, string>;
  routeEndpoints?: RoutePilotAssignmentEndpoints;
  onAssignmentChange?: (assignment: RouteAssignment | null) => void;
  onRecalculateLensFromCharacter?: (characterId: number) => void;
}

export function RoutePilotAssignmentsPanel({
  routeKey,
  routeLabel,
  characters = [],
  characterLocations = {},
  routeEndpoints,
  onAssignmentChange,
  onRecalculateLensFromCharacter,
}: RoutePilotAssignmentsPanelProps) {
  const [assignment, setAssignment] = useState<RouteAssignment | null>(
    () => getRouteAssignment(routeKey),
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(
    assignment?.assignedCharacterId ? String(assignment.assignedCharacterId) : "",
  );
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [recalcLensOnRecommend, setRecalcLensOnRecommend] = useState(false);

  const selectedCharacter = useMemo(
    () =>
      characters.find(
        (character) => String(character.character_id) === selectedCharacterId,
      ) ?? null,
    [characters, selectedCharacterId],
  );

  useEffect(() => {
    const next = getRouteAssignment(routeKey);
    setAssignment(next);
    setSelectedCharacterId(next?.assignedCharacterId ? String(next.assignedCharacterId) : "");
  }, [routeKey]);

  const refreshLocation = async () => {
    if (!assignment?.assignedCharacterId) return;
    try {
      const location = await getCharacterLocation(assignment.assignedCharacterId);
      const display = [location.solar_system_name, location.station_name]
        .filter(Boolean)
        .join(" · ");
      setLocationLabel(display);
      patchAssignment({
        assignedCharacterSystemId: location.solar_system_id,
        assignedCharacterSystemName: location.solar_system_name,
        currentSystem: location.solar_system_name,
      });
    } catch {
      setLocationLabel("");
    }
  };

  useEffect(() => {
    if (!assignment?.assignedCharacterId) {
      setLocationLabel("");
      return;
    }
    void refreshLocation();
  }, [assignment?.assignedCharacterId]);

  const saveAssignment = () => {
    if (!selectedCharacter) return;
    const nextList = upsertRouteAssignment({
      routeKey,
      assignedCharacterName: selectedCharacter.character_name,
      assignedCharacterId: selectedCharacter.character_id,
      status: assignment?.status ?? "queued",
      assignedCharacterSystemId: assignment?.assignedCharacterSystemId,
      assignedCharacterSystemName: assignment?.assignedCharacterSystemName,
      currentSystem: assignment?.currentSystem,
      stagedSystem: assignment?.stagedSystem,
      notes: assignment?.notes,
    });
    const next = nextList.find((entry) => entry.routeKey === routeKey) ?? null;
    setAssignment(next);
    onAssignmentChange?.(next);
  };

  const patchAssignment = (
    patch: Partial<Omit<RouteAssignment, "routeKey" | "updatedAt">>,
  ) => {
    if (!assignment) return;
    const next =
      updateRouteAssignment(routeKey, patch).find(
        (entry) => entry.routeKey === routeKey,
      ) ?? null;
    setAssignment(next);
    onAssignmentChange?.(next);
  };

  const applyRecommendation = () => {
    const recommendation = recommendBestPilotForRoute(
      characters.map((character) => ({
        characterId: character.character_id,
        characterName: character.character_name,
        jumpsToBuy:
          routeEndpoints?.candidateDistancesByCharacterId?.[character.character_id]
            ?.jumpsToBuy ?? null,
        totalRunJumps:
          routeEndpoints?.candidateDistancesByCharacterId?.[character.character_id]
            ?.totalRunJumps ?? null,
      })),
    );
    if (!recommendation.bestCandidate) return;
    setSelectedCharacterId(String(recommendation.bestCandidate.characterId));

    const character = characters.find(
      (entry) => entry.character_id === recommendation.bestCandidate?.characterId,
    );
    if (!character) return;
    const nextList = upsertRouteAssignment({
      routeKey,
      assignedCharacterName: character.character_name,
      assignedCharacterId: character.character_id,
      status: assignment?.status ?? "queued",
      currentSystem: assignment?.currentSystem,
      stagedSystem: assignment?.stagedSystem,
      notes: assignment?.notes,
    });
    const next = nextList.find((entry) => entry.routeKey === routeKey) ?? null;
    setAssignment(next);
    onAssignmentChange?.(next);
    if (recalcLensOnRecommend) {
      onRecalculateLensFromCharacter?.(character.character_id);
    }
  };

  return (
    <section className="rounded-sm border border-eve-border/50 bg-eve-dark/30 p-2 text-[11px]" data-testid={`route-pilot-assignments:${routeKey}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-eve-dim uppercase tracking-wide">Pilot assignment</span>
        {routeLabel && <span className="text-eve-dim">{routeLabel}</span>}
        {routeEndpoints?.buySystemName && routeEndpoints?.sellSystemName && (
          <span className="text-eve-dim">{routeEndpoints.buySystemName} → {routeEndpoints.sellSystemName}</span>
        )}
        {assignment?.updatedAt && (
          <span className="text-eve-dim">Updated {new Date(assignment.updatedAt).toLocaleString()}</span>
        )}
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <select
          value={selectedCharacterId}
          onChange={(event) => setSelectedCharacterId(event.target.value)}
          className="rounded-sm border border-eve-border/60 bg-eve-dark px-1.5 py-0.5"
          aria-label="Assigned character"
        >
          <option value="">Select character</option>
          {characters.map((character) => (
            <option key={character.character_id} value={String(character.character_id)}>
              {character.character_name}
              {characterLocations[character.character_id]
                ? ` · ${characterLocations[character.character_id]}`
                : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={saveAssignment}
          className="rounded-sm border border-eve-border/60 px-1.5 py-0.5"
          disabled={!selectedCharacter}
        >
          Assign
        </button>
        <button
          type="button"
          onClick={applyRecommendation}
          className="rounded-sm border border-indigo-500/60 px-1.5 py-0.5 text-indigo-200"
          disabled={characters.length === 0}
        >
          Recommend
        </button>
        <label className="flex items-center gap-1 text-eve-dim">
          <input
            type="checkbox"
            checked={recalcLensOnRecommend}
            onChange={(event) => setRecalcLensOnRecommend(event.target.checked)}
          />
          Recalc lens
        </label>
        <button
          type="button"
          onClick={() => {
            removeRouteAssignment(routeKey);
            setAssignment(null);
            setSelectedCharacterId("");
            onAssignmentChange?.(null);
          }}
          className="rounded-sm border border-rose-500/50 px-1.5 py-0.5 text-rose-200"
          disabled={!assignment}
        >
          Unassign
        </button>

        <select
          value={assignment?.status ?? "queued"}
          onChange={(event) =>
            patchAssignment({ status: event.target.value as RouteAssignmentStatus })
          }
          className="rounded-sm border border-eve-border/60 bg-eve-dark px-1.5 py-0.5 capitalize"
          aria-label="Assignment status"
          disabled={!assignment}
        >
          {VALID_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void refreshLocation()}
          className="rounded-sm border border-cyan-500/60 px-1.5 py-0.5 text-cyan-200"
          disabled={!assignment?.assignedCharacterId}
        >
          Refresh location
        </button>
        {assignment?.status && (
          <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 capitalize" data-testid="route-assignment-status-chip">
            {assignment.status}
          </span>
        )}
      </div>

      {assignment && (
        <div className="grid gap-1 sm:grid-cols-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-eve-dim">Current system</span>
            <input
              value={assignment.currentSystem ?? ""}
              onChange={(event) => patchAssignment({ currentSystem: event.target.value })}
              className="rounded-sm border border-eve-border/60 bg-eve-dark px-1.5 py-0.5"
              aria-label="Current system"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-eve-dim">Staged system</span>
            <input
              value={assignment.stagedSystem ?? ""}
              onChange={(event) => patchAssignment({ stagedSystem: event.target.value })}
              className="rounded-sm border border-eve-border/60 bg-eve-dark px-1.5 py-0.5"
              aria-label="Staged system"
            />
          </label>
          <label className="sm:col-span-2 flex flex-col gap-0.5">
            <span className="text-eve-dim">Notes</span>
            <textarea
              value={assignment.notes ?? ""}
              onChange={(event) => patchAssignment({ notes: event.target.value })}
              className="rounded-sm border border-eve-border/60 bg-eve-dark px-1.5 py-0.5 min-h-16"
              aria-label="Assignment notes"
            />
          </label>
          {locationLabel && (
            <div className="sm:col-span-2 text-eve-dim">
              Location: <span className="text-eve-text">{locationLabel}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
