import { formatISK } from "@/lib/format";
import type { SavedRoutePack, SavedRoutePackLineExecutionEntry } from "@/lib/types";

const SAVED_ROUTE_PACKS_STORAGE_KEY = "eve-saved-route-packs:v1";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function normalizeSavedRoutePack(value: unknown): SavedRoutePack | null {
  if (!value || typeof value !== "object") return null;
  const pack = value as Partial<SavedRoutePack>;
  if (!pack.routeKey || typeof pack.routeKey !== "string") return null;
  if (!pack.routeLabel || typeof pack.routeLabel !== "string") return null;
  if (!Array.isArray(pack.selectedLineKeys) || !Array.isArray(pack.excludedLineKeys)) {
    return null;
  }
  if (!pack.summarySnapshot || typeof pack.summarySnapshot !== "object") return null;
  const normalizedLines: Record<string, SavedRoutePackLineExecutionEntry> = {};
  if (pack.lines && typeof pack.lines === "object") {
    for (const [lineKey, rawLine] of Object.entries(pack.lines)) {
      if (!rawLine || typeof rawLine !== "object") continue;
      const line = rawLine as Partial<SavedRoutePackLineExecutionEntry>;
      const plannedQty = Math.max(0, Math.floor(Number(line.plannedQty ?? 0)));
      const soldQty = Math.max(0, Math.floor(Number(line.soldQty ?? 0)));
      normalizedLines[String(lineKey)] = {
        lineKey: String(line.lineKey ?? lineKey),
        typeId: Math.trunc(Number(line.typeId ?? 0)),
        typeName: String(line.typeName ?? ""),
        plannedQty,
        plannedBuyPrice: Math.max(0, Number(line.plannedBuyPrice ?? 0)),
        plannedSellPrice: Math.max(0, Number(line.plannedSellPrice ?? 0)),
        plannedProfit: Math.max(0, Number(line.plannedProfit ?? 0)),
        plannedVolume: Math.max(0, Number(line.plannedVolume ?? 0)),
        boughtQty: Math.max(0, Math.floor(Number(line.boughtQty ?? 0))),
        boughtTotal: Math.max(0, Number(line.boughtTotal ?? 0)),
        soldQty,
        soldTotal: Math.max(0, Number(line.soldTotal ?? 0)),
        remainingQty:
          line.remainingQty != null
            ? Math.max(0, Math.floor(Number(line.remainingQty)))
            : Math.max(0, plannedQty - soldQty),
        status:
          line.status === "bought" ||
          line.status === "partially_sold" ||
          line.status === "completed" ||
          line.status === "skipped"
            ? line.status
            : "planned",
        skipReason: line.skipReason ? String(line.skipReason) : null,
        notes: typeof line.notes === "string" ? line.notes : "",
      };
    }
  }
  return {
    ...pack,
    buyLocationId: Math.trunc(Number(pack.buyLocationId ?? 0)),
    sellLocationId: Math.trunc(Number(pack.sellLocationId ?? 0)),
    buySystemId: Math.trunc(Number(pack.buySystemId ?? 0)),
    sellSystemId: Math.trunc(Number(pack.sellSystemId ?? 0)),
    createdAt: String(pack.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(pack.updatedAt ?? new Date(0).toISOString()),
    lastVerifiedAt: pack.lastVerifiedAt ? String(pack.lastVerifiedAt) : null,
    verificationProfileId: typeof pack.verificationProfileId === "string" ? pack.verificationProfileId : "standard",
    entryMode:
      pack.entryMode === "filler" || pack.entryMode === "loop" ? pack.entryMode : "core",
    launchIntent: pack.launchIntent ? String(pack.launchIntent) : null,
    selectedLineKeys: pack.selectedLineKeys.map((v) => String(v)).sort((a, b) =>
      a.localeCompare(b),
    ),
    excludedLineKeys: pack.excludedLineKeys.map((v) => String(v)).sort((a, b) =>
      a.localeCompare(b),
    ),
    summarySnapshot: pack.summarySnapshot,
    lines: normalizedLines,
    manifestSnapshot: pack.manifestSnapshot ?? null,
    verificationSnapshot: pack.verificationSnapshot
      ? {
          ...pack.verificationSnapshot,
          recommendation:
            pack.verificationSnapshot.recommendation === "proceed" ||
            pack.verificationSnapshot.recommendation === "proceed_reduced" ||
            pack.verificationSnapshot.recommendation === "reprice_rebuild" ||
            pack.verificationSnapshot.recommendation === "abort"
              ? pack.verificationSnapshot.recommendation
              : undefined,
          checkedAt: String(
            pack.verificationSnapshot.checkedAt ??
              pack.verificationSnapshot.verifiedAt ??
              new Date(0).toISOString(),
          ),
          buyDriftPct: Number(pack.verificationSnapshot.buyDriftPct ?? 0),
          sellDriftPct: Number(pack.verificationSnapshot.sellDriftPct ?? 0),
          profitRetentionPct: Number(pack.verificationSnapshot.profitRetentionPct ?? 0),
          offenderLines: Array.isArray(pack.verificationSnapshot.offenderLines)
            ? pack.verificationSnapshot.offenderLines.map((line) => String(line))
            : [],
          summary: String(pack.verificationSnapshot.summary ?? ""),
        }
      : null,
    notes: typeof pack.notes === "string" ? pack.notes : "",
    tags: Array.isArray(pack.tags) ? pack.tags.map((v) => String(v)) : [],
    status: pack.status === "archived" ? "archived" : "active",
    routeKey: pack.routeKey,
    routeLabel: pack.routeLabel,
  } as SavedRoutePack;
}

function sanitizeSavedRoutePacks(value: unknown): SavedRoutePack[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeSavedRoutePack(item))
    .filter((item): item is SavedRoutePack => item !== null);
}

export function loadSavedRoutePacks(): SavedRoutePack[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(SAVED_ROUTE_PACKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeSavedRoutePacks(parsed);
  } catch {
    return [];
  }
}

export function saveSavedRoutePacks(packs: SavedRoutePack[]): void {
  if (!hasStorage()) return;
  const normalized = sanitizeSavedRoutePacks(packs).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  try {
    window.localStorage.setItem(
      SAVED_ROUTE_PACKS_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    // Ignore storage quota/access errors.
  }
}

export function upsertSavedRoutePack(pack: SavedRoutePack): SavedRoutePack[] {
  const existing = loadSavedRoutePacks();
  const byKey = new Map(existing.map((item) => [item.routeKey, item]));
  byKey.set(pack.routeKey, normalizeSavedRoutePack(pack) ?? pack);
  const next = [...byKey.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  saveSavedRoutePacks(next);
  return next;
}

export function removeSavedRoutePack(routeKey: string): SavedRoutePack[] {
  const next = loadSavedRoutePacks().filter((pack) => pack.routeKey !== routeKey);
  saveSavedRoutePacks(next);
  return next;
}

export function findSavedRoutePack(routeKey: string): SavedRoutePack | null {
  return loadSavedRoutePacks().find((pack) => pack.routeKey === routeKey) ?? null;
}

function verificationAgeLabel(lastVerifiedAt: string | null, now = new Date()): string {
  if (!lastVerifiedAt) return "not verified";
  const parsed = new Date(lastVerifiedAt);
  if (!Number.isFinite(parsed.getTime())) return "unknown";
  const ageMs = Math.max(0, now.getTime() - parsed.getTime());
  const mins = Math.floor(ageMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatSavedRoutePackExport(pack: SavedRoutePack, now = new Date()): string {
  const verificationBadge = pack.verificationSnapshot
    ? `${pack.verificationSnapshot.status} (${verificationAgeLabel(pack.lastVerifiedAt, now)})`
    : "Unverified";
  const lines = [
    `Route: ${pack.routeLabel}`,
    `Status: ${pack.status}`,
    `Expected profit: ${formatISK(pack.summarySnapshot.routeTotalProfit)}`,
    `Capital: ${formatISK(pack.summarySnapshot.routeTotalCapital)}`,
    `Verification: ${verificationBadge}`,
  ];
  if (pack.manifestSnapshot) {
    lines.push(
      "",
      "Manifest snapshot:",
      `- Expected profit: ${formatISK(pack.manifestSnapshot.expected_profit_isk)}`,
      `- Min acceptable: ${formatISK(pack.manifestSnapshot.min_acceptable_profit_isk)}`,
      `- Lines: ${pack.manifestSnapshot.lines.length}`,
    );
  }
  return lines.join("\n");
}

export { SAVED_ROUTE_PACKS_STORAGE_KEY };
