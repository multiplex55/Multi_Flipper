import { getVerificationFreshness, getVerificationProfileById } from "@/lib/verificationProfiles";

export type RouteQueueStatus =
  | "queued"
  | "assigned"
  | "needs_verify"
  | "buying"
  | "hauling"
  | "selling"
  | "done"
  | "skipped";

export interface RouteQueueEntry {
  routeKey: string;
  routeLabel: string;
  status: RouteQueueStatus;
  priority: number;
  assignedPilot: string | null;
  verificationProfileId: string;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROUTE_QUEUE_STORAGE_KEY = "eve-flipper:route-queue:v1";

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function safeDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

function isRouteQueueStatus(value: unknown): value is RouteQueueStatus {
  return (
    value === "queued" ||
    value === "assigned" ||
    value === "needs_verify" ||
    value === "buying" ||
    value === "hauling" ||
    value === "selling" ||
    value === "done" ||
    value === "skipped"
  );
}

function maybeNeedsVerify(status: RouteQueueStatus, lastVerifiedAt: string | null, verificationProfileId: string): RouteQueueStatus {
  if (status === "done" || status === "skipped" || status === "needs_verify") return status;
  if (!lastVerifiedAt) return status;
  const freshness = getVerificationFreshness(
    lastVerifiedAt,
    getVerificationProfileById(verificationProfileId),
  );
  return freshness === "stale" ? "needs_verify" : status;
}

function sortRouteQueue(entries: RouteQueueEntry[]): RouteQueueEntry[] {
  return [...entries].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.updatedAt !== b.updatedAt) return a.updatedAt.localeCompare(b.updatedAt);
    return a.routeKey.localeCompare(b.routeKey);
  });
}

export function normalizeRouteQueueEntry(
  value: unknown,
  now: Date = new Date(),
): RouteQueueEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const routeKey = safeText(record.routeKey).trim();
  if (!routeKey) return null;
  const fallbackDate = now.toISOString();
  const verificationProfileId = safeText(record.verificationProfileId, "standard") || "standard";
  const status = isRouteQueueStatus(record.status) ? record.status : "queued";
  const lastVerifiedAt = typeof record.lastVerifiedAt === "string" ? safeDate(record.lastVerifiedAt, fallbackDate) : null;
  return {
    routeKey,
    routeLabel: safeText(record.routeLabel, routeKey),
    status: maybeNeedsVerify(status, lastVerifiedAt, verificationProfileId),
    priority: Math.trunc(safeNumber(record.priority, 0)),
    assignedPilot: typeof record.assignedPilot === "string" ? record.assignedPilot : null,
    verificationProfileId,
    lastVerifiedAt,
    createdAt: safeDate(record.createdAt, fallbackDate),
    updatedAt: safeDate(record.updatedAt, fallbackDate),
  };
}

export function loadRouteQueue(): RouteQueueEntry[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(ROUTE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = new Date();
    return sortRouteQueue(parsed.map((entry) => normalizeRouteQueueEntry(entry, now)).filter((entry): entry is RouteQueueEntry => Boolean(entry)));
  } catch {
    return [];
  }
}

export function saveRouteQueue(entries: RouteQueueEntry[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(ROUTE_QUEUE_STORAGE_KEY, JSON.stringify(sortRouteQueue(entries)));
  } catch {
    // Intentionally ignore quota/storage errors to keep UI functional.
  }
}

export function upsertRouteQueueEntry(
  entries: RouteQueueEntry[],
  nextEntry: RouteQueueEntry,
): RouteQueueEntry[] {
  const normalized = normalizeRouteQueueEntry(nextEntry);
  if (!normalized) return sortRouteQueue(entries);
  const withoutTarget = entries.filter((entry) => entry.routeKey !== normalized.routeKey);
  return sortRouteQueue([...withoutTarget, normalized]);
}

export function updateRouteQueueEntry(
  entries: RouteQueueEntry[],
  routeKey: string,
  patch: Partial<RouteQueueEntry>,
): RouteQueueEntry[] {
  const target = entries.find((entry) => entry.routeKey === routeKey);
  if (!target) return sortRouteQueue(entries);
  const merged = normalizeRouteQueueEntry({
    ...target,
    ...patch,
    routeKey,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  });
  if (!merged) return sortRouteQueue(entries);
  return sortRouteQueue(entries.map((entry) => (entry.routeKey === routeKey ? merged : entry)));
}

export function removeRouteQueueEntry(entries: RouteQueueEntry[], routeKey: string): RouteQueueEntry[] {
  return sortRouteQueue(entries.filter((entry) => entry.routeKey !== routeKey));
}

export function getNextQueuedRoute(entries: RouteQueueEntry[]): RouteQueueEntry | null {
  const [next] = sortRouteQueue(entries).filter((entry) => entry.status !== "done" && entry.status !== "skipped");
  return next ?? null;
}
