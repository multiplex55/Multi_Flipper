import type { RouteHop, RouteHopItem, RouteResult } from "@/lib/types";

const EPSILON = 1e-9;

export interface RouteItemMetrics {
  typeId: number;
  typeName: string;
  units: number;
  buyCost: number;
  sellValue: number;
  attributableCosts: number;
  realProfit: number;
}

export interface RouteHopMetrics {
  buyCost: number;
  sellValue: number;
  attributableCosts: number;
  realProfit: number;
  jumps: number;
  iskPerJump: number;
  marginPercent: number;
  topItem?: RouteItemMetrics;
  minItemProfit: number;
  maxItemProfit: number;
}

export interface RouteMetrics {
  totalBuyCost: number;
  totalSellValue: number;
  totalAttributableCosts: number;
  totalRealProfit: number;
  totalJumps: number;
  iskPerJump: number;
  averageIskPerJump: number;
  profitMarginPercent: number;
  profitVolatilityRange: number;
  topRouteItem?: RouteItemMetrics;
  breakEvenJumps: number | null;
  hopMetrics: RouteHopMetrics[];
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sumAttributedCosts(source: Partial<RouteHopItem | RouteHop>): number {
  return (
    toFiniteNumber((source as any).Fees) +
    toFiniteNumber((source as any).Fee) +
    toFiniteNumber((source as any).Taxes) +
    toFiniteNumber((source as any).Tax) +
    toFiniteNumber((source as any).TransactionCosts) +
    toFiniteNumber((source as any).TransactionCost) +
    toFiniteNumber((source as any).AttributableCosts)
  );
}

function buildItemMetrics(item: RouteHopItem): RouteItemMetrics {
  const units = Math.max(0, toFiniteNumber(item.Units));
  const buyCost = toFiniteNumber(item.BuyCost, units * toFiniteNumber(item.BuyPrice));
  const sellValue = toFiniteNumber(item.SellValue, units * toFiniteNumber(item.SellPrice));
  const attributableCosts = sumAttributedCosts(item);
  const realProfit = sellValue - buyCost - attributableCosts;
  return {
    typeId: toFiniteNumber(item.TypeID),
    typeName: item.TypeName,
    units,
    buyCost,
    sellValue,
    attributableCosts,
    realProfit,
  };
}

export function computeHopMetrics(hop: RouteHop): RouteHopMetrics {
  const items = (hop.Items ?? []).map(buildItemMetrics);
  const hopFallbackAttribution = sumAttributedCosts(hop);
  const buyCost = items.reduce((sum, item) => sum + item.buyCost, 0);
  const sellValue = items.reduce((sum, item) => sum + item.sellValue, 0);
  const itemCosts = items.reduce((sum, item) => sum + item.attributableCosts, 0);
  const attributableCosts = itemCosts > EPSILON ? itemCosts : hopFallbackAttribution;
  const realProfit = sellValue - buyCost - attributableCosts;
  const jumps = Math.max(0, toFiniteNumber(hop.Jumps) + toFiniteNumber(hop.EmptyJumps));
  const iskPerJump = jumps > 0 ? realProfit / jumps : 0;
  const marginPercent = buyCost > 0 ? (realProfit / buyCost) * 100 : 0;

  const sortedByProfit = [...items].sort((left, right) => right.realProfit - left.realProfit);
  const topItem = sortedByProfit[0];
  const itemProfits = items.map((item) => item.realProfit);
  const minItemProfit = itemProfits.length ? Math.min(...itemProfits) : 0;
  const maxItemProfit = itemProfits.length ? Math.max(...itemProfits) : 0;

  return {
    buyCost,
    sellValue,
    attributableCosts,
    realProfit,
    jumps,
    iskPerJump,
    marginPercent,
    topItem,
    minItemProfit,
    maxItemProfit,
  };
}

export function computeRouteMetrics(route: RouteResult): RouteMetrics {
  const hopMetrics = (route.Hops ?? []).map(computeHopMetrics);
  const totalBuyCost = hopMetrics.reduce((sum, hop) => sum + hop.buyCost, 0);
  const totalSellValue = hopMetrics.reduce((sum, hop) => sum + hop.sellValue, 0);
  const totalAttributableCosts = hopMetrics.reduce((sum, hop) => sum + hop.attributableCosts, 0);
  const totalRealProfit = totalSellValue - totalBuyCost - totalAttributableCosts;
  const totalJumps = Math.max(0, route.TotalJumps ?? hopMetrics.reduce((sum, hop) => sum + hop.jumps, 0));
  const iskPerJump = totalJumps > 0 ? totalRealProfit / totalJumps : 0;
  const averageIskPerJump = hopMetrics.length > 0
    ? hopMetrics.reduce((sum, hop) => sum + hop.iskPerJump, 0) / hopMetrics.length
    : 0;
  const profitMarginPercent = totalBuyCost > 0 ? (totalRealProfit / totalBuyCost) * 100 : 0;
  const hopProfits = hopMetrics.map((hop) => hop.realProfit);
  const profitVolatilityRange = hopProfits.length > 0 ? Math.max(...hopProfits) - Math.min(...hopProfits) : 0;

  const itemAccumulator = new Map<number, RouteItemMetrics>();
  hopMetrics.forEach((hop) => {
    if (!hop.topItem) return;
    const existing = itemAccumulator.get(hop.topItem.typeId);
    if (!existing) {
      itemAccumulator.set(hop.topItem.typeId, { ...hop.topItem });
      return;
    }
    existing.buyCost += hop.topItem.buyCost;
    existing.sellValue += hop.topItem.sellValue;
    existing.attributableCosts += hop.topItem.attributableCosts;
    existing.realProfit += hop.topItem.realProfit;
    existing.units += hop.topItem.units;
  });
  const topRouteItem = [...itemAccumulator.values()].sort((left, right) => right.realProfit - left.realProfit)[0];

  const breakEvenJumps = iskPerJump > EPSILON ? totalBuyCost / iskPerJump : null;

  return {
    totalBuyCost,
    totalSellValue,
    totalAttributableCosts,
    totalRealProfit,
    totalJumps,
    iskPerJump,
    averageIskPerJump,
    profitMarginPercent,
    profitVolatilityRange,
    topRouteItem,
    breakEvenJumps,
    hopMetrics,
  };
}

export function applyRouteMetrics(route: RouteResult): RouteResult {
  const metrics = computeRouteMetrics(route);
  return {
    ...route,
    TotalProfit: metrics.totalRealProfit,
    TotalJumps: metrics.totalJumps,
    ProfitPerJump: metrics.iskPerJump,
    HopCount: route.Hops?.length ?? 0,
  };
}
