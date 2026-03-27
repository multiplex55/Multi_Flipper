import type { BatchLine } from "@/lib/batchMetrics";
import type { BaseBatchManifest, RouteAdditionLine, RouteAdditionOption } from "@/lib/types";

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

type ManifestSortableLine = {
  type_id: number;
  type_name: string;
  units: number;
  buy_total_isk: number;
  sell_total_isk: number;
  profit_total_isk: number;
};

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

function sortManifestLinesStable<T extends ManifestSortableLine>(lines: T[]): T[] {
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => {
      const nameCmp = a.line.type_name.localeCompare(b.line.type_name, "en", {
        sensitivity: "base",
        numeric: true,
      });
      if (nameCmp !== 0) return nameCmp;
      if (a.line.type_id !== b.line.type_id) return a.line.type_id - b.line.type_id;
      if (a.line.units !== b.line.units) return b.line.units - a.line.units;
      if (a.line.profit_total_isk !== b.line.profit_total_isk) {
        return b.line.profit_total_isk - a.line.profit_total_isk;
      }
      return a.index - b.index;
    })
    .map(({ line }) => line);
}

function formatSectionLine(line: ManifestSortableLine): string {
  return `${line.type_name} x${formatQuantity(line.units)} | buy ${formatInteger(line.buy_total_isk)} ISK | sell ${formatInteger(line.sell_total_isk)} ISK | profit ${formatInteger(line.profit_total_isk)} ISK`;
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

export function formatBaseSection(baseBatchManifest: BaseBatchManifest): string[] {
  const lines: string[] = [];
  lines.push("----- BASE ITEMS -----");
  const sortedBaseLines = sortManifestLinesStable(baseBatchManifest.base_lines);
  if (sortedBaseLines.length === 0) {
    lines.push("(none)");
    return lines;
  }
  for (const line of sortedBaseLines) lines.push(formatSectionLine(line));
  return lines;
}

export function formatRouteAddedSection(addedLines: RouteAdditionLine[]): string[] {
  const lines: string[] = [];
  lines.push("----- ROUTE ADDITIONS -----");
  const sortedAddedLines = sortManifestLinesStable(addedLines);
  if (sortedAddedLines.length === 0) {
    lines.push("(none)");
    return lines;
  }
  for (const line of sortedAddedLines) lines.push(formatSectionLine(line));
  return lines;
}

export function formatFinalMergedSummarySection(input: {
  baseBatchManifest: BaseBatchManifest;
  selectedOption: RouteAdditionOption;
}): string[] {
  const { baseBatchManifest, selectedOption } = input;
  const totalVolume = baseBatchManifest.total_volume_m3 + selectedOption.added_volume_m3;
  const totalBuy = baseBatchManifest.total_buy_isk + selectedOption.total_buy_isk;
  const totalSell = baseBatchManifest.total_sell_isk + selectedOption.total_sell_isk;
  const totalProfit = baseBatchManifest.total_profit_isk + selectedOption.total_profit_isk;
  const totalUnits =
    baseBatchManifest.base_lines.reduce((sum, line) => sum + line.units, 0) +
    selectedOption.lines.reduce((sum, line) => sum + line.units, 0);
  const totalLineCount = baseBatchManifest.base_line_count + selectedOption.line_count;
  const remainingCapacity = Math.max(0, baseBatchManifest.cargo_limit_m3 - totalVolume);

  return [
    "----- MERGED SUMMARY -----",
    `Lines: base ${formatQuantity(baseBatchManifest.base_line_count)} + added ${formatQuantity(selectedOption.line_count)} = ${formatQuantity(totalLineCount)}`,
    `Units: ${formatQuantity(totalUnits)} | Volume: ${formatVolume(totalVolume)} m3 / ${formatVolume(baseBatchManifest.cargo_limit_m3)} m3 (remaining ${formatVolume(remainingCapacity)} m3)`,
    `Totals: buy ${formatInteger(totalBuy)} ISK | sell ${formatInteger(totalSell)} ISK | profit ${formatInteger(totalProfit)} ISK`,
  ];
}

export function formatMergedBatchManifestText(input: {
  baseBatchManifest: BaseBatchManifest;
  selectedOption: RouteAdditionOption;
  metadataHeader?: RouteMetadataHeaderInput;
}): string {
  const output: string[] = [];
  output.push(
    `Origin: ${input.baseBatchManifest.origin_system_name} (${input.baseBatchManifest.origin_location_name})`,
  );
  output.push(...formatRouteMetadataHeader(input.metadataHeader));
  output.push(...formatFinalMergedSummarySection(input));
  output.push("");
  output.push(...formatBaseSection(input.baseBatchManifest));
  output.push("");
  output.push(...formatRouteAddedSection(input.selectedOption.lines));
  return output.join("\n");
}
