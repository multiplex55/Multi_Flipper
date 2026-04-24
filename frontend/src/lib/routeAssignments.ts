export type RouteAssignmentStatus =
  | "queued"
  | "buying"
  | "hauling"
  | "selling"
  | "done";

export interface RouteAssignment {
  routeKey: string;
  assignedCharacter: string;
  status: RouteAssignmentStatus;
  currentSystem?: string;
  stagedSystem?: string;
  notes?: string;
  updatedAt: string;
}

const ROUTE_ASSIGNMENTS_STORAGE_KEY = "eve-route-assignments:v1";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

const VALID_STATUSES: RouteAssignmentStatus[] = [
  "queued",
  "buying",
  "hauling",
  "selling",
  "done",
];

function normalizeAssignment(value: unknown): RouteAssignment | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<RouteAssignment>;
  if (typeof raw.routeKey !== "string" || !raw.routeKey.trim()) return null;
  if (
    typeof raw.assignedCharacter !== "string" ||
    !raw.assignedCharacter.trim()
  ) {
    return null;
  }
  const status = VALID_STATUSES.includes(raw.status as RouteAssignmentStatus)
    ? (raw.status as RouteAssignmentStatus)
    : "queued";
  return {
    routeKey: raw.routeKey.trim(),
    assignedCharacter: raw.assignedCharacter.trim(),
    status,
    currentSystem:
      typeof raw.currentSystem === "string" && raw.currentSystem.trim()
        ? raw.currentSystem.trim()
        : undefined,
    stagedSystem:
      typeof raw.stagedSystem === "string" && raw.stagedSystem.trim()
        ? raw.stagedSystem.trim()
        : undefined,
    notes:
      typeof raw.notes === "string" && raw.notes.trim()
        ? raw.notes.trim()
        : undefined,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

function sanitizeAssignments(value: unknown): RouteAssignment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeAssignment(entry))
    .filter((entry): entry is RouteAssignment => entry !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadRouteAssignments(): RouteAssignment[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ROUTE_ASSIGNMENTS_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeAssignments(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRouteAssignments(assignments: RouteAssignment[]): RouteAssignment[] {
  const normalized = sanitizeAssignments(assignments);
  if (!hasStorage()) return normalized;
  try {
    window.localStorage.setItem(
      ROUTE_ASSIGNMENTS_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    // ignore storage write failures
  }
  return normalized;
}

export function getRouteAssignment(routeKey: string): RouteAssignment | null {
  return loadRouteAssignments().find((entry) => entry.routeKey === routeKey) ?? null;
}

export function upsertRouteAssignment(
  assignment: Omit<RouteAssignment, "updatedAt"> & { updatedAt?: string },
): RouteAssignment[] {
  const current = loadRouteAssignments();
  const filtered = current.filter((entry) => entry.routeKey !== assignment.routeKey);
  const normalized = normalizeAssignment({
    ...assignment,
    updatedAt: assignment.updatedAt ?? new Date().toISOString(),
  });
  if (!normalized) return saveRouteAssignments(filtered);
  return saveRouteAssignments([normalized, ...filtered]);
}

export function updateRouteAssignment(
  routeKey: string,
  patch: Partial<Omit<RouteAssignment, "routeKey" | "updatedAt">>,
): RouteAssignment[] {
  const existing = getRouteAssignment(routeKey);
  if (!existing) return loadRouteAssignments();
  return upsertRouteAssignment({
    ...existing,
    ...patch,
    routeKey,
    updatedAt: new Date().toISOString(),
  });
}

export function removeRouteAssignment(routeKey: string): RouteAssignment[] {
  return saveRouteAssignments(
    loadRouteAssignments().filter((entry) => entry.routeKey !== routeKey),
  );
}

export function getAssignmentsByPilot(pilotName: string): RouteAssignment[] {
  const normalizedPilot = pilotName.trim().toLowerCase();
  if (!normalizedPilot) return [];
  return loadRouteAssignments().filter(
    (entry) => entry.assignedCharacter.toLowerCase() === normalizedPilot,
  );
}

export function getAssignmentsByStatus(
  status: RouteAssignmentStatus,
): RouteAssignment[] {
  return loadRouteAssignments().filter((entry) => entry.status === status);
}

export function listAssignedPilots(): string[] {
  return Array.from(
    new Set(loadRouteAssignments().map((entry) => entry.assignedCharacter)),
  ).sort((a, b) => a.localeCompare(b));
}

export { ROUTE_ASSIGNMENTS_STORAGE_KEY, VALID_STATUSES };
