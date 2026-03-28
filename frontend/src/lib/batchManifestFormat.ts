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

type BaseManifestTranslationKey =
  | "batchBuilderManifestBuyStation"
  | "batchBuilderManifestJumpsToBuyStation"
  | "batchBuilderManifestSellStation"
  | "batchBuilderManifestJumpsBuyToSell"
  | "batchBuilderManifestItems"
  | "batchBuilderManifestTotalVolume"
  | "batchBuilderManifestTotalCapital"
  | "batchBuilderManifestTotalGrossSell"
  | "batchBuilderManifestTotalProfit"
  | "batchBuilderManifestTotalIskPerJump"
  | "batchBuilderManifestItemQty"
  | "batchBuilderManifestItemBuyTotal"
  | "batchBuilderManifestItemBuyPer"
  | "batchBuilderManifestItemSellTotal"
  | "batchBuilderManifestItemSellPer"
  | "batchBuilderManifestItemVol"
  | "batchBuilderManifestItemProfit";

export type DetailedManifestItemLineInput = {
  typeName: string;
  qty: number;
  buyTotal: number;
  buyPer: number;
  sellTotal: number;
  sellPer: number;
  volume: number;
  profit: number;
};

export function formatDetailedManifestItemLine(
  input: DetailedManifestItemLineInput,
  t: (key: BaseManifestTranslationKey, vars?: Record<string, string | number>) => string,
): string {
  return `${input.typeName} | ${t("batchBuilderManifestItemQty", { qty: input.qty.toLocaleString() })} | ${t("batchBuilderManifestItemBuyTotal", { isk: Math.round(input.buyTotal).toLocaleString() })} | ${t("batchBuilderManifestItemBuyPer", { isk: Math.round(input.buyPer).toLocaleString() })} | ${t("batchBuilderManifestItemSellTotal", { isk: Math.round(input.sellTotal).toLocaleString() })} | ${t("batchBuilderManifestItemSellPer", { isk: Math.round(input.sellPer).toLocaleString() })} | ${t("batchBuilderManifestItemVol", { volume: input.volume.toLocaleString(undefined, { maximumFractionDigits: 1 }) })} | ${t("batchBuilderManifestItemProfit", { isk: Math.round(input.profit).toLocaleString() })}`;
}

type BaseBatchManifestTextInput = {
  buyStation: string;
  sellStation: string;
  buyJumps: number;
  sellJumps: number;
  cargoLimitM3: number;
  cargoUnlimitedLabel: string;
  itemCount: number;
  totalVolume: number;
  totalCapital: number;
  totalGrossSell: number;
  totalProfit: number;
  lines: BatchLine[];
  t: (key: BaseManifestTranslationKey, vars?: Record<string, string | number>) => string;
};

export function formatBaseBatchManifestText(input: BaseBatchManifestTextInput): string {
  const lines: string[] = [];
  const multibuyLines = formatBatchLinesToMultibuyLines(input.lines);
  const totalRouteJumps = input.buyJumps + input.sellJumps;
  const totalIskPerJump = totalRouteJumps > 0 ? input.totalProfit / totalRouteJumps : 0;

  lines.push(input.t("batchBuilderManifestBuyStation", { station: input.buyStation }));
  lines.push(input.t("batchBuilderManifestJumpsToBuyStation", { jumps: input.buyJumps }));
  lines.push(input.t("batchBuilderManifestSellStation", { station: input.sellStation }));
  lines.push(input.t("batchBuilderManifestJumpsBuyToSell", { jumps: input.sellJumps }));
  lines.push(
    `Cargo m3: ${
      input.cargoLimitM3 > 0 ? input.cargoLimitM3.toLocaleString() : input.cargoUnlimitedLabel
    }`,
  );
  lines.push(input.t("batchBuilderManifestItems", { count: input.itemCount }));
  lines.push(
    input.t("batchBuilderManifestTotalVolume", {
      volume: input.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 1 }),
    }),
  );
  lines.push(
    input.t("batchBuilderManifestTotalCapital", {
      isk: Math.round(input.totalCapital).toLocaleString(),
    }),
  );
  lines.push(
    input.t("batchBuilderManifestTotalGrossSell", {
      isk: Math.round(input.totalGrossSell).toLocaleString(),
    }),
  );
  lines.push(
    input.t("batchBuilderManifestTotalProfit", {
      isk: Math.round(input.totalProfit).toLocaleString(),
    }),
  );
  lines.push(
    input.t("batchBuilderManifestTotalIskPerJump", {
      isk: Math.round(totalIskPerJump).toLocaleString(),
    }),
  );
  lines.push("");

  for (const line of input.lines) {
    const qty = line.units;
    const buyTotal = line.capital;
    const buyPer = line.capital / line.units;
    const sellTotal = line.grossSell;
    const sellPer = line.grossSell / line.units;
    const vol = line.volume;
    const profit = line.profit;
    lines.push(
      formatDetailedManifestItemLine(
        {
          typeName: line.row.TypeName,
          qty,
          buyTotal,
          buyPer,
          sellTotal,
          sellPer,
          volume: vol,
          profit,
        },
        input.t,
      ),
    );
  }

  lines.push("");
  lines.push(...multibuyLines);
  return lines.join("\n");
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

function formatOptionalQuantity(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return formatQuantity(value);
}

function formatOptionalInteger(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return formatInteger(value);
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

/**
 * Formatting policy for ordered route manifests:
 * - "en-US" locale is used for all grouped numbers to keep separators deterministic.
 * - ISK values are rounded to nearest integer via Math.round.
 * - Quantities are truncated toward zero (no fractional units).
 * - Volumes are fixed to 0-1 decimal places.
 */
const ROUTE_SUMMARY_FORMAT_ORDER = [
  "Cargo m3",
  "Stations",
  "Items",
  "Total volume",
  "Total capital",
  "Total gross sell",
  "Total profit",
  "Total isk/jump",
] as const;

const HOP_FORMAT_ORDER = [
  "Buy Station",
  "Jumps to Buy Station",
  "Sell Station",
  "Jumps Buy -> Sell",
  "Cargo m3",
  "Items",
  "Total volume",
  "Total capital",
  "Total gross sell",
  "Total profit",
  "Total isk/jump",
] as const;

const HOP_SEPARATOR = "------------------------";

export function formatOrderedRouteManifestText(input: {
  originLabel?: string;
  metadataHeader?: RouteMetadataHeaderInput;
  manifest: OrderedRouteManifest;
}): string {
  const resolveSellStation = (): string | null => {
    const corridor = input.metadataHeader?.corridor?.trim();
    if (!corridor) return null;
    const segments = corridor.split("->");
    if (segments.length < 2) return null;
    const sellStation = segments[segments.length - 1]?.trim();
    return sellStation ? sellStation : null;
  };

  const output: string[] = [];
  if (input.originLabel?.trim()) output.push(`Origin: ${input.originLabel.trim()}`);
  if (input.manifest.summary) {
    const summary = input.manifest.summary;
    const sellStation = resolveSellStation();
    if (sellStation) output.push(`Sell Station: ${sellStation}`);
    const summaryLinesByKey: Record<(typeof ROUTE_SUMMARY_FORMAT_ORDER)[number], string> = {
      "Cargo m3": `Cargo m3: ${formatVolume(summary.total_volume_m3)} m3`,
      Stations: `Stations: ${formatQuantity(summary.station_count)}`,
      Items: `Items: ${formatQuantity(summary.item_count)}`,
      "Total volume": `Total volume: ${formatVolume(summary.total_volume_m3)} m3`,
      "Total capital": `Total capital: ${formatInteger(summary.total_buy_isk)} ISK`,
      "Total gross sell": `Total gross sell: ${formatInteger(summary.total_sell_isk)} ISK`,
      "Total profit": `Total profit: ${formatInteger(summary.total_profit_isk)} ISK`,
      "Total isk/jump": `Total isk/jump: ${formatOptionalInteger(summary.isk_per_jump)} ISK`,
    };
    output.push(...ROUTE_SUMMARY_FORMAT_ORDER.map((key) => summaryLinesByKey[key]));
  }

  // Keep hop order stable by preserving the input sequence explicitly.
  const stationsInOutputOrder = input.manifest.stations.map((station) => station);
  for (const [index, station] of stationsInOutputOrder.entries()) {
    if (output.length > 0) output.push("");
    if (index > 0) output.push(HOP_SEPARATOR);

    const hopLinesByKey: Record<(typeof HOP_FORMAT_ORDER)[number], string> = {
      "Buy Station": `Buy Station: ${station.buy_station_name}`,
      "Jumps to Buy Station": `Jumps to Buy Station: ${formatOptionalQuantity(station.jumps_to_buy_station)}`,
      "Sell Station": `Sell Station: ${station.sell_station_name ?? resolveSellStation() ?? "Unknown Station"}`,
      "Jumps Buy -> Sell": `Jumps Buy -> Sell: ${formatOptionalQuantity(station.jumps_buy_to_sell)}`,
      "Cargo m3": `Cargo m3: ${formatVolume(station.cargo_m3 ?? input.manifest.summary?.total_volume_m3 ?? 0)} m3`,
      Items: `Items: ${formatQuantity(station.item_count)}`,
      "Total volume": `Total volume: ${formatVolume(station.total_volume_m3)} m3`,
      "Total capital": `Total capital: ${formatInteger(station.total_buy_isk)} ISK`,
      "Total gross sell": `Total gross sell: ${formatInteger(station.total_sell_isk)} ISK`,
      "Total profit": `Total profit: ${formatInteger(station.total_profit_isk)} ISK`,
      "Total isk/jump": `Total isk/jump: ${formatOptionalInteger(station.isk_per_jump)} ISK`,
    };
    output.push(...HOP_FORMAT_ORDER.map((key) => hopLinesByKey[key]));

    if (station.lines.length > 0) output.push("");
    for (const line of station.lines) output.push(formatStationLine(line));
    if (station.lines.length > 0) {
      output.push("");
      output.push(
        ...formatBatchLinesToMultibuyLines(
          station.lines.map((line) => ({ typeName: line.type_name, units: line.units })),
        ),
      );
    }
  }
  return output.join("\n");
}
