import type { RouteHop, RouteHopItem, RouteResult } from "@/lib/types";
import type { BanlistState } from "@/lib/banlist";

function normalizeHopItem(item: Partial<RouteHopItem>): RouteHopItem | null {
  const typeId = Number(item.TypeID ?? 0);
  const units = Number(item.Units ?? 0);
  const buyPrice = Number(item.BuyPrice ?? 0);
  const sellPrice = Number(item.SellPrice ?? 0);
  if (!Number.isFinite(typeId) || typeId <= 0 || !Number.isFinite(units) || units <= 0) return null;
  const buyCost = Number.isFinite(Number(item.BuyCost)) && Number(item.BuyCost) > 0 ? Number(item.BuyCost) : units * buyPrice;
  const sellValue = Number.isFinite(Number(item.SellValue)) && Number(item.SellValue) > 0 ? Number(item.SellValue) : units * sellPrice;
  const profit = Number.isFinite(Number(item.Profit)) && Number(item.Profit) !== 0 ? Number(item.Profit) : sellValue - buyCost;
  const marginPercent = buyCost > 0 ? (profit / buyCost) * 100 : 0;
  return {
    TypeID: typeId,
    TypeName: (item.TypeName ?? "").trim() || `Type ${typeId}`,
    Units: units,
    BuyPrice: buyPrice,
    SellPrice: sellPrice,
    BuyCost: buyCost,
    SellValue: sellValue,
    Profit: profit,
    MarginPercent: Number.isFinite(Number(item.MarginPercent)) ? Number(item.MarginPercent) : marginPercent,
  };
}

export function normalizeRouteHop(hop: RouteHop): RouteHop {
  const normalizedItems = (Array.isArray(hop.Items) ? hop.Items : [])
    .map((item) => normalizeHopItem(item))
    .filter((item): item is RouteHopItem => item !== null);
  const legacy = normalizeHopItem({
    TypeID: hop.TypeID,
    TypeName: hop.TypeName,
    Units: hop.Units,
    BuyPrice: hop.BuyPrice,
    SellPrice: hop.SellPrice,
    Profit: hop.Profit,
  });
  const items = normalizedItems.length > 0 ? normalizedItems : legacy ? [legacy] : [];
  const primary = items[0] ?? legacy;
  const buyCost = items.reduce((sum, item) => sum + (item.BuyCost ?? item.Units * item.BuyPrice), 0);
  const sellValue = items.reduce((sum, item) => sum + (item.SellValue ?? item.Units * item.SellPrice), 0);
  const profit = items.reduce((sum, item) => sum + item.Profit, 0);

  return {
    ...hop,
    Items: items,
    TypeID: primary?.TypeID ?? hop.TypeID,
    TypeName: primary?.TypeName ?? hop.TypeName,
    Units: primary?.Units ?? hop.Units,
    BuyPrice: primary?.BuyPrice ?? hop.BuyPrice,
    SellPrice: primary?.SellPrice ?? hop.SellPrice,
    BuyCost: buyCost > 0 ? buyCost : hop.BuyCost,
    SellValue: sellValue > 0 ? sellValue : hop.SellValue,
    Profit: profit > 0 ? profit : hop.Profit,
  };
}

export function normalizeRouteResults(results: RouteResult[]): RouteResult[] {
  return (results ?? []).map((route) => ({
    ...route,
    Hops: (route.Hops ?? []).map(normalizeRouteHop),
  }));
}

export function filterRouteResultsByBanlistItems(results: RouteResult[], banlist?: BanlistState): RouteResult[] {
  if (!banlist || banlist.entries.length === 0) return normalizeRouteResults(results);
  return normalizeRouteResults(results)
    .map((route) => ({
      ...route,
      Hops: (route.Hops ?? [])
        .map((hop) => ({
          ...hop,
          Items: (hop.Items ?? []).filter((item) => !banlist.byId[item.TypeID]),
        }))
        .filter((hop) => (hop.Items?.length ?? 0) > 0)
        .map((hop) => normalizeRouteHop(hop)),
    }))
    .filter((route) => (route.Hops?.length ?? 0) > 0);
}
