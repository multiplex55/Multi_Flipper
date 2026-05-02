import type { FlipResult } from "@/lib/types";

export type RadiusBuyRecommendationKind = "cargo_build" | "buy_station_list" | "single_row" | "route_group" | "rejected_cargo_build";
export type RadiusRecommendationSourcePackageKind = "route_batch" | "cargo_build" | "single_row" | "buy_station_child" | "near_miss";
export type RadiusBuyRecommendationAction = "buy" | "verify" | "trim" | "watch";

export type BuyPlannerMode = "balanced" | "batch_profit" | "batch_isk_per_jump" | "cargo_fill" | "long_haul_worth" | "low_capital";

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


export type RadiusBuyRecommendationPackageMetrics = {
  averageFillConfidencePct: number;
  worstFillConfidencePct: number;
  riskCount: number;
  weightedSlippagePct: number;
  verificationCoveragePct: number;
  batchProfitIsk: number;
  batchCapitalIsk: number;
  batchGrossSellIsk: number;
  batchIskPerJump: number;
  batchRoiPercent: number;
  cargoUsedPercent: number;
  totalJumps: number;
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
  selectedLineKeys?: string[];
  sourcePackageKind?: RadiusRecommendationSourcePackageKind;
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
  packageMetrics: RadiusBuyRecommendationPackageMetrics;
  verificationSlots?: string[];
  verificationState?: {
    status: "not_verified" | "verified" | "stale" | "failed";
    checkedAt?: string;
    failedLineCount?: number;
    priceDeltaIsk?: number;
    profitDeltaIsk?: number;
  };
  scoreBreakdown?: Record<string, number> | Record<string, unknown>;
};
