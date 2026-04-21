import type { FlipResult } from "@/lib/types";

export type RadiusHubFilter = {
  side: "buy" | "sell";
  systemId: number | null;
};

export function filterRadiusResultsByHub(
  rows: FlipResult[],
  filter: RadiusHubFilter | null,
): FlipResult[] {
  if (!filter || !filter.systemId || filter.systemId <= 0) return rows;
  if (filter.side === "buy") {
    return rows.filter((row) => row.BuySystemID === filter.systemId);
  }
  return rows.filter((row) => row.SellSystemID === filter.systemId);
}
