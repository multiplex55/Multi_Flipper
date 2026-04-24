import type { FlipResult } from "@/lib/types";

export type RouteHandoffEntryAction = "planner" | "validation" | "cargo";
export type RouteWorkspaceIntent = "open-workbench" | "open-validate" | "finder";

export interface RouteHandoffLegContext {
  buyLocationID: number;
  sellLocationID: number;
  buySystemID: number;
  sellSystemID: number;
  buySystemName: string;
  sellSystemName: string;
  buyStationName: string;
  sellStationName: string;
  totalJumps: number;
  profitPerJump: number;
  routeKey: string;
}

export interface RouteHandoffContext {
  source: "scanner";
  routeKey: string;
  routeLabel: string;
  legContexts: RouteHandoffLegContext[];
  preferredEntryAction: RouteHandoffEntryAction;
  intent: RouteWorkspaceIntent;
  preferredSection?: "summary" | "execution" | "filler" | "verification";
}

export function buildRouteManifestFromFlipRows(rows: FlipResult[]): string {
  if (rows.length === 0) return "";
  const first = rows[0];
  const header = [
    "Scanner Route Handoff",
    `Buy: ${first.BuySystemName} / ${first.BuyStation}`,
    `Sell: ${first.SellSystemName} / ${first.SellStation}`,
    "",
    "Items",
  ];
  const lines = rows.map((row) => {
    const qty = Number.isFinite(row.UnitsToBuy) ? row.UnitsToBuy : 0;
    return `${row.TypeName} ${Math.max(0, Math.floor(qty))}`;
  });
  return [...header, ...lines].join("\n");
}
