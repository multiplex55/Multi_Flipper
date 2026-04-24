import { useEffect, useMemo, useState } from "react";
import { getCharacterLocation } from "@/lib/api";
import {
  getRouteAssignment,
  listAssignedPilots,
  removeRouteAssignment,
  type RouteAssignment,
  type RouteAssignmentStatus,
  updateRouteAssignment,
  upsertRouteAssignment,
  VALID_STATUSES,
} from "@/lib/routeAssignments";

interface RoutePilotAssignmentsPanelProps {
  routeKey: string;
  routeLabel?: string;
  onAssignmentChange?: (assignment: RouteAssignment | null) => void;
}

export function RoutePilotAssignmentsPanel({
  routeKey,
  routeLabel,
  onAssignmentChange,
}: RoutePilotAssignmentsPanelProps) {
  const [assignment, setAssignment] = useState<RouteAssignment | null>(
    () => getRouteAssignment(routeKey),
  );
  const [pilotInput, setPilotInput] = useState(assignment?.assignedCharacter ?? "");
  const [locationLabel, setLocationLabel] = useState<string>("");

  useEffect(() => {
    const next = getRouteAssignment(routeKey);
    setAssignment(next);
    setPilotInput(next?.assignedCharacter ?? "");
  }, [routeKey]);

  useEffect(() => {
    let isMounted = true;
    if (!assignment?.assignedCharacter) {
      setLocationLabel("");
      return;
    }
    if (typeof getCharacterLocation !== "function") {
      return;
    }
    getCharacterLocation()
      .then((location) => {
        if (!isMounted || !location) return;
        const display = [location.system_name, location.station_name]
          .filter(Boolean)
          .join(" · ");
        setLocationLabel(display);
      })
      .catch(() => {
        if (isMounted) setLocationLabel("");
      });
    return () => {
      isMounted = false;
    };
  }, [assignment?.assignedCharacter]);

  const pilots = useMemo(() => listAssignedPilots(), [assignment?.updatedAt]);

  const saveAssignment = (nextPilot: string) => {
    const pilot = nextPilot.trim();
    if (!pilot) return;
    const nextList = upsertRouteAssignment({
      routeKey,
      assignedCharacter: pilot,
      status: assignment?.status ?? "queued",
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
    const next = updateRouteAssignment(routeKey, patch).find(
      (entry) => entry.routeKey === routeKey,
    ) ?? null;
    setAssignment(next);
    onAssignmentChange?.(next);
  };

  return (
    <section className="rounded-sm border border-eve-border/50 bg-eve-dark/30 p-2 text-[11px]" data-testid={`route-pilot-assignments:${routeKey}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-eve-dim uppercase tracking-wide">Pilot assignment</span>
        {routeLabel && <span className="text-eve-dim">{routeLabel}</span>}
        {assignment?.updatedAt && (
          <span className="text-eve-dim">Updated {new Date(assignment.updatedAt).toLocaleString()}</span>
        )}
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <input
          value={pilotInput}
          onChange={(event) => setPilotInput(event.target.value)}
          list={`route-pilot-list:${routeKey}`}
          placeholder="Pilot name"
          className="rounded-sm border border-eve-border/60 bg-eve-dark px-1.5 py-0.5"
          aria-label="Assigned pilot"
        />
        <datalist id={`route-pilot-list:${routeKey}`}>
          {pilots.map((pilot) => (
            <option key={pilot} value={pilot} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={() => saveAssignment(pilotInput)}
          className="rounded-sm border border-eve-border/60 px-1.5 py-0.5"
        >
          Assign
        </button>
        <button
          type="button"
          onClick={() => {
            removeRouteAssignment(routeKey);
            setAssignment(null);
            setPilotInput("");
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
