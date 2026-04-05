import type { PinnedOpportunityPayload, PinnedOpportunityRecord, PinnedOpportunitySource } from "@/lib/types";

export type PinnedOpportunityLabels = {
  itemLabel: string;
  sourceLabel: string;
  buyLabel: string;
  sellLabel: string;
};

function metaString(payload: PinnedOpportunityPayload | undefined, key: string): string {
  const value = payload?.metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function sourceLabel(source: PinnedOpportunitySource | undefined): string {
  switch (source) {
    case "scan":
      return "Scan";
    case "station":
      return "Station";
    case "regional_day":
      return "Regional";
    case "contracts":
      return "Contracts";
    default:
      return "Unknown";
  }
}

function locationLabel(primary: string, secondary: string, fallbackId?: number): string {
  const a = primary.trim();
  const b = secondary.trim();
  if (a && b && a !== b) return `${a} · ${b}`;
  if (a) return a;
  if (b) return b;
  if (fallbackId && fallbackId > 0) return `Location #${fallbackId}`;
  return "Location #Unknown";
}

export function getPinnedOpportunityLabels(row: PinnedOpportunityRecord): PinnedOpportunityLabels {
  const payload = row.payload;
  const explicitTypeName = (payload?.type_name ?? "").trim();
  const typeFromMeta = metaString(payload, "type_name");
  const title = metaString(payload, "title");
  const itemLabel =
    explicitTypeName ||
    typeFromMeta ||
    title ||
    (payload?.type_id && payload.type_id > 0 ? `TypeID #${payload.type_id}` : "TypeID #Unknown");

  const buyLabel =
    (payload?.buy_label ?? "").trim() ||
    locationLabel(
      (payload?.buy_station_name ?? "").trim() || metaString(payload, "buy_station_name") || metaString(payload, "station_name"),
      (payload?.buy_system_name ?? "").trim() || metaString(payload, "source_system_name") || (payload?.system_name ?? "").trim(),
      payload?.buy_location_id ?? payload?.station_id,
    );

  const sellLabel =
    (payload?.sell_label ?? "").trim() ||
    locationLabel(
      (payload?.sell_station_name ?? "").trim() || metaString(payload, "sell_station_name") || metaString(payload, "target_station_name"),
      (payload?.sell_system_name ?? "").trim() || metaString(payload, "target_system_name") || metaString(payload, "region_name"),
      payload?.sell_location_id ?? payload?.contract_id,
    );

  return {
    itemLabel,
    sourceLabel: (payload?.source_label ?? "").trim() || sourceLabel(payload?.source ?? row.tab),
    buyLabel,
    sellLabel,
  };
}
