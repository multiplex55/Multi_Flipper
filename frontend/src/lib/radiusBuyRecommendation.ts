import type { FlipResult } from "@/lib/types";

export type RadiusBuyRecommendationKind = "cargo_build" | "buy_station_list" | "single_row" | "route_group" | "rejected_cargo_build";
export type RadiusBuyRecommendationAction = "buy" | "verify" | "trim" | "watch";

export type RadiusBuyRecommendationLine = {
  typeId: number;
  typeName: string;
  qty: number;
  unitVolumeM3: number;
  volumeM3: number;
  buyUnitIsk: number;
  sellUnitIsk: number;
  profitUnitIsk: number;
  buyTotalIsk: number;
  sellTotalIsk: number;
  profitTotalIsk: number;
  routeKey: string;
  row?: FlipResult;
};

export type RadiusBuyRecommendationRejectedDiagnostic = {
  kind: string;
  message: string;
  actual?: number;
  required?: number;
  severity?: number;
};

export type RadiusBuyRecommendation = {
  id: string;
  kind: RadiusBuyRecommendationKind;
  action: RadiusBuyRecommendationAction;
  title: string;
  routeKey?: string;
  lines: RadiusBuyRecommendationLine[];
  reasons: string[];
  warnings: string[];
  blockers: string[];
  diagnostics?: RadiusBuyRecommendationRejectedDiagnostic[];
  jumpsToBuyStation: number;
  jumpsBuyToSell: number;
  totalJumps: number;
  cargoCapacityM3: number;
  totalVolumeM3: number;
  remainingCargoM3: number;
  cargoUsedPercent: number;
  batchProfitIsk: number;
  batchCapitalIsk: number;
  batchGrossSellIsk: number;
  batchIskPerJump: number;
  batchRoiPercent: number;
  verificationSlots?: string[];
  scoreBreakdown?: Record<string, number>;
};
