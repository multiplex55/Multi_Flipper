import { computeHopMetrics, computeRouteMetrics } from "@/lib/routeMetrics";
import type { RouteResult } from "@/lib/types";

export interface NormalizedRouteCopyManifestHop {
  fromLabel: string;
  itemName: string;
  units: number;
  buyPrice: number;
  emptyJumps: number;
  tradeJumps: number;
  totalJumps: number;
  destinationSystemName: string;
  sellPrice: number;
  realProfit: number;
  iskPerJump: number;
}

export interface NormalizedRouteCopyManifest {
  summaryLines: string[];
  hops: NormalizedRouteCopyManifestHop[];
}

function formatISK(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}

function formatISKFull(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function buildRouteSummary(route: RouteResult): string {
  return route.Hops
    .map((h) => h.SystemName)
    .concat([route.Hops[route.Hops.length - 1]?.DestSystemName ?? ""])
    .concat(route.TargetSystemName ? [route.TargetSystemName] : [])
    .filter(Boolean)
    .join(" -> ");
}

export function buildNormalizedRouteCopyManifest(route: RouteResult): NormalizedRouteCopyManifest {
  const routeMetrics = computeRouteMetrics(route);
  const summaryLines = [
    `Route: ${buildRouteSummary(route)}`,
    `Total Real Profit: ${formatISKFull(routeMetrics.totalRealProfit)} ISK`,
    `Total jumps: ${routeMetrics.totalJumps}`,
    `ISK/jump: ${formatISK(routeMetrics.iskPerJump)} ISK/jump`,
    `Avg Hop ISK/jump: ${formatISK(routeMetrics.averageIskPerJump)} ISK/jump`,
  ];

  return {
    summaryLines,
    hops: route.Hops.map((hop) => {
      const hopMetrics = computeHopMetrics(hop);
      const emptyJumps = hop.EmptyJumps ?? 0;
      const tradeJumps = hop.Jumps;
      return {
        fromLabel: hop.StationName || hop.SystemName,
        itemName: hop.TypeName,
        units: hop.Units,
        buyPrice: hop.BuyPrice,
        emptyJumps,
        tradeJumps,
        totalJumps: tradeJumps + emptyJumps,
        destinationSystemName: hop.DestSystemName,
        sellPrice: hop.SellPrice,
        realProfit: hopMetrics.realProfit,
        iskPerJump: hopMetrics.iskPerJump,
      };
    }),
  };
}

export function formatNormalizedRouteCopyManifest(
  manifest: NormalizedRouteCopyManifest,
  options?: { includeRouteSummary?: boolean },
): string {
  const includeRouteSummary = options?.includeRouteSummary ?? true;
  const lines: string[] = [];

  if (includeRouteSummary && manifest.summaryLines.length > 0) {
    lines.push(...manifest.summaryLines);
    if (manifest.hops.length > 0) {
      lines.push("---");
    }
  }

  manifest.hops.forEach((hop, index) => {
    lines.push(`Hop ${index + 1}`);
    lines.push(`From: ${hop.fromLabel}`);
    lines.push(`Item: ${hop.itemName} x${hop.units}`);
    lines.push(`Buy @ ${formatISKFull(hop.buyPrice)} ISK`);
    if (hop.emptyJumps > 0) {
      lines.push(`Empty move jumps: ${hop.emptyJumps}`);
    }
    lines.push(`To: ${hop.destinationSystemName}`);
    lines.push(`Jumps: ${hop.totalJumps} (trade ${hop.tradeJumps})`);
    lines.push(`Sell @ ${formatISKFull(hop.sellPrice)} ISK`);
    lines.push(`Real Profit: ${formatISKFull(hop.realProfit)} ISK`);
    lines.push(`Hop ISK/jump: ${formatISK(hop.iskPerJump)} ISK/jump`);
    if (index < manifest.hops.length - 1) {
      lines.push("");
    }
  });

  return lines.join("\n");
}
