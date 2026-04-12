import type { ContractResult, FlipResult, RouteResult, StationTrade } from "@/lib/types";

const typeIdKeys = ["TypeID", "type_id"] as const;
const stationIdKeys = [
  "BuyLocationID",
  "SellLocationID",
  "StationID",
  "location_id",
  "buy_location_id",
  "sell_location_id",
  "LocationID",
  "DestLocationID",
] as const;

export type SessionStationFilters = {
  ignoredBuyStationIds: Set<number>;
  ignoredSellStationIds: Set<number>;
  deprioritizedStationIds: Set<number>;
  ignoredSystemIds?: Set<number>;
};

export function createSessionStationFilters(): SessionStationFilters {
  return {
    ignoredBuyStationIds: new Set<number>(),
    ignoredSellStationIds: new Set<number>(),
    deprioritizedStationIds: new Set<number>(),
    ignoredSystemIds: undefined,
  };
}

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function hasBannedStationID(value: unknown, bannedStationIDs: Set<number>): boolean {
  const rec = asRecord(value);
  if (!rec) return false;

  for (const key of stationIdKeys) {
    const stationID = toInt(rec[key]);
    if (stationID > 0 && bannedStationIDs.has(stationID)) return true;
  }

  return false;
}

function getBuyStationID(value: unknown): number {
  const rec = asRecord(value);
  if (!rec) return 0;
  return toInt(rec.BuyLocationID ?? rec.buy_location_id ?? rec.LocationID ?? rec.location_id);
}

function getSellStationID(value: unknown): number {
  const rec = asRecord(value);
  if (!rec) return 0;
  return toInt(rec.SellLocationID ?? rec.sell_location_id ?? rec.DestLocationID);
}

export function filterRowsByBannedTypeIDs<T>(rows: readonly T[], bannedTypeIDs: readonly number[]): T[] {
  if (rows.length === 0 || bannedTypeIDs.length === 0) return [...rows];
  const blocked = new Set(bannedTypeIDs.filter((id) => id > 0));
  if (blocked.size === 0) return [...rows];

  return rows.filter((row) => {
    const rec = asRecord(row);
    if (!rec) return true;
    for (const key of typeIdKeys) {
      const typeID = toInt(rec[key]);
      if (typeID > 0 && blocked.has(typeID)) return false;
    }
    return true;
  });
}

export function filterRowsByBannedStationIDs<T>(rows: readonly T[], bannedStationIDs: readonly number[]): T[] {
  if (rows.length === 0 || bannedStationIDs.length === 0) return [...rows];
  const blocked = new Set(bannedStationIDs.filter((id) => id > 0));
  if (blocked.size === 0) return [...rows];
  return rows.filter((row) => !hasBannedStationID(row, blocked));
}

export function filterRowsBySessionStationIgnores(
  rows: readonly FlipResult[],
  sessionFilters?: SessionStationFilters,
): FlipResult[] {
  if (!sessionFilters || rows.length === 0) return [...rows];
  const { ignoredBuyStationIds, ignoredSellStationIds } = sessionFilters;
  if (ignoredBuyStationIds.size === 0 && ignoredSellStationIds.size === 0) {
    return [...rows];
  }
  return rows.filter((row) => {
    const buyStationID = getBuyStationID(row);
    if (buyStationID > 0 && ignoredBuyStationIds.has(buyStationID)) return false;
    const sellStationID = getSellStationID(row);
    if (sellStationID > 0 && ignoredSellStationIds.has(sellStationID)) return false;
    return true;
  });
}

export function isFlipResultDeprioritized(
  row: FlipResult,
  sessionFilters?: SessionStationFilters,
): boolean {
  if (!sessionFilters || sessionFilters.deprioritizedStationIds.size === 0) return false;
  const buyStationID = getBuyStationID(row);
  if (buyStationID > 0 && sessionFilters.deprioritizedStationIds.has(buyStationID)) return true;
  const sellStationID = getSellStationID(row);
  if (sellStationID > 0 && sessionFilters.deprioritizedStationIds.has(sellStationID)) return true;
  return false;
}

export function filterFlipResultsByPhases(
  rows: readonly FlipResult[],
  bannedTypeIDs: readonly number[],
  bannedStationIDs: readonly number[],
  sessionFilters?: SessionStationFilters,
): FlipResult[] {
  // Phase 1: hard bans (persistent banlist).
  const hardBanned = filterRowsByBannedStationIDs(
    filterRowsByBannedTypeIDs(rows, bannedTypeIDs),
    bannedStationIDs,
  );
  // Phase 2: soft session hide rules (buy/sell-role-specific station ignores).
  const softHidden = filterRowsBySessionStationIgnores(hardBanned, sessionFilters);
  // Phase 3 (deprioritized scoring penalties) is intentionally applied by ranking logic.
  return softHidden;
}

export function filterRouteResults(
  results: readonly RouteResult[],
  bannedTypeIDs: readonly number[],
  bannedStationIDs: readonly number[],
): RouteResult[] {
  if (results.length === 0) return [];
  const blockedTypes = new Set(bannedTypeIDs.filter((id) => id > 0));
  const blockedStations = new Set(bannedStationIDs.filter((id) => id > 0));

  return results.filter((route) => {
    if (!Array.isArray(route.Hops) || route.Hops.length === 0) return true;
    for (const hop of route.Hops) {
      const rec = asRecord(hop);
      if (!rec) continue;
      const typeID = toInt(rec.TypeID ?? rec.type_id);
      if (typeID > 0 && blockedTypes.has(typeID)) return false;
      if (hasBannedStationID(hop, blockedStations)) return false;
    }
    return true;
  });
}

export function filterFlipResults(
  rows: readonly FlipResult[],
  bannedTypeIDs: readonly number[],
  bannedStationIDs: readonly number[],
  sessionFilters?: SessionStationFilters,
): FlipResult[] {
  return filterFlipResultsByPhases(rows, bannedTypeIDs, bannedStationIDs, sessionFilters);
}

export function filterStationTrades(rows: readonly StationTrade[], bannedTypeIDs: readonly number[], bannedStationIDs: readonly number[]): StationTrade[] {
  return filterRowsByBannedStationIDs(filterRowsByBannedTypeIDs(rows, bannedTypeIDs), bannedStationIDs);
}

export function filterContractResults(rows: readonly ContractResult[], bannedStationIDs: readonly number[]): ContractResult[] {
  if (rows.length === 0 || bannedStationIDs.length === 0) return [...rows];
  const blocked = new Set(bannedStationIDs.filter((id) => id > 0));
  if (blocked.size === 0) return [...rows];
  return rows.filter((row) => {
    const rec = asRecord(row);
    if (!rec) return true;
    const stationID = toInt(rec.StationID ?? rec.station_id ?? rec.LocationID);
    return stationID <= 0 || !blocked.has(stationID);
  });
}
