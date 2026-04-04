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

export function filterFlipResults(rows: readonly FlipResult[], bannedTypeIDs: readonly number[], bannedStationIDs: readonly number[]): FlipResult[] {
  return filterRowsByBannedStationIDs(filterRowsByBannedTypeIDs(rows, bannedTypeIDs), bannedStationIDs);
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
