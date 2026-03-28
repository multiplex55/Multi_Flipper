import type { BatchLine } from "@/lib/batchMetrics";
import type { OrderedRouteManifest, RouteResult } from "@/lib/types";

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

export function formatOrderedRouteManifestText(input: {
  originLabel?: string;
  metadataHeader?: RouteMetadataHeaderInput;
  manifest: OrderedRouteManifest;
  t?: (key: BaseManifestTranslationKey, vars?: Record<string, string | number>) => string;
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
    output.push(`Cargo m3: ${formatVolume(summary.total_volume_m3)} m3`);
    output.push(`Stations: ${formatQuantity(summary.station_count)}`);
    output.push(`Items: ${formatQuantity(summary.item_count)}`);
    output.push(`Total volume: ${formatVolume(summary.total_volume_m3)} m3`);
    output.push(`Total capital: ${formatInteger(summary.total_buy_isk)} ISK`);
    output.push(`Total gross sell: ${formatInteger(summary.total_sell_isk)} ISK`);
    output.push(`Total profit: ${formatInteger(summary.total_profit_isk)} ISK`);
    output.push(`Total isk/jump: ${formatOptionalInteger(summary.isk_per_jump)} ISK`);
  }
  for (const [index, station] of input.manifest.stations.entries()) {
    if (output.length > 0) output.push("");
    if (index > 0) output.push("------------------------");
    const translate = input.t;
    const formatLabel = (
      key: BaseManifestTranslationKey,
      fallbackLabel: string,
      vars: Record<string, string | number>,
    ) => (translate ? translate(key, vars) : `${fallbackLabel}: ${Object.values(vars)[0]}`);
    output.push(
      formatLabel("batchBuilderManifestBuyStation", "Buy Station", {
        station: station.buy_station_name,
      }),
    );
    output.push(
      formatLabel("batchBuilderManifestJumpsToBuyStation", "Jumps to Buy Station", {
        jumps: formatOptionalQuantity(station.jumps_to_buy_station),
      }),
    );
    output.push(
      formatLabel("batchBuilderManifestSellStation", "Sell Station", {
        station: station.sell_station_name ?? resolveSellStation() ?? "Unknown Station",
      }),
    );
    output.push(
      formatLabel("batchBuilderManifestJumpsBuyToSell", "Jumps Buy -> Sell", {
        jumps: formatOptionalQuantity(station.jumps_buy_to_sell),
      }),
    );
    output.push(
      `Cargo m3: ${formatVolume(station.cargo_m3 ?? input.manifest.summary?.total_volume_m3 ?? 0)} m3`,
    );
    output.push(`Items: ${formatQuantity(station.item_count)}`);
    output.push(`Total volume: ${formatVolume(station.total_volume_m3)} m3`);
    output.push(`Total capital: ${formatInteger(station.total_buy_isk)} ISK`);
    output.push(`Total gross sell: ${formatInteger(station.total_sell_isk)} ISK`);
    output.push(`Total profit: ${formatInteger(station.total_profit_isk)} ISK`);
    output.push(`Total isk/jump: ${formatOptionalInteger(station.isk_per_jump)} ISK`);
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

function withStationSystemLabel(stationName?: string, systemName?: string): string {
  const cleanedStation = stationName?.trim();
  const cleanedSystem = systemName?.trim();
  if (cleanedStation && cleanedSystem) return `${cleanedStation} (${cleanedSystem})`;
  if (cleanedStation) return `${cleanedStation} (Unknown System)`;
  if (cleanedSystem) return `Unknown Station (${cleanedSystem})`;
  return "Unknown Station (Unknown System)";
}

export function buildOrderedRouteManifestFromRouteResult(route: RouteResult): OrderedRouteManifest {
  const stations: OrderedRouteManifest["stations"] = route.Hops.map((hop, index) => {
    const units = Math.max(0, Math.trunc(hop.Units));
    const buyPer = Number.isFinite(hop.BuyPrice) ? hop.BuyPrice : 0;
    const sellPer = Number.isFinite(hop.SellPrice) ? hop.SellPrice : 0;
    const buyTotal = units * buyPer;
    const sellTotal = units * sellPer;
    const profit = Number.isFinite(hop.Profit) ? hop.Profit : sellTotal - buyTotal;
    const emptyJumps = hop.EmptyJumps ?? 0;
    return {
      station_key: `route-hop:${index}:${hop.SystemID}:${hop.DestSystemID}:${hop.TypeID}`,
      buy_station_name: withStationSystemLabel(hop.StationName, hop.SystemName),
      sell_station_name: withStationSystemLabel(hop.DestStationName, hop.DestSystemName),
      jumps_to_buy_station: index === 0 ? 0 : null,
      jumps_buy_to_sell: Math.max(0, hop.Jumps + emptyJumps),
      item_count: 1,
      total_volume_m3: 0,
      total_buy_isk: buyTotal,
      total_sell_isk: sellTotal,
      total_profit_isk: profit,
      isk_per_jump: hop.Jumps + emptyJumps > 0 ? profit / (hop.Jumps + emptyJumps) : null,
      lines: [
        {
          type_id: hop.TypeID,
          type_name: hop.TypeName || "Unknown Item",
          units,
          unit_volume_m3: 0,
          volume_m3: 0,
          buy_total_isk: buyTotal,
          buy_per_isk: buyPer,
          sell_total_isk: sellTotal,
          sell_per_isk: sellPer,
          profit_isk: profit,
        },
      ],
    };
  });

  const totalBuy = stations.reduce((sum, station) => sum + station.total_buy_isk, 0);
  const totalSell = stations.reduce((sum, station) => sum + station.total_sell_isk, 0);
  const totalProfit = stations.reduce((sum, station) => sum + station.total_profit_isk, 0);
  const totalJumps = route.TotalJumps;

  return {
    summary: {
      station_count: stations.length,
      item_count: stations.reduce((sum, station) => sum + station.item_count, 0),
      total_units: stations.reduce(
        (sum, station) => sum + station.lines.reduce((lineSum, line) => lineSum + line.units, 0),
        0,
      ),
      total_volume_m3: 0,
      total_buy_isk: totalBuy,
      total_sell_isk: totalSell,
      total_profit_isk: totalProfit,
      total_jumps: totalJumps,
      isk_per_jump: totalJumps > 0 ? totalProfit / totalJumps : 0,
    },
    stations,
  };
}
