import { normalizeRouteHop } from "@/lib/routeModels";
import type { OrderedRouteManifest, RouteHop, RouteHopItem, RouteResult } from "@/lib/types";

export type RouteManifestAdapterOptions = {
  cargoM3?: number | null;
  originLabel?: string;
};

export type AdaptedOrderedRouteManifestSummary = {
  origin_label?: string;
  route_hops_count: number;
  cargo_m3: number;
  items: number;
  total_volume_m3: number;
  total_buy_isk: number;
  total_sell_isk: number;
  total_profit_isk: number;
  total_isk_per_jump: number | null;
  total_jumps?: number;
  average_hop_isk_per_jump?: number | null;
};

export type AdaptedOrderedRouteManifest = {
  manifest: OrderedRouteManifest;
  summary: AdaptedOrderedRouteManifestSummary;
};

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNonNegativeNumber(value: unknown): number {
  return Math.max(0, toSafeNumber(value));
}

function toNonNegativeInteger(value: unknown): number {
  return Math.max(0, Math.trunc(toSafeNumber(value)));
}

function toKnownJump(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return Math.trunc(parsed);
}

function pickBuyStationName(hop: RouteHop): string {
  const stationName = hop.StationName?.trim();
  if (stationName) return stationName;
  const systemName = hop.SystemName?.trim();
  if (systemName) return systemName;
  return "Unknown buy station";
}

function pickSellStationName(hop: RouteHop, route: RouteResult): string {
  const destinationStation = hop.DestStationName?.trim();
  if (destinationStation) return destinationStation;
  const destinationSystem = hop.DestSystemName?.trim();
  if (destinationSystem) return destinationSystem;
  const targetSystem = route.TargetSystemName?.trim();
  if (targetSystem) return targetSystem;
  return "Unknown sell station";
}

function toLegacyItem(hop: RouteHop): RouteHopItem | null {
  const typeId = toNonNegativeInteger(hop.TypeID);
  const units = toNonNegativeInteger(hop.Units);
  if (typeId <= 0 || units <= 0) return null;

  const buyPrice = toNonNegativeNumber(hop.BuyPrice);
  const sellPrice = toNonNegativeNumber(hop.SellPrice);
  const buyCost = Math.max(0, toSafeNumber(hop.BuyCost) || units * buyPrice);
  const sellValue = Math.max(0, toSafeNumber(hop.SellValue) || units * sellPrice);
  const profit = Number.isFinite(Number(hop.Profit)) ? Number(hop.Profit) : sellValue - buyCost;

  return {
    TypeID: typeId,
    TypeName: hop.TypeName?.trim() || `Type ${typeId}`,
    Units: units,
    BuyPrice: buyPrice,
    SellPrice: sellPrice,
    BuyCost: buyCost,
    SellValue: sellValue,
    Profit: profit,
  };
}

function buildManifestLinesFromHop(hop: RouteHop): OrderedRouteManifest["stations"][number]["lines"] {
  const normalizedItems = Array.isArray(hop.Items) ? hop.Items : [];
  const sourceItems = normalizedItems.length > 0 ? normalizedItems : [toLegacyItem(hop)].filter((item): item is RouteHopItem => item != null);

  return sourceItems.map((item) => {
    const units = toNonNegativeInteger(item.Units);
    const buyTotal = Math.max(0, toSafeNumber(item.BuyCost) || units * toNonNegativeNumber(item.BuyPrice));
    const sellTotal = Math.max(0, toSafeNumber(item.SellValue) || units * toNonNegativeNumber(item.SellPrice));
    const profit = Number.isFinite(Number(item.Profit)) ? Number(item.Profit) : sellTotal - buyTotal;
    const volumeM3 = 0;

    return {
      type_id: toNonNegativeInteger(item.TypeID),
      type_name: item.TypeName?.trim() || `Type ${toNonNegativeInteger(item.TypeID)}`,
      units,
      unit_volume_m3: 0,
      volume_m3: volumeM3,
      buy_total_isk: buyTotal,
      buy_per_isk: units > 0 ? buyTotal / units : 0,
      sell_total_isk: sellTotal,
      sell_per_isk: units > 0 ? sellTotal / units : 0,
      profit_isk: profit,
    };
  });
}

export function adaptRouteResultToOrderedRouteManifest(
  route: RouteResult,
  options?: RouteManifestAdapterOptions,
): AdaptedOrderedRouteManifest {
  const normalizedHops = (route.Hops ?? []).map((hop) => normalizeRouteHop(hop));

  let cumulativePriorTradeJumps: number | null = 0;
  const stations = normalizedHops.map((hop, hopIndex) => {
    const lines = buildManifestLinesFromHop(hop);
    const totalVolumeM3 = lines.reduce((acc, line) => acc + line.volume_m3, 0);
    const totalBuyIsk = lines.reduce((acc, line) => acc + line.buy_total_isk, 0);
    const totalSellIsk = lines.reduce((acc, line) => acc + line.sell_total_isk, 0);
    const totalProfitIsk = lines.reduce((acc, line) => acc + line.profit_isk, 0);
    const itemCount = lines.length;

    const jumpsToBuyStation = hopIndex === 0 ? 0 : cumulativePriorTradeJumps;
    const jumpsBuyToSell = toKnownJump(hop.Jumps);
    const stationJumps =
      jumpsToBuyStation != null && jumpsBuyToSell != null ? jumpsToBuyStation + jumpsBuyToSell : null;

    if (cumulativePriorTradeJumps != null && jumpsBuyToSell != null) {
      cumulativePriorTradeJumps += jumpsBuyToSell;
    } else {
      cumulativePriorTradeJumps = null;
    }

    return {
      station_key: `route-hop:${hopIndex + 1}:${toNonNegativeInteger(hop.SystemID)}`,
      buy_station_name: pickBuyStationName(hop),
      sell_station_name: pickSellStationName(hop, route),
      cargo_m3: toNonNegativeNumber(options?.cargoM3),
      jumps_to_buy_station: jumpsToBuyStation,
      jumps_buy_to_sell: jumpsBuyToSell,
      item_count: itemCount,
      total_volume_m3: totalVolumeM3,
      total_buy_isk: totalBuyIsk,
      total_sell_isk: totalSellIsk,
      total_profit_isk: totalProfitIsk,
      isk_per_jump:
        stationJumps == null
          ? null
          : stationJumps > 0
            ? totalProfitIsk / stationJumps
            : 0,
      lines,
    };
  });

  const totalUnits = stations.reduce(
    (acc, station) => acc + station.lines.reduce((lineAcc, line) => lineAcc + line.units, 0),
    0,
  );
  const totalVolumeM3 = stations.reduce((acc, station) => acc + station.total_volume_m3, 0);
  const totalBuyIsk = stations.reduce((acc, station) => acc + station.total_buy_isk, 0);
  const totalSellIsk = stations.reduce((acc, station) => acc + station.total_sell_isk, 0);
  const totalProfitIsk = stations.reduce((acc, station) => acc + station.total_profit_isk, 0);
  const totalItems = stations.reduce((acc, station) => acc + station.item_count, 0);

  const totalJumps = toKnownJump(route.TotalJumps);
  const totalIskPerJump =
    totalJumps != null
      ? totalJumps > 0
        ? totalProfitIsk / totalJumps
        : 0
      : Number.isFinite(Number(route.ProfitPerJump))
        ? Number(route.ProfitPerJump)
        : null;

  const hopsWithKnownIskPerJump = stations
    .map((station) => station.isk_per_jump)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const averageHopIskPerJump =
    hopsWithKnownIskPerJump.length > 0
      ? hopsWithKnownIskPerJump.reduce((acc, value) => acc + value, 0) / hopsWithKnownIskPerJump.length
      : null;

  const cargoM3 =
    options?.cargoM3 != null && Number.isFinite(options.cargoM3)
      ? Math.max(0, options.cargoM3)
      : totalVolumeM3;

  const manifest: OrderedRouteManifest = {
    summary: {
      station_count: stations.length,
      item_count: totalItems,
      total_units: totalUnits,
      total_volume_m3: totalVolumeM3,
      total_buy_isk: totalBuyIsk,
      total_sell_isk: totalSellIsk,
      total_profit_isk: totalProfitIsk,
      total_jumps: totalJumps ?? undefined,
      isk_per_jump: totalIskPerJump ?? undefined,
    },
    stations,
  };

  return {
    manifest,
    summary: {
      origin_label: options?.originLabel,
      route_hops_count: normalizedHops.length,
      cargo_m3: cargoM3,
      items: totalItems,
      total_volume_m3: totalVolumeM3,
      total_buy_isk: totalBuyIsk,
      total_sell_isk: totalSellIsk,
      total_profit_isk: totalProfitIsk,
      total_isk_per_jump: totalIskPerJump,
      total_jumps: totalJumps ?? undefined,
      average_hop_isk_per_jump: averageHopIskPerJump,
    },
  };
}
