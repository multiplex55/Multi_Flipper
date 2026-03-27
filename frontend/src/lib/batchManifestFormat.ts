import type { BatchLine } from "@/lib/batchMetrics";
import type { OrderedRouteManifest } from "@/lib/types";

type ManifestInputLine = {
  typeName: string;
  units: number | string;
};

function toIntegerQuantityString(units: number | string): string {
  if (typeof units === "number") {
    if (!Number.isFinite(units)) return "0";
    return String(Math.trunc(units));
  }

  const normalized = units.replace(/,/g, "").trim();
  if (normalized.length === 0) return "0";

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return "0";
  return String(Math.trunc(parsed));
}

function toManifestLine(input: ManifestInputLine): string {
  return `${input.typeName} ${toIntegerQuantityString(input.units)}`;
}

export function formatBatchLinesToMultibuyLines(
  lines: Array<ManifestInputLine | BatchLine>,
): string[] {
  return lines.map((line) => {
    if ("row" in line) {
      return toManifestLine({ typeName: line.row.TypeName, units: line.units });
    }
    return toManifestLine(line);
  });
}

export function formatBatchLinesToMultibuyText(
  lines: Array<ManifestInputLine | BatchLine>,
): string {
  return formatBatchLinesToMultibuyLines(lines).join("\n");
}

export function parseDetailedBatchLine(
  line: string,
): { typeName: string; units: string } | null {
  const match = line.match(/^([^|]+?)\s*\|\s*qty\s+([\d,]+)\b/i);
  if (!match) return null;
  const typeName = match[1].trim();
  if (!typeName) return null;
  const units = match[2].replace(/,/g, "");
  return { typeName, units };
}

type RouteMetadataHeaderInput = {
  corridor?: string;
  jumps?: number;
  iskPerJump?: number;
};

function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("en-US");
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.max(0, Math.trunc(value)).toLocaleString("en-US");
}

function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function formatRouteMetadataHeader(input?: RouteMetadataHeaderInput): string[] {
  if (!input) return [];
  const parts: string[] = [];
  if (input.corridor?.trim()) parts.push(`Corridor: ${input.corridor.trim()}`);
  if (input.jumps != null && Number.isFinite(input.jumps)) {
    parts.push(`Route jumps: ${formatQuantity(input.jumps)}`);
  }
  if (input.iskPerJump != null && Number.isFinite(input.iskPerJump)) {
    parts.push(`ISK/jump: ${formatInteger(input.iskPerJump)} ISK`);
  }
  return parts;
}

function formatStationLine(line: OrderedRouteManifest["stations"][number]["lines"][number]): string {
  return `${line.type_name} | qty ${formatQuantity(line.units)} | buy total ${formatInteger(line.buy_total_isk)} ISK | buy per ${formatInteger(line.buy_per_isk)} ISK | sell total ${formatInteger(line.sell_total_isk)} ISK | sell per ${formatInteger(line.sell_per_isk)} ISK | vol ${formatVolume(line.volume_m3)} m3 | profit ${formatInteger(line.profit_isk)} ISK`;
}

export function formatOrderedRouteManifestText(input: {
  originLabel?: string;
  metadataHeader?: RouteMetadataHeaderInput;
  manifest: OrderedRouteManifest;
}): string {
  const output: string[] = [];
  if (input.originLabel?.trim()) output.push(`Origin: ${input.originLabel.trim()}`);
  output.push(...formatRouteMetadataHeader(input.metadataHeader));
  if (input.manifest.summary) {
    const summary = input.manifest.summary;
    output.push("----- ROUTE SUMMARY -----");
    output.push(
      `Stations: ${formatQuantity(summary.station_count)} | Items: ${formatQuantity(summary.item_count)} | Units: ${formatQuantity(summary.total_units)}`,
    );
    output.push(
      `Totals: vol ${formatVolume(summary.total_volume_m3)} m3 | buy ${formatInteger(summary.total_buy_isk)} ISK | sell ${formatInteger(summary.total_sell_isk)} ISK | profit ${formatInteger(summary.total_profit_isk)} ISK`,
    );
    if ((summary.total_jumps ?? 0) > 0 || (summary.isk_per_jump ?? 0) > 0) {
      output.push(
        `Route: jumps ${formatQuantity(summary.total_jumps ?? 0)} | ISK/jump ${formatInteger(summary.isk_per_jump ?? 0)} ISK`,
      );
    }
  }
  for (const [index, station] of input.manifest.stations.entries()) {
    if (output.length > 0) output.push("");
    output.push(`----- STATION ${index + 1}: ${station.buy_station_name} -----`);
    output.push(`Jumps to Buy Station: ${formatQuantity(station.jumps_to_buy_station)}`);
    output.push(`Jumps Buy -> Sell: ${formatQuantity(station.jumps_buy_to_sell)}`);
    output.push(
      `Items: ${formatQuantity(station.item_count)} | Units: ${formatQuantity(station.total_units)} | Volume: ${formatVolume(station.total_volume_m3)} m3`,
    );
    output.push(
      `Capital: ${formatInteger(station.total_buy_isk)} ISK | Gross Sell: ${formatInteger(station.total_sell_isk)} ISK | Profit: ${formatInteger(station.total_profit_isk)} ISK | ISK/jump: ${formatInteger(station.isk_per_jump)} ISK`,
    );
    const compact = station.lines.map((line) => `${line.type_name} ${formatQuantity(line.units)}`);
    output.push(`Item list: ${compact.length > 0 ? compact.join(", ") : "(none)"}`);
    for (const line of station.lines) output.push(formatStationLine(line));
  }
  return output.join("\n");
}
