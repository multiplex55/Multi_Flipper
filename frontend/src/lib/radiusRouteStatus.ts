import type { RouteAssignment } from "@/lib/routeAssignments";
import type { RouteQueueEntry, RouteQueueStatus } from "@/lib/routeQueue";

export type RadiusRouteStatus = RouteQueueStatus | "idle";

export type RadiusRouteExecutionBadge = {
  status: RadiusRouteStatus;
  label: string;
  tone: string;
  assignedPilotName?: string;
};

const STATUS_LABELS: Record<RadiusRouteStatus, string> = {
  idle: "unqueued",
  queued: "queued",
  assigned: "assigned",
  needs_verify: "needs verify",
  buying: "buying",
  hauling: "hauling",
  selling: "selling",
  done: "done",
  skipped: "skipped",
};

const STATUS_TONES: Record<RadiusRouteStatus, string> = {
  idle: "border-eve-border/60 text-eve-dim",
  queued: "border-indigo-400/50 text-indigo-200",
  assigned: "border-indigo-300/60 text-indigo-100",
  needs_verify: "border-amber-400/60 text-amber-200",
  buying: "border-cyan-400/60 text-cyan-200",
  hauling: "border-sky-400/60 text-sky-200",
  selling: "border-fuchsia-400/60 text-fuchsia-200",
  done: "border-emerald-400/60 text-emerald-200",
  skipped: "border-eve-border/50 text-eve-dim/80",
};

function mapAssignmentStatusToRouteStatus(assignment: RouteAssignment["status"]): RadiusRouteStatus {
  if (assignment === "done") return "done";
  if (assignment === "buying" || assignment === "hauling" || assignment === "selling") return assignment;
  return "assigned";
}

export function getRadiusRouteStatusLabel(status: RadiusRouteStatus): string {
  return STATUS_LABELS[status] ?? status.replace("_", " ");
}

export function getRadiusRouteStatusTone(status: RadiusRouteStatus): string {
  return STATUS_TONES[status] ?? STATUS_TONES.idle;
}

export function getRadiusRouteExecutionBadge(
  routeKey: string,
  queueEntries: RouteQueueEntry[],
  assignments: Record<string, RouteAssignment>,
): RadiusRouteExecutionBadge {
  const queueEntry = queueEntries.find((entry) => entry.routeKey === routeKey) ?? null;
  const assignment = assignments[routeKey] ?? null;
  const status = queueEntry?.status ?? (assignment ? mapAssignmentStatusToRouteStatus(assignment.status) : "idle");
  const assignedPilotName = queueEntry?.assignedPilot ?? assignment?.assignedCharacterName ?? undefined;
  const baseLabel = getRadiusRouteStatusLabel(status);
  return {
    status,
    tone: getRadiusRouteStatusTone(status),
    label: assignedPilotName ? `${baseLabel} · ${assignedPilotName}` : baseLabel,
    assignedPilotName,
  };
}
