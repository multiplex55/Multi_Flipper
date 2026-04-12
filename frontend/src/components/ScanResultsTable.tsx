import {
  Fragment,
  memo,
  startTransition,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type {
  FlipResult,
  StationCacheMeta,
  WatchlistItem,
  RouteState,
  SystemDanger,
  StrategyScoreConfig,
} from "@/lib/types";
import { formatISK, formatMargin } from "@/lib/format";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  buildRouteBatchMetadata,
  routeGroupKey,
  type RouteBatchMetadata,
} from "@/lib/batchMetrics";
import { routeSafetyRankFromState } from "@/lib/routeSafetySort";
import { calcRouteConfidence as calcRouteConfidenceFromInputs } from "@/lib/routeConfidence";
import {
  dailyIskPerJump,
  radiusRouteKey,
  realIskPerJump,
  realIskPerM3PerJump,
  routeRecommendationScoreFromMetrics,
  selectTopRoutePicks,
  deriveActionQueue,
  slippageCostIsk,
  type ActionQueueItem,
  type TopRoutePickCandidate,
  turnoverDays,
} from "@/lib/radiusMetrics";
import type { LoopOpportunity } from "@/lib/loopPlanner";
import {
  breakevenBufferForFlip,
  executionQualityForFlip,
  exitOverhangDays,
  hasDestinationPriceSpike,
} from "@/lib/executionQuality";
import {
  type BatchSyntheticKey,
  compareBatchSyntheticValues,
  formatBatchSyntheticCell,
  getBatchSyntheticValue,
  passesBatchNumericFilter,
} from "@/lib/scanTableBatchColumns";
import {
  addPinnedOpportunity,
  addToWatchlist,
  clearStationTradeStates,
  deleteStationTradeStates,
  getStationTradeStates,
  getGankCheck,
  getGankCheckBatch,
  getWatchlist,
  openMarketInGame,
  rebootStationCache,
  removeFromWatchlist,
  removePinnedOpportunity,
  listPinnedOpportunities,
  subscribePinnedOpportunityChanges,
  setStationTradeState,
  setWaypointInGame,
} from "@/lib/api";
import { useGlobalToast } from "./Toast";
import { EmptyState, type EmptyReason } from "./EmptyState";
import { ExecutionPlannerPopup } from "./ExecutionPlannerPopup";
import { handleEveUIError } from "@/lib/handleEveUIError";
import { BatchBuilderPopup } from "./BatchBuilderPopup";
import { RouteSafetyModal } from "./RouteSafetyModal";
import {
  buildFlipScoreContext,
  scoreFlipResult,
  strategyScoreToOpportunityProfile,
  type OpportunityScanContext,
  type OpportunityWeightProfile,
} from "@/lib/opportunityScore";
import { OpportunityScoreDetails } from "./OpportunityScorePopover";
import { mapScanRowToPinnedOpportunity } from "@/lib/pinnedOpportunityMapper";
import {
  filterRowsBySessionStationIgnores,
  isFlipResultDeprioritized,
  type SessionStationFilters,
} from "@/lib/banlistFilters";
import {
  DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
  DEFAULT_MAJOR_HUB_SYSTEMS,
  ENDPOINT_PREFERENCE_PRESETS,
  EndpointPreferenceApplicationMode,
  evaluateEndpointPreferences,
  normalizeMajorHubSystems,
  type EndpointPreferenceEvaluation,
  type EndpointPreferenceProfile,
} from "@/lib/endpointPreferences";
import { RadiusInsightsPanel } from "./RadiusInsightsPanel";

const PAGE_SIZE = 100;
const GROUP_PAGE_SIZE = 50; // rows shown per group before "Show all" button

// Module-level cache: type IDs whose icon failed to load (avoid repeated 404s)
const failedIconIds = new Set<number>();
const CACHE_TTL_FALLBACK_MS = 20 * 60 * 1000;
const COLUMN_PREFS_STORAGE_PREFIX = "eve-scan-columns:v1:";
const ITEM_GROUPING_STORAGE_KEY = "eve-radius-group-by-item:v1";
const ROUTE_GROUPING_STORAGE_KEY = "eve-radius-route-view-mode:v1";
const ENDPOINT_PREFS_STORAGE_KEY = "eve-radius-endpoint-preferences:v1";
const ADVANCED_TOOLBAR_VISIBLE_STORAGE_KEY =
  "eve-radius-advanced-toolbar-visible:v1";

type SyntheticSortKey =
  | "RouteSafety"
  | "BatchNumber"
  | "BatchProfit"
  | "BatchTotalCapital"
  | "BatchIskPerJump"
  | "RoutePackItemCount"
  | "RoutePackTotalProfit"
  | "RoutePackTotalCapital"
  | "RoutePackTotalVolume"
  | "RoutePackCapacityUsedPercent"
  | "RoutePackRealIskPerJump"
  | "RoutePackDailyIskPerJump"
  | "RoutePackDailyProfit"
  | "RoutePackRealIskPerM3PerJump"
  | "RoutePackDailyProfitOverCapital"
  | "RoutePackWeightedSlippagePct"
  | "RoutePackWeakestExecutionQuality"
  | "RoutePackTurnoverDays"
  | "RoutePackExitOverhangDays"
  | "RoutePackBreakevenBuffer"
  | "RoutePackRiskSpikeCount"
  | "RoutePackRiskNoHistoryCount"
  | "RoutePackRiskUnstableHistoryCount"
  | "RoutePackTotalRiskCount"
  | "RoutePackRecommendationScore"
  | "OpportunityScore"
  | "ExecutionQuality"
  | "ExitOverhangDays"
  | "BreakevenBuffer"
  | "RealIskPerJump"
  | "DailyIskPerJump"
  | "RealIskPerM3PerJump"
  | "TurnoverDays"
  | "SlippageCostIsk";
type SortKey = keyof FlipResult | SyntheticSortKey;
type SortDir = "asc" | "desc";
type RegionGroupSortMode = "period_profit" | "now_profit" | "trade_score";
type HiddenMode = "done" | "ignored";
type HiddenFilterTab = "all" | "done" | "ignored";
type TrackedVisibilityMode = "all" | "tracked_only" | "hide_non_tracked";
type DecisionLensPreset =
  | "recommended"
  | "best_route_pack"
  | "fastest_isk"
  | "cargo"
  | "safest"
  | "capital_efficient";

type HiddenFlipEntry = {
  key: string;
  mode: HiddenMode;
  updatedAt: string;
  typeName: string;
  buyStation: string;
  sellStation: string;
  stateTypeID: number;
  stateStationID: number;
  stateRegionID: number;
};

type CacheMetaView = {
  currentRevision: number;
  lastRefreshAt: number;
  nextExpiryAt: number;
  scopeLabel: string;
  regionCount: number;
};

function trackedRecommendationBonus(params: {
  trackedShare: number;
  baselineRecommendationScore: number;
  bestTrackedRowScore: number;
}): number {
  const trackedShare = Math.max(0, Math.min(1, params.trackedShare));
  if (trackedShare <= 0) return 0;
  const baselineGate = Math.max(
    0,
    Math.min(1, (params.baselineRecommendationScore - 35) / 45),
  );
  if (baselineGate <= 0) return 0;
  const trackedRowQualityGate = Math.max(
    0,
    Math.min(1, (params.bestTrackedRowScore - 50) / 35),
  );
  const rawBonus = trackedShare * 7 + trackedRowQualityGate * 5;
  return Math.min(9, rawBonus * baselineGate);
}

function getBuyLocationID(row: FlipResult): number {
  return Math.trunc(row.BuyLocationID ?? 0);
}

function getSellLocationID(row: FlipResult): number {
  return Math.trunc(row.SellLocationID ?? 0);
}

interface Props {
  results: FlipResult[];
  scanning: boolean;
  progress: string;
  cacheMeta?: StationCacheMeta | null;
  tradeStateTab?: "radius" | "region";
  scanCompletedWithZero?: boolean;
  salesTaxPercent?: number;
  brokerFeePercent?: number;
  splitTradeFees?: boolean;
  buyBrokerFeePercent?: number;
  sellBrokerFeePercent?: number;
  buySalesTaxPercent?: number;
  sellSalesTaxPercent?: number;
  showRegions?: boolean;
  columnProfile?: "default" | "region_eveguru";
  isLoggedIn?: boolean;
  cargoLimit?: number;
  originSystemName?: string;
  minRouteSecurity?: number;
  includeStructures?: boolean;
  routeMaxJumps?: number;
  maxDetourJumpsPerNode?: number;
  allowLowsec?: boolean;
  allowNullsec?: boolean;
  allowWormhole?: boolean;
  onOpenPriceValidation?: (manifestText: string) => void;
  strategyScore?: StrategyScoreConfig;
  loopOpportunities?: LoopOpportunity[];
  sessionStationFilters?: SessionStationFilters;
  onUpdateSessionStationFilters?: (
    updater: (prev: SessionStationFilters) => SessionStationFilters,
  ) => void;
}

type ColumnDef = {
  key: SortKey;
  labelKey: TranslationKey;
  width: string;
  numeric: boolean;
  tooltipKey?: TranslationKey;
};

/* ─── Column definitions ─── */

const baseColumnDefs: ColumnDef[] = [
  {
    key: "TypeName",
    labelKey: "colItem",
    width: "min-w-[180px]",
    numeric: false,
  },
  {
    key: "BuyPrice",
    labelKey: "colBuyPrice",
    width: "min-w-[120px]",
    numeric: true,
  },
  {
    key: "BestAskQty",
    labelKey: "colBestAskQty",
    width: "min-w-[90px]",
    numeric: true,
  },
  {
    key: "ExpectedBuyPrice",
    labelKey: "colExpectedBuyPrice",
    width: "min-w-[120px]",
    numeric: true,
  },
  {
    key: "RouteSafety" as SortKey,
    labelKey: "colRouteSafety",
    width: "min-w-[60px] w-[70px]",
    numeric: false,
    tooltipKey: "colRouteSafetyHint" as TranslationKey,
  },
  {
    key: "BuyStation",
    labelKey: "colBuyStation",
    width: "min-w-[150px]",
    numeric: false,
  },
  {
    key: "SellPrice",
    labelKey: "colSellPrice",
    width: "min-w-[120px]",
    numeric: true,
  },
  {
    key: "BestBidQty",
    labelKey: "colBestBidQty",
    width: "min-w-[90px]",
    numeric: true,
  },
  {
    key: "ExpectedSellPrice",
    labelKey: "colExpectedSellPrice",
    width: "min-w-[120px]",
    numeric: true,
  },
  {
    key: "SellStation",
    labelKey: "colSellStation",
    width: "min-w-[150px]",
    numeric: false,
  },
  {
    key: "MarginPercent",
    labelKey: "colMargin",
    width: "min-w-[80px]",
    numeric: true,
  },
  {
    key: "IskPerM3",
    labelKey: "colIskPerM3",
    width: "min-w-[90px]",
    numeric: true,
  },
  {
    key: "UnitsToBuy",
    labelKey: "colUnitsToBuy",
    width: "min-w-[80px]",
    numeric: true,
  },
  {
    key: "FilledQty",
    labelKey: "colFilledQty",
    width: "min-w-[80px]",
    numeric: true,
  },
  {
    key: "CanFill",
    labelKey: "colCanFill",
    width: "min-w-[70px]",
    numeric: false,
  },
  {
    key: "BuyOrderRemain",
    labelKey: "colAcceptQty",
    width: "min-w-[80px]",
    numeric: true,
  },
  {
    key: "RealProfit",
    labelKey: "colRealProfit",
    width: "min-w-[120px]",
    numeric: true,
  },
  {
    key: "RealIskPerJump",
    labelKey: "colRealIskPerJump",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colRealIskPerJumpHint",
  },
  {
    key: "DailyIskPerJump",
    labelKey: "colDailyIskPerJump",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colDailyIskPerJumpHint",
  },
  {
    key: "RealIskPerM3PerJump",
    labelKey: "colRealIskPerM3PerJump",
    width: "min-w-[135px]",
    numeric: true,
    tooltipKey: "colRealIskPerM3PerJumpHint",
  },
  {
    key: "TurnoverDays",
    labelKey: "colTurnoverDays",
    width: "min-w-[110px]",
    numeric: true,
    tooltipKey: "colTurnoverDaysHint",
  },
  {
    key: "SlippageCostIsk",
    labelKey: "colSlippageCostIsk",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colSlippageCostIskHint",
  },
  {
    key: "ExecutionQuality",
    labelKey: "colExecutionQuality" as TranslationKey,
    width: "min-w-[110px]",
    numeric: true,
    tooltipKey: "colExecutionQualityHint" as TranslationKey,
  },
  {
    key: "ExitOverhangDays",
    labelKey: "colExitOverhangDays" as TranslationKey,
    width: "min-w-[115px]",
    numeric: true,
    tooltipKey: "colExitOverhangDaysHint" as TranslationKey,
  },
  {
    key: "BreakevenBuffer",
    labelKey: "colBreakevenBuffer" as TranslationKey,
    width: "min-w-[110px]",
    numeric: true,
    tooltipKey: "colBreakevenBufferHint" as TranslationKey,
  },
  {
    key: "TotalProfit",
    labelKey: "colProfit",
    width: "min-w-[120px]",
    numeric: true,
  },
  {
    key: "BatchNumber",
    labelKey: "colBatchNumber",
    width: "min-w-[90px]",
    numeric: true,
  },
  {
    key: "BatchProfit",
    labelKey: "colBatchProfit",
    width: "min-w-[120px]",
    numeric: true,
  },
  {
    key: "BatchTotalCapital",
    labelKey: "colBatchTotalCapital",
    width: "min-w-[130px]",
    numeric: true,
  },
  {
    key: "BatchIskPerJump",
    labelKey: "colBatchIskPerJump",
    width: "min-w-[130px]",
    numeric: true,
  },
  {
    key: "RoutePackItemCount",
    labelKey: "colBatchNumber",
    width: "min-w-[110px]",
    numeric: true,
  },
  {
    key: "RoutePackTotalProfit",
    labelKey: "colBatchProfit",
    width: "min-w-[130px]",
    numeric: true,
  },
  {
    key: "RoutePackTotalCapital",
    labelKey: "colBatchTotalCapital",
    width: "min-w-[145px]",
    numeric: true,
  },
  {
    key: "RoutePackTotalVolume",
    labelKey: "colVolume",
    width: "min-w-[120px]",
    numeric: true,
  },
  {
    key: "RoutePackCapacityUsedPercent",
    labelKey: "colCanFill",
    width: "min-w-[120px]",
    numeric: true,
  },
  {
    key: "RoutePackRealIskPerJump",
    labelKey: "colRealIskPerJump",
    width: "min-w-[140px]",
    numeric: true,
  },
  {
    key: "RoutePackDailyIskPerJump",
    labelKey: "colDailyIskPerJump",
    width: "min-w-[145px]",
    numeric: true,
  },
  {
    key: "RoutePackDailyProfit",
    labelKey: "colDailyProfit",
    width: "min-w-[145px]",
    numeric: true,
  },
  {
    key: "RoutePackRealIskPerM3PerJump",
    labelKey: "colRealIskPerM3PerJump",
    width: "min-w-[170px]",
    numeric: true,
  },
  {
    key: "RoutePackDailyProfitOverCapital",
    labelKey: "colROI",
    width: "min-w-[160px]",
    numeric: true,
  },
  {
    key: "RoutePackWeightedSlippagePct",
    labelKey: "colWeightedSlippagePct",
    width: "min-w-[145px]",
    numeric: true,
  },
  {
    key: "RoutePackWeakestExecutionQuality",
    labelKey: "colExecutionQuality" as TranslationKey,
    width: "min-w-[150px]",
    numeric: true,
  },
  {
    key: "RoutePackTurnoverDays",
    labelKey: "colTurnoverDays",
    width: "min-w-[130px]",
    numeric: true,
  },
  {
    key: "RoutePackExitOverhangDays",
    labelKey: "colExitOverhangDays",
    width: "min-w-[150px]",
    numeric: true,
  },
  {
    key: "RoutePackBreakevenBuffer",
    labelKey: "colBreakevenBuffer",
    width: "min-w-[150px]",
    numeric: true,
  },
  {
    key: "OpportunityScore",
    labelKey: "colTradeScore",
    width: "min-w-[100px]",
    numeric: true,
  },
  {
    key: "ExpectedProfit",
    labelKey: "colExpectedProfit",
    width: "min-w-[100px]",
    numeric: true,
  },
  {
    key: "ProfitPerJump",
    labelKey: "colProfitPerJump",
    width: "min-w-[110px]",
    numeric: true,
  },
  {
    key: "BuyJumps",
    labelKey: "colBuyJumps",
    width: "min-w-[80px]",
    numeric: true,
  },
  {
    key: "TotalJumps",
    labelKey: "colJumps",
    width: "min-w-[60px]",
    numeric: true,
  },
  {
    key: "DailyVolume",
    labelKey: "colDailyVolume",
    width: "min-w-[80px]",
    numeric: true,
  },
  {
    key: "S2BPerDay",
    labelKey: "colS2BPerDay",
    width: "min-w-[90px]",
    numeric: true,
    tooltipKey: "colS2BPerDayHint",
  },
  {
    key: "BfSPerDay",
    labelKey: "colBfSPerDay",
    width: "min-w-[90px]",
    numeric: true,
    tooltipKey: "colBfSPerDayHint",
  },
  {
    key: "S2BBfSRatio",
    labelKey: "colS2BBfSRatio",
    width: "min-w-[90px]",
    numeric: true,
    tooltipKey: "colS2BBfSRatioHint",
  },
  {
    key: "DailyProfit",
    labelKey: "colDailyProfit",
    width: "min-w-[110px]",
    numeric: true,
  },
  {
    key: "PriceTrend",
    labelKey: "colPriceTrend",
    width: "min-w-[70px]",
    numeric: true,
  },
  {
    key: "BuyCompetitors",
    labelKey: "colBuyCompetitors",
    width: "min-w-[70px]",
    numeric: true,
  },
  {
    key: "SellCompetitors",
    labelKey: "colSellCompetitors",
    width: "min-w-[70px]",
    numeric: true,
  },
];

const regionColumnDefs: ColumnDef[] = [
  {
    key: "BuyRegionName" as SortKey,
    labelKey: "colBuyRegion" as TranslationKey,
    width: "min-w-[120px]",
    numeric: false,
  },
  {
    key: "SellRegionName" as SortKey,
    labelKey: "colSellRegion" as TranslationKey,
    width: "min-w-[120px]",
    numeric: false,
  },
];

const regionEveGuruColumnDefs: ColumnDef[] = [
  {
    key: "DaySecurity",
    labelKey: "colSecurity",
    width: "min-w-[80px]",
    numeric: true,
    tooltipKey: "colSecurityHint",
  },
  {
    key: "TypeName",
    labelKey: "colItem",
    width: "min-w-[220px]",
    numeric: false,
  },
  {
    key: "BuyStation",
    labelKey: "colBuyStation",
    width: "min-w-[220px]",
    numeric: false,
  },
  {
    key: "SellStation",
    labelKey: "colSellStation",
    width: "min-w-[220px]",
    numeric: false,
  },
  {
    key: "UnitsToBuy",
    labelKey: "colPurchaseUnits",
    width: "min-w-[110px]",
    numeric: true,
    tooltipKey: "colPurchaseUnitsHint",
  },
  {
    key: "DaySourceUnits",
    labelKey: "colSourceUnits",
    width: "min-w-[110px]",
    numeric: true,
    tooltipKey: "colSourceUnitsHint",
  },
  {
    key: "DayTargetDemandPerDay",
    labelKey: "colTargetDemandDay",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colTargetDemandDayHint",
  },
  {
    key: "DayTargetSupplyUnits",
    labelKey: "colTargetSupplyUnits",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colTargetSupplyUnitsHint",
  },
  {
    key: "DayTargetDOS",
    labelKey: "colTargetDOS",
    width: "min-w-[90px]",
    numeric: true,
    tooltipKey: "metricDOSDesc",
  },
  {
    key: "DayAssets",
    labelKey: "colAssets",
    width: "min-w-[90px]",
    numeric: true,
    tooltipKey: "colAssetsHint",
  },
  {
    key: "DayActiveOrders",
    labelKey: "colActiveOrders",
    width: "min-w-[110px]",
    numeric: true,
    tooltipKey: "colActiveOrdersHint",
  },
  {
    key: "DaySourceAvgPrice",
    labelKey: "colSourceAvgPrice",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colSourceAvgPriceHint",
  },
  {
    key: "DayTargetNowPrice",
    labelKey: "colTargetNowPrice",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colTargetNowPriceHint",
  },
  {
    key: "DayTargetPeriodPrice",
    labelKey: "colTargetPeriodPrice",
    width: "min-w-[130px]",
    numeric: true,
    tooltipKey: "colTargetPeriodPriceHint",
  },
  {
    key: "DayNowProfit",
    labelKey: "colNowProfit",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colNowProfitHint",
  },
  {
    key: "DayPeriodProfit",
    labelKey: "colPeriodProfit",
    width: "min-w-[130px]",
    numeric: true,
    tooltipKey: "colPeriodProfitHint",
  },
  {
    key: "DayROINow",
    labelKey: "colROINow",
    width: "min-w-[90px]",
    numeric: true,
    tooltipKey: "metricNowROIDesc",
  },
  {
    key: "DayROIPeriod",
    labelKey: "colROIPeriod",
    width: "min-w-[100px]",
    numeric: true,
    tooltipKey: "metricPeriodROIDesc",
  },
  {
    key: "DayCapitalRequired",
    labelKey: "colCapitalRequired",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colCapitalRequiredHint",
  },
  {
    key: "DayShippingCost",
    labelKey: "colShippingCost",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colShippingCostHint",
  },
  {
    key: "DayIskPerM3Jump",
    labelKey: "colIskPerM3Jump",
    width: "min-w-[120px]",
    numeric: true,
    tooltipKey: "colIskPerM3JumpHint",
  },
  {
    key: "DayTradeScore",
    labelKey: "colTradeScore",
    width: "min-w-[90px]",
    numeric: true,
    tooltipKey: "colTradeScoreHint",
  },
];

function buildColumnDefs(
  showRegions: boolean,
  columnProfile: "default" | "region_eveguru",
): ColumnDef[] {
  if (columnProfile === "region_eveguru") {
    return regionEveGuruColumnDefs;
  }
  if (!showRegions) return baseColumnDefs;
  const cols = [...baseColumnDefs];
  const sellIdx = cols.findIndex((c) => c.key === "SellStation");
  if (sellIdx >= 0) cols.splice(sellIdx + 1, 0, regionColumnDefs[1]);
  const buyIdx = cols.findIndex((c) => c.key === "BuyStation");
  if (buyIdx >= 0) cols.splice(buyIdx + 1, 0, regionColumnDefs[0]);
  return cols;
}

function formatCountdown(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const ss = (sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function mapServerCacheMeta(
  meta: StationCacheMeta | null | undefined,
  fallbackScope: string,
  fallbackRegionCount: number,
  fallbackBaseTs: number,
): CacheMetaView {
  if (!meta) {
    return {
      currentRevision: Math.floor(fallbackBaseTs / 1000),
      lastRefreshAt: fallbackBaseTs,
      nextExpiryAt: fallbackBaseTs + CACHE_TTL_FALLBACK_MS,
      scopeLabel: fallbackScope,
      regionCount: fallbackRegionCount,
    };
  }
  const lastRefreshTs = meta.last_refresh_at
    ? Date.parse(meta.last_refresh_at)
    : fallbackBaseTs;
  const nextExpiryTs = meta.next_expiry_at
    ? Date.parse(meta.next_expiry_at)
    : fallbackBaseTs + Math.max(60, meta.min_ttl_sec || 60) * 1000;
  return {
    currentRevision:
      meta.current_revision && Number.isFinite(meta.current_revision)
        ? meta.current_revision
        : Math.floor(nextExpiryTs / 1000),
    lastRefreshAt: Number.isFinite(lastRefreshTs)
      ? lastRefreshTs
      : fallbackBaseTs,
    nextExpiryAt: Number.isFinite(nextExpiryTs)
      ? nextExpiryTs
      : fallbackBaseTs + CACHE_TTL_FALLBACK_MS,
    scopeLabel: fallbackScope,
    regionCount: Math.max(1, fallbackRegionCount),
  };
}

function hash53(input: string): number {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function flipStateKey(row: FlipResult): string {
  return [
    row.TypeID ?? 0,
    row.BuyLocationID ?? 0,
    row.SellLocationID ?? 0,
    row.BuySystemID ?? 0,
    row.SellSystemID ?? 0,
  ].join(":");
}

function flipStateIDs(row: FlipResult): {
  typeID: number;
  stationID: number;
  regionID: number;
} {
  const typeID =
    row.TypeID > 0 && row.TypeID < 2_147_483_647
      ? row.TypeID
      : (hash53(flipStateKey(row)) % 2_147_483_000) + 1;
  const stationID = hash53(`flip:${flipStateKey(row)}`) || 1;
  const regionID = row.BuyRegionID || row.SellRegionID || 0;
  return { typeID, stationID, regionID };
}

function tradeStateIndexKey(
  typeID: number,
  stationID: number,
  regionID: number,
): string {
  return `${typeID}:${stationID}:${regionID}`;
}

/* ─── Row identity ───
 * Stable per-row object id to avoid duplicate keys when data has collisions.
 */
let _nextRowId = 1;
const _rowIdMap = new WeakMap<FlipResult, number>();
function getRowId(row: FlipResult): number {
  let id = _rowIdMap.get(row);
  if (id == null) {
    id = _nextRowId++;
    _rowIdMap.set(row, id);
  }
  return id;
}

/* ─── IndexedRow: carries stable identity for rows ─── */
interface IndexedRow {
  id: number; // stable id from WeakMap
  row: FlipResult;
  endpointPreferences?: EndpointPreferenceEvaluation;
}

interface RegionGroup {
  key: string;
  label: string;
  rows: IndexedRow[];
  sortValue: number;
  metricCount: number;
}

interface ItemGroup {
  key: string;
  label: string;
  rows: IndexedRow[];
}

interface RouteGroup {
  key: string;
  label: string;
  rows: IndexedRow[];
}

type RouteAggregateMetrics = {
  routeSafetyRank: number;
  dailyIskPerJump: number;
  dailyProfit: number;
  iskPerM3PerJump: number;
  fastestIskPerJump: number;
  weakestExecutionQuality: number;
  riskSpikeCount: number;
  riskNoHistoryCount: number;
  riskUnstableHistoryCount: number;
  riskThinFillCount: number;
  riskTotalCount: number;
  turnoverDays: number | null;
  exitOverhangDays: number | null;
  breakevenBuffer: number | null;
  dailyProfitOverCapital: number | null;
  routeTotalProfit: number;
  routeTotalCapital: number;
  weightedSlippagePct: number;
};

type RouteScoreSummary = {
  routeRecommendationScore: number;
  bestRowScore: number;
  avgRowScore: number;
  trackedShare: number;
};

type RouteBadgeFilter =
  | "clean"
  | "moderate"
  | "busy"
  | "spike"
  | "no_history"
  | "unstable"
  | "thin"
  | "high"
  | "medium"
  | "low";

type RouteBadgeMetadata = {
  filters: Set<RouteBadgeFilter>;
  complexity: "Clean" | "Moderate" | "Busy";
  riskSpikeCount: number;
  riskNoHistoryCount: number;
  riskUnstableHistoryCount: number;
  riskThinFillCount: number;
  confidence: ReturnType<typeof calcRouteConfidence>;
};

function routeScoreToneClass(score: number): string {
  if (score >= 70) return "text-green-300 border-green-500/50 bg-green-900/20";
  if (score >= 40)
    return "text-yellow-300 border-yellow-500/50 bg-yellow-900/20";
  return "text-red-300 border-red-500/50 bg-red-900/20";
}

const BATCH_SYNTHETIC_KEYS: Set<SortKey> = new Set([
  "BatchNumber",
  "BatchProfit",
  "BatchTotalCapital",
  "BatchIskPerJump",
  "RoutePackItemCount",
  "RoutePackTotalProfit",
  "RoutePackTotalCapital",
  "RoutePackTotalVolume",
  "RoutePackCapacityUsedPercent",
  "RoutePackRealIskPerJump",
  "RoutePackDailyIskPerJump",
  "RoutePackDailyProfit",
  "RoutePackRealIskPerM3PerJump",
  "RoutePackDailyProfitOverCapital",
  "RoutePackWeightedSlippagePct",
  "RoutePackWeakestExecutionQuality",
  "RoutePackTurnoverDays",
  "RoutePackExitOverhangDays",
  "RoutePackBreakevenBuffer",
  "RoutePackRiskSpikeCount",
  "RoutePackRiskNoHistoryCount",
  "RoutePackRiskUnstableHistoryCount",
  "RoutePackTotalRiskCount",
  "RoutePackRecommendationScore",
]);

function isBatchSyntheticKey(key: SortKey): key is BatchSyntheticKey {
  return BATCH_SYNTHETIC_KEYS.has(key);
}

/* ─── Filter helpers ─── */

function passesNumericFilter(num: number, fval: string): boolean {
  const trimmed = fval.trim();
  if (!trimmed) return true;
  // Range: "100-500"
  if (trimmed.includes("-") && !trimmed.startsWith("-")) {
    const [minS, maxS] = trimmed.split("-");
    const mn = parseFloat(minS);
    const mx = parseFloat(maxS);
    if (!isNaN(mn) && !isNaN(mx) && (num < mn || num > mx)) return false;
    return true;
  }
  if (trimmed.startsWith(">=")) {
    const v = parseFloat(trimmed.slice(2));
    return isNaN(v) || num >= v;
  }
  if (trimmed.startsWith(">")) {
    const v = parseFloat(trimmed.slice(1));
    return isNaN(v) || num > v;
  }
  if (trimmed.startsWith("<=")) {
    const v = parseFloat(trimmed.slice(2));
    return isNaN(v) || num <= v;
  }
  if (trimmed.startsWith("<")) {
    const v = parseFloat(trimmed.slice(1));
    return isNaN(v) || num < v;
  }
  if (trimmed.startsWith("=")) {
    const v = parseFloat(trimmed.slice(1));
    return isNaN(v) || num === v;
  }
  // Plain number: >= threshold
  const mn = parseFloat(trimmed);
  return isNaN(mn) || num >= mn;
}

function passesTextFilter(val: unknown, fval: string): boolean {
  return String(val ?? "")
    .toLowerCase()
    .includes(fval.toLowerCase());
}

function rowProfitPerUnit(row: FlipResult): number {
  if (row.RealProfit != null && row.FilledQty != null && row.FilledQty > 0) {
    const realPerUnit = row.RealProfit / row.FilledQty;
    if (Number.isFinite(realPerUnit)) return realPerUnit;
  }
  const fallback = row.ProfitPerUnit;
  return Number.isFinite(fallback) ? fallback : 0;
}

function rowIskPerM3(row: FlipResult): number {
  const volume = Number(row.Volume);
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  return rowProfitPerUnit(row) / volume;
}

function rowS2BPerDay(row: FlipResult): number {
  if (row.S2BPerDay != null && Number.isFinite(row.S2BPerDay)) {
    return row.S2BPerDay;
  }
  const total = Number(row.DailyVolume);
  if (!Number.isFinite(total) || total <= 0) return 0;
  const buyDepth = Number(row.BuyOrderRemain);
  const sellDepth = Number(row.SellOrderRemain);
  if (buyDepth <= 0 && sellDepth <= 0) return total / 2;
  if (buyDepth <= 0) return 0;
  if (sellDepth <= 0) return total;
  return (total * buyDepth) / (buyDepth + sellDepth);
}

function rowBfSPerDay(row: FlipResult): number {
  if (row.BfSPerDay != null && Number.isFinite(row.BfSPerDay)) {
    return row.BfSPerDay;
  }
  const total = Number(row.DailyVolume);
  if (!Number.isFinite(total) || total <= 0) return 0;
  const s2b = rowS2BPerDay(row);
  const bfs = total - s2b;
  return bfs > 0 ? bfs : 0;
}

function rowS2BBfSRatio(row: FlipResult): number {
  if (row.S2BBfSRatio != null && Number.isFinite(row.S2BBfSRatio)) {
    return row.S2BBfSRatio;
  }
  const bfs = rowBfSPerDay(row);
  if (bfs <= 0) return 0;
  return rowS2BPerDay(row) / bfs;
}

function getCellValue(
  row: FlipResult,
  key: SortKey,
  batchMetricsByRow: Record<string, RouteBatchMetadata>,
  profile?: OpportunityWeightProfile,
  scoreContext?: OpportunityScanContext,
): unknown {
  if (isBatchSyntheticKey(key)) {
    return getBatchSyntheticValue(row, key, batchMetricsByRow);
  }
  if (key === "IskPerM3") {
    if (row.IskPerM3 != null && Number.isFinite(row.IskPerM3)) {
      return row.IskPerM3;
    }
    return rowIskPerM3(row);
  }
  if (key === "S2BPerDay") return rowS2BPerDay(row);
  if (key === "BfSPerDay") return rowBfSPerDay(row);
  if (key === "S2BBfSRatio") return rowS2BBfSRatio(row);
  if (key === "RealIskPerJump") return realIskPerJump(row);
  if (key === "DailyIskPerJump") return dailyIskPerJump(row);
  if (key === "RealIskPerM3PerJump") return realIskPerM3PerJump(row);
  if (key === "TurnoverDays") return turnoverDays(row);
  if (key === "SlippageCostIsk") return slippageCostIsk(row);
  if (key === "ExecutionQuality") return executionQualityForFlip(row).score;
  if (key === "ExitOverhangDays")
    return exitOverhangDays(row.TargetSellSupply, rowS2BPerDay(row));
  if (key === "BreakevenBuffer") return breakevenBufferForFlip(row);
  if (key === "RouteSafety") return null;
  if (key === "OpportunityScore")
    return scoreFlipResult(row, profile, scoreContext).finalScore;
  return row[key as keyof FlipResult];
}

function passesFilter(
  row: FlipResult,
  col: ColumnDef,
  fval: string,
  batchMetricsByRow: Record<string, RouteBatchMetadata>,
  profile?: OpportunityWeightProfile,
  scoreContext?: OpportunityScanContext,
): boolean {
  if (!fval) return true;
  const cellVal = getCellValue(
    row,
    col.key,
    batchMetricsByRow,
    profile,
    scoreContext,
  );
  if (isBatchSyntheticKey(col.key)) {
    return passesBatchNumericFilter(cellVal as number | null, fval);
  }
  return col.numeric
    ? passesNumericFilter(cellVal as number, fval)
    : passesTextFilter(cellVal, fval);
}

/* ─── Cell formatting ─── */

function fmtCell(
  col: ColumnDef,
  row: FlipResult,
  batchMetricsByRow: Record<string, RouteBatchMetadata>,
  profile?: OpportunityWeightProfile,
  scoreContext?: OpportunityScanContext,
): string {
  const val = getCellValue(
    row,
    col.key,
    batchMetricsByRow,
    profile,
    scoreContext,
  );
  if (isBatchSyntheticKey(col.key)) {
    return formatBatchSyntheticCell(col.key, val as number | null);
  }
  if (col.key === "OpportunityScore") {
    const v = Number(val ?? 0);
    return Number.isFinite(v) ? v.toFixed(1) : "—";
  }
  if (col.key === "ExecutionQuality") {
    const v = Number(val ?? 0);
    return Number.isFinite(v) ? v.toFixed(1) : "—";
  }
  if (col.key === "ExitOverhangDays") {
    if (val == null) return "—";
    const v = Number(val);
    if (!Number.isFinite(v)) return "∞";
    return v.toFixed(1);
  }
  if (col.key === "BreakevenBuffer") {
    const v = Number(val ?? 0);
    return Number.isFinite(v) ? `${v.toFixed(2)}%` : "—";
  }
  if (
    col.key === "ExpectedProfit" ||
    col.key === "RealProfit" ||
    col.key === "ExpectedBuyPrice" ||
    col.key === "ExpectedSellPrice"
  ) {
    if (val == null || Number.isNaN(val)) return "\u2014";
    if (Number(val) <= 0) return "\u2014";
    return formatISK(val as number);
  }
  if (col.key === "BestAskQty" || col.key === "BestBidQty") {
    if (val == null || Number(val) <= 0) return "\u2014";
    return Number(val).toLocaleString();
  }
  if (col.key === "CanFill") {
    if (val == null) return "\u2014";
    return val ? "✓" : "✕";
  }
  if (
    col.key === "BuyPrice" ||
    col.key === "SellPrice" ||
    col.key === "TotalProfit" ||
    col.key === "ProfitPerJump" ||
    col.key === "DailyProfit" ||
    col.key === "IskPerM3" ||
    col.key === "RealIskPerJump" ||
    col.key === "DailyIskPerJump" ||
    col.key === "SlippageCostIsk"
  ) {
    return formatISK(Number(val ?? 0));
  }
  if (col.key === "RealIskPerM3PerJump") {
    return `${formatISK(Number(val ?? 0))}/m³j`;
  }
  if (col.key === "TurnoverDays") {
    if (val == null) return "—";
    const days = Number(val);
    return Number.isFinite(days) ? `${days.toFixed(2)}d` : "—";
  }
  if (
    col.key === "DaySourceAvgPrice" ||
    col.key === "DayTargetNowPrice" ||
    col.key === "DayTargetPeriodPrice" ||
    col.key === "DayNowProfit" ||
    col.key === "DayPeriodProfit" ||
    col.key === "DayCapitalRequired" ||
    col.key === "DayShippingCost"
  ) {
    return formatISK(Number(val ?? 0));
  }
  if (col.key === "DayROINow" || col.key === "DayROIPeriod") {
    return formatMargin(Number(val ?? 0));
  }
  if (col.key === "DaySecurity") {
    const sec = Number(val);
    return Number.isFinite(sec) ? sec.toFixed(1) : "\u2014";
  }
  if (col.key === "DayIskPerM3Jump") {
    const v = Number(val ?? 0);
    if (!v || !Number.isFinite(v)) return "—";
    return formatISK(v) + "/m³j";
  }
  if (col.key === "DayTradeScore") {
    const v = Number(val ?? 0);
    if (!Number.isFinite(v)) return "—";
    return v.toFixed(0);
  }
  if (col.key === "DayTargetDOS") {
    const dos = Number(val);
    return Number.isFinite(dos) ? dos.toFixed(2) : "\u2014";
  }
  if (col.key === "MarginPercent") return formatMargin(val as number);
  if (col.key === "S2BBfSRatio") {
    const ratio = Number(val);
    return Number.isFinite(ratio) ? ratio.toFixed(2) : "\u2014";
  }
  if (col.key === "PriceTrend") {
    const v = val as number;
    return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
  }
  if (typeof val === "number") return val.toLocaleString();
  return String(val ?? "");
}

function compareRowsStable(a: IndexedRow, b: IndexedRow): number {
  const typeDiff = (a.row.TypeID ?? 0) - (b.row.TypeID ?? 0);
  if (typeDiff !== 0) return typeDiff;
  const routeCmp = radiusRouteKey(a.row).localeCompare(radiusRouteKey(b.row));
  if (routeCmp !== 0) return routeCmp;
  const typeNameCmp = String(a.row.TypeName ?? "").localeCompare(
    String(b.row.TypeName ?? ""),
  );
  if (typeNameCmp !== 0) return typeNameCmp;
  return a.id - b.id;
}

function routeAggregateValueForSortKey(
  metrics: RouteAggregateMetrics | undefined,
  sortKey: SortKey,
): number | null {
  if (!metrics) return null;
  if (sortKey === "RouteSafety") return metrics.routeSafetyRank;
  if (sortKey === "RoutePackDailyIskPerJump" || sortKey === "DailyIskPerJump")
    return metrics.dailyIskPerJump;
  if (sortKey === "RoutePackDailyProfit") return metrics.dailyProfit;
  if (sortKey === "RoutePackRealIskPerJump" || sortKey === "RealIskPerJump")
    return metrics.fastestIskPerJump;
  if (
    sortKey === "RoutePackRealIskPerM3PerJump" ||
    sortKey === "RealIskPerM3PerJump"
  )
    return metrics.iskPerM3PerJump;
  if (sortKey === "RoutePackWeakestExecutionQuality")
    return metrics.weakestExecutionQuality;
  if (sortKey === "RoutePackTurnoverDays" || sortKey === "TurnoverDays")
    return metrics.turnoverDays;
  if (sortKey === "RoutePackExitOverhangDays") return metrics.exitOverhangDays;
  if (sortKey === "RoutePackBreakevenBuffer") return metrics.breakevenBuffer;
  if (sortKey === "RoutePackDailyProfitOverCapital")
    return metrics.dailyProfitOverCapital;
  if (sortKey === "RoutePackRiskSpikeCount") return metrics.riskSpikeCount;
  if (sortKey === "RoutePackRiskNoHistoryCount")
    return metrics.riskNoHistoryCount;
  if (sortKey === "RoutePackRiskUnstableHistoryCount")
    return metrics.riskUnstableHistoryCount;
  if (sortKey === "RoutePackTotalRiskCount") return metrics.riskTotalCount;
  if (sortKey === "RoutePackTotalProfit") return metrics.routeTotalProfit;
  if (sortKey === "RoutePackTotalCapital") return metrics.routeTotalCapital;
  return null;
}

export function calcRouteConfidence(
  metrics: RouteAggregateMetrics | undefined,
): {
  score: number;
  label: string;
  color: string;
  hint: string;
} {
  if (!metrics) {
    return {
      score: 0,
      label: "Low",
      color: "text-red-300 border-red-500/60 bg-red-900/20",
      hint: "Score 0/100 — route metrics unavailable",
    };
  }
  return calcRouteConfidenceFromInputs({
    routeSafetyRank: metrics.routeSafetyRank,
    weakestExecutionQuality: metrics.weakestExecutionQuality,
    weightedSlippagePct: metrics.weightedSlippagePct,
    riskSpikeCount: metrics.riskSpikeCount,
    riskNoHistoryCount: metrics.riskNoHistoryCount,
    riskUnstableHistoryCount: metrics.riskUnstableHistoryCount,
    exitOverhangDays: metrics.exitOverhangDays,
  });
}

function complexityBadgeClass(complexity: "Clean" | "Moderate" | "Busy"): string {
  if (complexity === "Clean") {
    return "border-emerald-500/60 text-emerald-300 bg-emerald-950/40";
  }
  if (complexity === "Moderate") {
    return "border-amber-500/60 text-amber-300 bg-amber-950/40";
  }
  return "border-rose-500/60 text-rose-300 bg-rose-950/40";
}

function deriveRouteBadgeMetadata(
  routeSummary: RouteBatchMetadata | undefined,
  routeAggregate: RouteAggregateMetrics | undefined,
): RouteBadgeMetadata {
  const complexity = routeSummary?.routeComplexity ?? "Busy";
  const confidence = calcRouteConfidence(routeAggregate);
  const riskSpikeCount = routeAggregate?.riskSpikeCount ?? 0;
  const riskNoHistoryCount = routeAggregate?.riskNoHistoryCount ?? 0;
  const riskUnstableHistoryCount = routeAggregate?.riskUnstableHistoryCount ?? 0;
  const riskThinFillCount = routeAggregate?.riskThinFillCount ?? 0;
  const filters = new Set<RouteBadgeFilter>();
  filters.add(complexity.toLowerCase() as RouteBadgeFilter);
  if (riskSpikeCount > 0) filters.add("spike");
  if (riskNoHistoryCount > 0) filters.add("no_history");
  if (riskUnstableHistoryCount > 0) filters.add("unstable");
  if (riskThinFillCount > 0) filters.add("thin");
  filters.add(confidence.label.toLowerCase() as RouteBadgeFilter);
  return {
    filters,
    complexity,
    riskSpikeCount,
    riskNoHistoryCount,
    riskUnstableHistoryCount,
    riskThinFillCount,
    confidence,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * COMPONENT
 * ═══════════════════════════════════════════════════════════════════════ */

export function ScanResultsTable({
  results,
  scanning,
  progress,
  cacheMeta,
  tradeStateTab = "radius",
  scanCompletedWithZero,
  salesTaxPercent,
  brokerFeePercent,
  splitTradeFees,
  buyBrokerFeePercent,
  sellBrokerFeePercent,
  buySalesTaxPercent,
  sellSalesTaxPercent,
  showRegions = false,
  columnProfile = "default",
  isLoggedIn = false,
  cargoLimit = 0,
  originSystemName,
  minRouteSecurity,
  includeStructures,
  routeMaxJumps,
  maxDetourJumpsPerNode,
  allowLowsec,
  allowNullsec,
  allowWormhole,
  onOpenPriceValidation,
  strategyScore,
  loopOpportunities,
  sessionStationFilters,
  onUpdateSessionStationFilters,
}: Props) {
  const { t } = useI18n();
  const emptyReason: EmptyReason = scanCompletedWithZero
    ? "no_results"
    : "no_scan_yet";
  const { addToast, removeToast } = useGlobalToast();
  const opportunityProfile = useMemo(
    () => strategyScoreToOpportunityProfile(strategyScore),
    [strategyScore],
  );

  const allColumnDefs = useMemo(
    () => buildColumnDefs(showRegions, columnProfile),
    [showRegions, columnProfile],
  );
  const columnPrefsKey = useMemo(
    () =>
      `${COLUMN_PREFS_STORAGE_PREFIX}${showRegions ? "region" : "radius"}:${columnProfile}`,
    [showRegions, columnProfile],
  );

  // ── State ──
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    columnProfile === "region_eveguru" ? "DayPeriodProfit" : "RealProfit",
  );
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [decisionLens, setDecisionLens] = useState<
    "custom" | DecisionLensPreset
  >("recommended");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(
    () => tradeStateTab === "radius",
  );
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [columnOrder, setColumnOrder] = useState<SortKey[]>(() =>
    allColumnDefs.map((col) => col.key),
  );
  const [hiddenColumns, setHiddenColumns] = useState<Set<SortKey>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [compactMode, setCompactMode] = useState(false);
  const previousScanningRef = useRef(scanning);
  const [groupByItem, setGroupByItem] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ITEM_GROUPING_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [routeViewMode, setRouteViewMode] = useState<"rows" | "route">(() => {
    try {
      return localStorage.getItem(ROUTE_GROUPING_STORAGE_KEY) === "route"
        ? "route"
        : "rows";
    } catch {
      return "rows";
    }
  });
  const [trackedVisibilityMode, setTrackedVisibilityMode] =
    useState<TrackedVisibilityMode>("all");
  const [trackedFirst, setTrackedFirst] = useState(false);
  const [showTrackedChip, setShowTrackedChip] = useState(false);
  const [showAdvancedToolbar, setShowAdvancedToolbar] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ADVANCED_TOOLBAR_VISIBLE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [endpointPreferenceProfile, setEndpointPreferenceProfile] =
    useState<EndpointPreferenceProfile>(() => {
      try {
        const raw = localStorage.getItem(ENDPOINT_PREFS_STORAGE_KEY);
        if (!raw) return DEFAULT_ENDPOINT_PREFERENCE_PROFILE;
        const parsed = JSON.parse(raw) as {
          profile?: Partial<EndpointPreferenceProfile>;
        };
        return {
          ...DEFAULT_ENDPOINT_PREFERENCE_PROFILE,
          ...(parsed.profile ?? {}),
        };
      } catch {
        return DEFAULT_ENDPOINT_PREFERENCE_PROFILE;
      }
    });
  const [endpointPreferenceMode, setEndpointPreferenceMode] =
    useState<EndpointPreferenceApplicationMode>(() => {
      try {
        const raw = localStorage.getItem(ENDPOINT_PREFS_STORAGE_KEY);
        if (!raw) return EndpointPreferenceApplicationMode.Deprioritize;
        const parsed = JSON.parse(raw) as { mode?: string };
        return parsed.mode === EndpointPreferenceApplicationMode.Hide
          ? EndpointPreferenceApplicationMode.Hide
          : EndpointPreferenceApplicationMode.Deprioritize;
      } catch {
        return EndpointPreferenceApplicationMode.Deprioritize;
      }
    });
  const [majorHubInput, setMajorHubInput] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(ENDPOINT_PREFS_STORAGE_KEY);
      if (!raw) return DEFAULT_MAJOR_HUB_SYSTEMS.join(", ");
      const parsed = JSON.parse(raw) as { majorHubs?: string[] };
      const hubs = normalizeMajorHubSystems(
        Array.isArray(parsed.majorHubs) ? parsed.majorHubs : [],
      );
      return (hubs.length > 0 ? hubs : [...DEFAULT_MAJOR_HUB_SYSTEMS]).join(
        ", ",
      );
    } catch {
      return DEFAULT_MAJOR_HUB_SYSTEMS.join(", ");
    }
  });
  const [showHiddenRows, setShowHiddenRows] = useState(false);
  const [selectedBadgeFilters, setSelectedBadgeFilters] = useState<
    Set<RouteBadgeFilter>
  >(new Set());
  const [hiddenMap, setHiddenMap] = useState<Record<string, HiddenFlipEntry>>(
    {},
  );
  const [focusedRowId, setFocusedRowId] = useState<number | null>(null);
  // Column DnD state
  const [colDraggedKey, setColDraggedKey] = useState<SortKey | null>(null);
  const [colDragOverKey, setColDragOverKey] = useState<SortKey | null>(null);
  const [colDragOverSide, setColDragOverSide] = useState<"before" | "after">(
    "after",
  );
  const [ignoredModalOpen, setIgnoredModalOpen] = useState(false);
  const [ignoredSearch, setIgnoredSearch] = useState("");
  const [ignoredTab, setIgnoredTab] = useState<HiddenFilterTab>("all");
  const [ignoredSelectedKeys, setIgnoredSelectedKeys] = useState<Set<string>>(
    new Set(),
  );
  const [cacheNowTs, setCacheNowTs] = useState<number>(Date.now());
  const [lastScanTs, setLastScanTs] = useState<number>(Date.now());
  const [cacheStaleSuppressedUntilTs, setCacheStaleSuppressedUntilTs] =
    useState<number>(0);
  const [cacheRebooting, setCacheRebooting] = useState(false);
  const [collapsedRegionGroups, setCollapsedRegionGroups] = useState<
    Set<string>
  >(new Set());
  const [expandedItemGroups, setExpandedItemGroups] = useState<Set<string>>(
    new Set(),
  );
  const [expandedRouteGroups, setExpandedRouteGroups] = useState<Set<string>>(
    new Set(),
  );
  const [regionCollapseInitialized, setRegionCollapseInitialized] =
    useState(false);

  // ── Route Safety ──
  const [routeSafetyMap, setRouteSafetyMap] = useState<
    Record<string, RouteState>
  >({});
  const [routeSafetyFilter, setRouteSafetyFilter] = useState<
    "all" | "green" | "yellow" | "red"
  >("all");
  const [routeSafetyModal, setRouteSafetyModal] = useState<{
    systems: SystemDanger[];
  } | null>(null);

  const isRegionGrouped = columnProfile === "region_eveguru";
  const isItemGrouped =
    !isRegionGrouped && groupByItem && routeViewMode === "rows";
  const isRouteGrouped = !isRegionGrouped && routeViewMode === "route";

  const routeBadgeFilterOptions: Array<{
    key: RouteBadgeFilter;
    labelKey: TranslationKey;
    tooltipKey: TranslationKey;
  }> = [
    { key: "clean", labelKey: "routeBadgeFilterClean", tooltipKey: "routeBadgeFilterCleanTooltip" },
    { key: "moderate", labelKey: "routeBadgeFilterModerate", tooltipKey: "routeBadgeFilterModerateTooltip" },
    { key: "busy", labelKey: "routeBadgeFilterBusy", tooltipKey: "routeBadgeFilterBusyTooltip" },
    { key: "spike", labelKey: "routeBadgeFilterSpike", tooltipKey: "routeBadgeFilterSpikeTooltip" },
    { key: "no_history", labelKey: "routeBadgeFilterNoHistory", tooltipKey: "routeBadgeFilterNoHistoryTooltip" },
    { key: "unstable", labelKey: "routeBadgeFilterUnstable", tooltipKey: "routeBadgeFilterUnstableTooltip" },
    { key: "thin", labelKey: "routeBadgeFilterThin", tooltipKey: "routeBadgeFilterThinTooltip" },
    { key: "high", labelKey: "routeBadgeFilterHigh", tooltipKey: "routeBadgeFilterHighTooltip" },
    { key: "medium", labelKey: "routeBadgeFilterMedium", tooltipKey: "routeBadgeFilterMediumTooltip" },
    { key: "low", labelKey: "routeBadgeFilterLow", tooltipKey: "routeBadgeFilterLowTooltip" },
  ];
  const preferredSortKey: SortKey = isRegionGrouped
    ? "DayPeriodProfit"
    : "RealProfit";

  // ── Category / security / group filter state (region_eveguru only) ──
  const [categoryFilter, setCategoryFilter] = useState<Set<number>>(new Set());
  const [securityFilter, setSecurityFilter] = useState<
    "all" | "highsec" | "lowsec" | "nullsec"
  >("all");
  const [groupFilter, setGroupFilter] = useState<Set<string>>(new Set());
  const [regionGroupSortMode, setRegionGroupSortMode] =
    useState<RegionGroupSortMode>(() => {
      try {
        const raw = localStorage.getItem("eve-region-group-sort:v1");
        if (
          raw === "period_profit" ||
          raw === "now_profit" ||
          raw === "trade_score"
        ) {
          return raw;
        }
      } catch {
        // ignore storage errors
      }
      return "period_profit";
    });

  const orderedColumnDefs = useMemo(() => {
    const byKey = new Map(allColumnDefs.map((col) => [col.key, col] as const));
    const ordered = columnOrder
      .map((key) => byKey.get(key))
      .filter((col): col is ColumnDef => !!col);
    for (const col of allColumnDefs) {
      if (!ordered.some((existing) => existing.key === col.key)) {
        ordered.push(col);
      }
    }
    return ordered;
  }, [allColumnDefs, columnOrder]);

  const columnDefs = useMemo(
    () => orderedColumnDefs.filter((col) => !hiddenColumns.has(col.key)),
    [orderedColumnDefs, hiddenColumns],
  );

  const { batchMetricsByRow, batchMetricsByRoute } = useMemo(() => {
    if (columnProfile !== "default") {
      return { batchMetricsByRow: {}, batchMetricsByRoute: {} };
    }
    const metadata = buildRouteBatchMetadata(results, cargoLimit);
    return {
      batchMetricsByRow: metadata.byRow,
      batchMetricsByRoute: metadata.byRoute,
    };
  }, [columnProfile, results, cargoLimit]);

  useEffect(() => {
    const wasScanning = previousScanningRef.current;
    if (wasScanning && !scanning && results.length > 0) {
      setCompactMode(true);
    }
    previousScanningRef.current = scanning;
  }, [results.length, scanning]);

  // Watchlist
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  useEffect(() => {
    getWatchlist()
      .then(setWatchlist)
      .catch(() => {});
  }, []);

  const reloadPinnedKeys = useCallback(() => {
    listPinnedOpportunities("scan")
      .then((rows) =>
        setPinnedKeys(new Set(rows.map((row) => row.opportunity_key))),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadPinnedKeys();
    return subscribePinnedOpportunityChanges((detail) => {
      if (detail.tab && detail.tab !== "scan") return;
      if (import.meta.env.DEV) {
        console.debug("[ScanResultsTable] pin state refresh", detail);
      }
      reloadPinnedKeys();
    });
  }, [reloadPinnedKeys]);

  // ── Route Safety batch fetch ──
  // Fires only when scanning finishes (scanning goes false) with results
  useEffect(() => {
    if (scanning) return; // don't fire mid-scan
    if (results.length === 0) {
      setRouteSafetyMap({});
      return;
    }
    const pairs: { from: number; to: number }[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      const f = r.BuySystemID;
      const t = r.SellSystemID;
      if (!f || !t || f === t) continue;
      const k = `${f}:${t}`;
      if (!seen.has(k)) {
        seen.add(k);
        pairs.push({ from: f, to: t });
      }
    }
    if (pairs.length === 0) return;
    // Mark all as loading
    setRouteSafetyMap((prev) => {
      const next = { ...prev };
      for (const p of pairs) {
        const k = `${p.from}:${p.to}`;
        if (!next[k]) next[k] = { status: "loading" };
      }
      return next;
    });
    getGankCheckBatch(pairs)
      .then((summaries) => {
        setRouteSafetyMap((prev) => {
          const next = { ...prev };
          // Clear any pairs that weren't in the response (treat as green/safe)
          for (const p of pairs) {
            const k = `${p.from}:${p.to}`;
            if (next[k]?.status === "loading") {
              next[k] = {
                status: "summary",
                danger: "green",
                kills: 0,
                totalISK: 0,
              };
            }
          }
          for (const s of summaries) {
            next[s.key] = {
              status: "summary",
              danger: s.danger,
              kills: s.kills,
              totalISK: s.totalISK,
            };
          }
          return next;
        });
      })
      .catch(() => {
        // On error, clear loading state so cells don't hang
        setRouteSafetyMap((prev) => {
          const next = { ...prev };
          for (const p of pairs) {
            const k = `${p.from}:${p.to}`;
            if (next[k]?.status === "loading") delete next[k];
          }
          return next;
        });
      });
  }, [results, scanning]);
  const watchlistIds = useMemo(
    () => new Set(watchlist.map((w) => w.type_id)),
    [watchlist],
  );

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    id: number;
    row: FlipResult;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const keyNavRootRef = useRef<HTMLDivElement>(null);
  const [execPlanRow, setExecPlanRow] = useState<FlipResult | null>(null);
  const [batchPlanRow, setBatchPlanRow] = useState<FlipResult | null>(null);
  const [scoreExplainRow, setScoreExplainRow] = useState<FlipResult | null>(
    null,
  );
  const [dayDetailRow, setDayDetailRow] = useState<FlipResult | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const keyNavRef = useRef({
    pageRows: [] as IndexedRow[],
    focusedRowId: null as number | null,
    setFocusedRowId: (_id: number | null) => {},
    setExecPlanRow: (_row: FlipResult | null) => {},
    setRowHiddenState: (_row: FlipResult, _mode: HiddenMode) => {},
    hiddenMap: {} as Record<string, HiddenFlipEntry>,
  });
  // Per-group row limit for region mode (key → max rows shown)
  const [groupRowLimit, setGroupRowLimit] = useState<Map<string, number>>(
    new Map(),
  );

  useEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const menu = contextMenuRef.current;
      const rect = menu.getBoundingClientRect();
      const pad = 10;
      let x = contextMenu.x,
        y = contextMenu.y;
      if (x + rect.width > window.innerWidth - pad)
        x = window.innerWidth - rect.width - pad;
      if (y + rect.height > window.innerHeight - pad)
        y = window.innerHeight - rect.height - pad;
      menu.style.left = `${Math.max(pad, x)}px`;
      menu.style.top = `${Math.max(pad, y)}px`;
    }
  }, [contextMenu]);

  // Close filter panel on outside click
  useEffect(() => {
    if (!filterPanelOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !filterPanelRef.current?.contains(t) &&
        !filterBtnRef.current?.contains(t)
      ) {
        setFilterPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterPanelOpen]);

  useEffect(() => {
    const defaultOrder = allColumnDefs.map((col) => col.key);
    const available = new Set(defaultOrder);
    let nextOrder = defaultOrder;
    const nextHidden = new Set<SortKey>();
    try {
      const raw = localStorage.getItem(columnPrefsKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          order?: string[];
          hidden?: string[];
        };
        if (Array.isArray(parsed.order)) {
          const saved = parsed.order.filter((k): k is SortKey =>
            available.has(k as SortKey),
          );
          const missing = defaultOrder.filter((k) => !saved.includes(k));
          nextOrder = [...saved, ...missing];
        }
        if (Array.isArray(parsed.hidden)) {
          for (const key of parsed.hidden) {
            if (available.has(key as SortKey)) {
              nextHidden.add(key as SortKey);
            }
          }
        }
      }
    } catch {
      // Ignore malformed local settings.
    }
    if (nextHidden.size >= nextOrder.length && nextOrder.length > 0) {
      nextHidden.delete(nextOrder[0]);
    }
    setColumnOrder(nextOrder);
    setHiddenColumns(nextHidden);
  }, [columnPrefsKey, allColumnDefs]);

  useEffect(() => {
    if (columnOrder.length === 0) return;
    try {
      localStorage.setItem(
        columnPrefsKey,
        JSON.stringify({
          order: columnOrder,
          hidden: [...hiddenColumns],
        }),
      );
    } catch {
      // Ignore storage quota errors.
    }
  }, [columnPrefsKey, columnOrder, hiddenColumns]);

  useEffect(() => {
    try {
      localStorage.setItem("eve-region-group-sort:v1", regionGroupSortMode);
    } catch {
      // ignore storage quota errors
    }
  }, [regionGroupSortMode]);

  useEffect(() => {
    try {
      localStorage.setItem(ITEM_GROUPING_STORAGE_KEY, groupByItem ? "1" : "0");
    } catch {
      // ignore storage quota errors
    }
  }, [groupByItem]);

  useEffect(() => {
    try {
      localStorage.setItem(ROUTE_GROUPING_STORAGE_KEY, routeViewMode);
    } catch {
      // ignore storage quota errors
    }
  }, [routeViewMode]);

  useEffect(() => {
    try {
      localStorage.setItem(
        ADVANCED_TOOLBAR_VISIBLE_STORAGE_KEY,
        showAdvancedToolbar ? "1" : "0",
      );
    } catch {
      // ignore storage quota errors
    }
  }, [showAdvancedToolbar]);

  useEffect(() => {
    if (!isRouteGrouped && selectedBadgeFilters.size > 0) {
      setSelectedBadgeFilters(new Set());
    }
  }, [isRouteGrouped, selectedBadgeFilters]);

  const majorHubSystems = useMemo(
    () =>
      normalizeMajorHubSystems(
        majorHubInput.split(",").map((entry) => entry.trim()),
      ),
    [majorHubInput],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        ENDPOINT_PREFS_STORAGE_KEY,
        JSON.stringify({
          mode: endpointPreferenceMode,
          profile: endpointPreferenceProfile,
          majorHubs: majorHubSystems,
        }),
      );
    } catch {
      // ignore storage quota errors
    }
  }, [endpointPreferenceMode, endpointPreferenceProfile, majorHubSystems]);

  useEffect(() => {
    if (columnDefs.length === 0) return;
    if (!columnDefs.some((col) => col.key === sortKey)) {
      if (columnDefs.some((col) => col.key === preferredSortKey)) {
        setSortKey(preferredSortKey);
      } else {
        setSortKey(columnDefs[0].key);
      }
      setSortDir("desc");
    }
  }, [columnDefs, preferredSortKey, sortKey]);

  const toggleColumnVisibility = useCallback(
    (key: SortKey, visible: boolean) => {
      setHiddenColumns((prev) => {
        const next = new Set(prev);
        if (visible) {
          next.delete(key);
          return next;
        }
        if (!next.has(key) && columnDefs.length <= 1) {
          addToast(t("columnsAtLeastOne"), "info", 2200);
          return prev;
        }
        next.add(key);
        return next;
      });
    },
    [columnDefs.length, addToast, t],
  );

  const moveColumn = useCallback((key: SortKey, dir: -1 | 1) => {
    setColumnOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    setColumnOrder(allColumnDefs.map((col) => col.key));
  }, [allColumnDefs]);

  const insertColumn = useCallback(
    (fromKey: SortKey, toKey: SortKey, side: "before" | "after") => {
      if (fromKey === toKey) return;
      setColumnOrder((prev) => {
        const without = prev.filter((k) => k !== fromKey);
        const toIdx = without.indexOf(toKey);
        if (toIdx < 0) return prev;
        const insertAt = side === "before" ? toIdx : toIdx + 1;
        const next = [...without];
        next.splice(insertAt, 0, fromKey);
        return next;
      });
    },
    [],
  );

  // ── Data pipeline: index → filter → sort ──
  const {
    indexed,
    filtered,
    sorted,
    variantByRowId,
    endpointPreferenceMetaByRowId,
  } = useMemo(() => {
    const sessionVisibleRows = filterRowsBySessionStationIgnores(
      results,
      sessionStationFilters,
    );

    const indexed: IndexedRow[] = sessionVisibleRows.map((row) => {
      const endpointPreferences = evaluateEndpointPreferences(
        row,
        endpointPreferenceProfile,
        majorHubSystems,
        endpointPreferenceMode,
      );
      return {
        id: getRowId(row),
        row,
        endpointPreferences,
      };
    });

    const hasFilters = Object.values(filters).some((v) => !!v);
    const endpointEligible = indexed.filter(
      (ir) => !ir.endpointPreferences?.excluded,
    );
    const baseFiltered = hasFilters
      ? endpointEligible.filter((ir) => {
          for (const col of columnDefs) {
            const fval = filters[col.key];
            if (!fval) continue;
            if (
              !passesFilter(
                ir.row,
                col,
                fval,
                batchMetricsByRow,
                opportunityProfile,
              )
            )
              return false;
          }
          return true;
        })
      : endpointEligible;
    const filtered =
      trackedVisibilityMode === "tracked_only"
        ? baseFiltered.filter((ir) => watchlistIds.has(ir.row.TypeID))
        : baseFiltered;

    const filteredScoreContext = buildFlipScoreContext(
      filtered.map((item) => item.row),
    );

    const routeSafetyRankForRow = (row: FlipResult): number => {
      const k = `${row.BuySystemID}:${row.SellSystemID}`;
      const rs = routeSafetyMap[k];
      return routeSafetyRankFromState(rs);
    };

    const routeSafetyTieBreaker = (a: IndexedRow, b: IndexedRow): number => {
      const aMeta = batchMetricsByRoute[routeGroupKey(a.row)];
      const bMeta = batchMetricsByRoute[routeGroupKey(b.row)];

      // Conservative tie-breakers for equally-ranked safety buckets:
      // 1) higher weakest execution quality is safer/more reliable (better),
      // 2) fewer route risk flags is better.
      const eqDiff =
        (bMeta?.routeWeakestExecutionQuality ?? 0) -
        (aMeta?.routeWeakestExecutionQuality ?? 0);
      if (eqDiff !== 0) return eqDiff;

      const aRiskCount =
        (aMeta?.routeRiskSpikeCount ?? 0) +
        (aMeta?.routeRiskNoHistoryCount ?? 0) +
        (aMeta?.routeRiskUnstableHistoryCount ?? 0);
      const bRiskCount =
        (bMeta?.routeRiskSpikeCount ?? 0) +
        (bMeta?.routeRiskNoHistoryCount ?? 0) +
        (bMeta?.routeRiskUnstableHistoryCount ?? 0);
      const riskCountDiff = aRiskCount - bRiskCount;
      if (riskCountDiff !== 0) return riskCountDiff;

      return compareRowsStable(a, b);
    };

    const sorted = filtered.slice();
    sorted.sort((a, b) => {
      const aPin = pinnedKeys.has(
        mapScanRowToPinnedOpportunity(a.row).opportunity_key,
      );
      const bPin = pinnedKeys.has(
        mapScanRowToPinnedOpportunity(b.row).opportunity_key,
      );
      if (aPin !== bPin) return aPin ? -1 : 1;

      if (trackedFirst) {
        const aTracked = watchlistIds.has(a.row.TypeID);
        const bTracked = watchlistIds.has(b.row.TypeID);
        if (aTracked !== bTracked) return aTracked ? -1 : 1;
      }

      const aDeprioritized = isFlipResultDeprioritized(
        a.row,
        sessionStationFilters,
      );
      const bDeprioritized = isFlipResultDeprioritized(
        b.row,
        sessionStationFilters,
      );
      if (aDeprioritized !== bDeprioritized) return aDeprioritized ? 1 : -1;

      const aEndpointDelta = a.endpointPreferences?.scoreDelta ?? 0;
      const bEndpointDelta = b.endpointPreferences?.scoreDelta ?? 0;
      if (aEndpointDelta !== bEndpointDelta) {
        return bEndpointDelta - aEndpointDelta;
      }

      if (sortKey === ("RouteSafety" as SortKey)) {
        const diff =
          routeSafetyRankForRow(a.row) - routeSafetyRankForRow(b.row);
        const primaryRisk = sortDir === "asc" ? diff : -diff;
        if (primaryRisk !== 0) return primaryRisk;
        return routeSafetyTieBreaker(a, b);
      }

      const av = getCellValue(
        a.row,
        sortKey,
        batchMetricsByRow,
        opportunityProfile,
        filteredScoreContext,
      );
      const bv = getCellValue(
        b.row,
        sortKey,
        batchMetricsByRow,
        opportunityProfile,
        filteredScoreContext,
      );
      if (isBatchSyntheticKey(sortKey)) {
        const syntheticCmp = compareBatchSyntheticValues(
          av as number | null,
          bv as number | null,
          sortDir,
        );
        if (syntheticCmp !== 0) return syntheticCmp;
        return compareRowsStable(a, b);
      }
      if (typeof av === "number" || typeof bv === "number") {
        if (av == null && bv == null) return compareRowsStable(a, b);
        if (av == null) return 1;
        if (bv == null) return -1;
        const diff = (av as number) - (bv as number);
        const primaryNum = sortDir === "asc" ? diff : -diff;
        if (primaryNum !== 0) return primaryNum;
        return compareRowsStable(a, b);
      }
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      const primary = sortDir === "asc" ? cmp : -cmp;
      if (primary !== 0) return primary;
      return compareRowsStable(a, b);
    });

    const totalByType = new Map<number, number>();
    for (const ir of sorted) {
      totalByType.set(ir.row.TypeID, (totalByType.get(ir.row.TypeID) ?? 0) + 1);
    }
    const seenByType = new Map<number, number>();
    const variantByRowId = new Map<number, { index: number; total: number }>();
    for (const ir of sorted) {
      const total = totalByType.get(ir.row.TypeID) ?? 0;
      const index = (seenByType.get(ir.row.TypeID) ?? 0) + 1;
      seenByType.set(ir.row.TypeID, index);
      if (total > 1) {
        variantByRowId.set(ir.id, { index, total });
      }
    }

    const endpointPreferenceMetaByRowId = new Map<
      number,
      { appliedRules: string[]; scoreDelta: number; excluded: boolean }
    >();
    for (const ir of indexed) {
      endpointPreferenceMetaByRowId.set(ir.id, {
        appliedRules: ir.endpointPreferences?.appliedRules ?? [],
        scoreDelta: ir.endpointPreferences?.scoreDelta ?? 0,
        excluded: !!ir.endpointPreferences?.excluded,
      });
    }

    return { indexed, filtered, sorted, variantByRowId, endpointPreferenceMetaByRowId };
  }, [
    results,
    filters,
    columnDefs,
    sortKey,
    sortDir,
    pinnedKeys,
    routeSafetyMap,
    batchMetricsByRoute,
    batchMetricsByRow,
    opportunityProfile,
    sessionStationFilters,
    endpointPreferenceMode,
    endpointPreferenceProfile,
    majorHubSystems,
    trackedFirst,
    trackedVisibilityMode,
    watchlistIds,
  ]);

  // Available market groups derived from current results (region mode only)
  const availableGroups = useMemo<{ name: string; count: number }[]>(() => {
    if (!isRegionGrouped) return [];
    const counts = new Map<string, number>();
    for (const ir of sorted) {
      // Only show groups for selected categories (if any filter active)
      if (
        categoryFilter.size > 0 &&
        !categoryFilter.has(ir.row.DayCategoryID ?? 0)
      )
        continue;
      const g = ir.row.DayGroupName ?? "";
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [isRegionGrouped, sorted, categoryFilter]);

  // Available categories derived from current results (region mode only)
  const availableCategories = useMemo<
    { id: number; name: string; count: number }[]
  >(() => {
    if (!isRegionGrouped) return [];
    const counts = new Map<number, number>();
    for (const ir of sorted) {
      const cid = ir.row.DayCategoryID ?? 0;
      if (cid > 0) counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: eveCategoryName(id), count }))
      .filter((c) => c.name !== "")
      .sort((a, b) => b.count - a.count);
  }, [isRegionGrouped, sorted]);

  const displaySorted = useMemo(() => {
    let rows = showHiddenRows
      ? sorted
      : sorted.filter((ir) => !hiddenMap[flipStateKey(ir.row)]);
    if (isRegionGrouped) {
      if (categoryFilter.size > 0) {
        rows = rows.filter((ir) =>
          categoryFilter.has(ir.row.DayCategoryID ?? 0),
        );
      }
      if (securityFilter !== "all") {
        rows = rows.filter((ir) => {
          const sec = ir.row.DaySecurity ?? 0;
          if (securityFilter === "highsec") return sec >= 0.45;
          if (securityFilter === "lowsec") return sec >= 0.1 && sec < 0.45;
          return sec < 0.1;
        });
      }
      if (groupFilter.size > 0) {
        rows = rows.filter((ir) => groupFilter.has(ir.row.DayGroupName ?? ""));
      }
    }
    // Route safety filter — available in all modes
    if (routeSafetyFilter !== "all") {
      rows = rows.filter((ir) => {
        const k = `${ir.row.BuySystemID}:${ir.row.SellSystemID}`;
        const rs = routeSafetyMap[k];
        if (routeSafetyFilter === "green") {
          return routeSafetyRankFromState(rs) === 0;
        }
        if (routeSafetyFilter === "yellow") {
          return routeSafetyRankFromState(rs) === 1;
        }
        return routeSafetyRankFromState(rs) === 2;
      });
    }
    if (trackedVisibilityMode === "hide_non_tracked") {
      rows = rows.filter((ir) => watchlistIds.has(ir.row.TypeID));
    }
    return rows;
  }, [
    sorted,
    showHiddenRows,
    hiddenMap,
    isRegionGrouped,
    categoryFilter,
    securityFilter,
    groupFilter,
    routeSafetyFilter,
    routeSafetyMap,
    trackedVisibilityMode,
    watchlistIds,
  ]);

  const displayScoreContext = useMemo(
    () => buildFlipScoreContext(displaySorted.map((item) => item.row)),
    [displaySorted],
  );

  const regionGroups = useMemo<RegionGroup[]>(() => {
    if (!isRegionGrouped) return [];
    const metricForRow = (row: FlipResult): number => {
      if (regionGroupSortMode === "trade_score") {
        return Number(row.DayTradeScore ?? 0);
      }
      if (regionGroupSortMode === "now_profit") {
        return Number(
          row.DayNowProfit ??
            row.TotalProfit ??
            row.RealProfit ??
            row.ExpectedProfit ??
            0,
        );
      }
      return Number(
        row.DayPeriodProfit ??
          row.RealProfit ??
          row.ExpectedProfit ??
          row.TotalProfit ??
          0,
      );
    };
    const byKey = new Map<string, RegionGroup>();
    for (const ir of displaySorted) {
      const key = `${ir.row.BuySystemID}:${ir.row.BuySystemName}`;
      const itemMetric = metricForRow(ir.row);
      const metric = Number.isFinite(itemMetric) ? itemMetric : 0;
      const found = byKey.get(key);
      if (found) {
        found.rows.push(ir);
        found.sortValue += metric;
        found.metricCount++;
      } else {
        byKey.set(key, {
          key,
          label: ir.row.BuySystemName || t("hiddenUnknown"),
          rows: [ir],
          sortValue: metric,
          metricCount: 1,
        });
      }
    }
    const groups = [...byKey.values()];
    if (regionGroupSortMode === "trade_score") {
      for (const g of groups) {
        if (g.metricCount > 0) {
          g.sortValue /= g.metricCount;
        }
      }
    }
    groups.sort((a, b) => {
      if (a.sortValue === b.sortValue) {
        return a.label.localeCompare(b.label);
      }
      return b.sortValue - a.sortValue;
    });
    return groups;
  }, [displaySorted, isRegionGrouped, regionGroupSortMode, t]);

  const itemGroups = useMemo<ItemGroup[]>(() => {
    if (!isItemGrouped) return [];
    const byType = new Map<number, ItemGroup>();
    for (const ir of displaySorted) {
      const typeID = ir.row.TypeID ?? 0;
      const existing = byType.get(typeID);
      if (existing) {
        existing.rows.push(ir);
      } else {
        byType.set(typeID, {
          key: String(typeID),
          label: ir.row.TypeName || t("hiddenUnknown"),
          rows: [ir],
        });
      }
    }
    return [...byType.values()];
  }, [displaySorted, isItemGrouped, t]);

  const routeAggregateMetricsByRoute = useMemo<
    Record<string, RouteAggregateMetrics>
  >(() => {
    const routeKeyToSystemPair: Record<string, string> = {};
    for (const ir of displaySorted) {
      const key = routeGroupKey(ir.row);
      if (!(key in routeKeyToSystemPair)) {
        routeKeyToSystemPair[key] =
          `${ir.row.BuySystemID}:${ir.row.SellSystemID}`;
      }
    }

    const aggregates: Record<string, RouteAggregateMetrics> = {};
    for (const [routeKey, meta] of Object.entries(batchMetricsByRoute)) {
      const routeSafetyRank = routeSafetyRankFromState(
        routeSafetyMap[routeKeyToSystemPair[routeKey] ?? ""],
      );
      const riskTotalCount =
        meta.routeRiskSpikeCount +
        meta.routeRiskNoHistoryCount +
        meta.routeRiskUnstableHistoryCount +
        meta.routeRiskThinFillCount;
      aggregates[routeKey] = {
        routeSafetyRank,
        dailyIskPerJump: meta.routeDailyIskPerJump,
        dailyProfit: meta.routeDailyProfit,
        iskPerM3PerJump: meta.routeRealIskPerM3PerJump,
        fastestIskPerJump: meta.routeRealIskPerJump,
        weakestExecutionQuality: meta.routeWeakestExecutionQuality,
        riskSpikeCount: meta.routeRiskSpikeCount,
        riskNoHistoryCount: meta.routeRiskNoHistoryCount,
        riskUnstableHistoryCount: meta.routeRiskUnstableHistoryCount,
        riskThinFillCount: meta.routeRiskThinFillCount,
        riskTotalCount,
        turnoverDays: meta.routeTurnoverDays,
        exitOverhangDays: meta.routeExitOverhangDays,
        breakevenBuffer: meta.routeBreakevenBuffer,
        dailyProfitOverCapital: meta.routeDailyProfitOverCapital,
        routeTotalProfit: meta.routeTotalProfit,
        routeTotalCapital: meta.routeTotalCapital,
        weightedSlippagePct: meta.routeWeightedSlippagePct,
      };
    }
    return aggregates;
  }, [batchMetricsByRoute, displaySorted, routeSafetyMap]);

  const routeGroups = useMemo<RouteGroup[]>(() => {
    if (!isRouteGrouped) return [];
    const byRoute = new Map<string, RouteGroup>();
    for (const ir of displaySorted) {
      const key = routeGroupKey(ir.row);
      const existing = byRoute.get(key);
      if (existing) {
        existing.rows.push(ir);
      } else {
        byRoute.set(key, {
          key,
          label: `${ir.row.BuyStation || ir.row.BuySystemName} → ${
            ir.row.SellStation || ir.row.SellSystemName
          }`,
          rows: [ir],
        });
      }
    }
    const groups = [...byRoute.values()];
    const routeSafetyTieBreaker = (
      left: RouteGroup,
      right: RouteGroup,
    ): number => {
      const leftMeta = routeAggregateMetricsByRoute[left.key];
      const rightMeta = routeAggregateMetricsByRoute[right.key];
      const eqDiff =
        (rightMeta?.weakestExecutionQuality ?? 0) -
        (leftMeta?.weakestExecutionQuality ?? 0);
      if (eqDiff !== 0) return eqDiff;

      const leftRiskCount = leftMeta?.riskTotalCount ?? 0;
      const rightRiskCount = rightMeta?.riskTotalCount ?? 0;
      const riskCountDiff = leftRiskCount - rightRiskCount;
      if (riskCountDiff !== 0) return riskCountDiff;

      return left.label.localeCompare(right.label);
    };
    groups.sort((a, b) => {
      const leftAggregate = routeAggregateMetricsByRoute[a.key];
      const rightAggregate = routeAggregateMetricsByRoute[b.key];
      const leftAggregateValue = routeAggregateValueForSortKey(
        leftAggregate,
        sortKey,
      );
      const rightAggregateValue = routeAggregateValueForSortKey(
        rightAggregate,
        sortKey,
      );
      if (leftAggregateValue != null || rightAggregateValue != null) {
        const cmp = compareBatchSyntheticValues(
          leftAggregateValue,
          rightAggregateValue,
          sortDir,
        );
        if (cmp !== 0) return cmp;
        if (sortKey === ("RouteSafety" as SortKey)) {
          return routeSafetyTieBreaker(a, b);
        }
        const secondarySafety = compareBatchSyntheticValues(
          leftAggregate?.routeSafetyRank ?? null,
          rightAggregate?.routeSafetyRank ?? null,
          "asc",
        );
        if (secondarySafety !== 0) return secondarySafety;
        return routeSafetyTieBreaker(a, b);
      }

      if (sortKey === ("RouteSafety" as SortKey)) {
        const diff =
          sortDir === "asc"
            ? (leftAggregate?.routeSafetyRank ?? 3) -
              (rightAggregate?.routeSafetyRank ?? 3)
            : (rightAggregate?.routeSafetyRank ?? 3) -
              (leftAggregate?.routeSafetyRank ?? 3);
        if (diff !== 0) return diff;
        return routeSafetyTieBreaker(a, b);
      }
      if (isBatchSyntheticKey(sortKey)) {
        const left = getBatchSyntheticValue(
          a.rows[0].row,
          sortKey,
          batchMetricsByRow,
        );
        const right = getBatchSyntheticValue(
          b.rows[0].row,
          sortKey,
          batchMetricsByRow,
        );
        const cmp = compareBatchSyntheticValues(left, right, sortDir);
        if (cmp !== 0) return cmp;
      }
      const labelCmp = a.label.localeCompare(b.label);
      if (labelCmp !== 0) return labelCmp;
      const aRow = a.rows[0];
      const bRow = b.rows[0];
      return compareRowsStable(aRow, bRow);
    });
    return groups;
  }, [
    batchMetricsByRow,
    batchMetricsByRoute,
    displaySorted,
    isRouteGrouped,
    routeAggregateMetricsByRoute,
    sortDir,
    sortKey,
  ]);

  const routeBadgeMetadataByRoute = useMemo<
    Record<string, RouteBadgeMetadata>
  >(() => {
    if (!isRouteGrouped) return {};
    const out: Record<string, RouteBadgeMetadata> = {};
    for (const group of routeGroups) {
      out[group.key] = deriveRouteBadgeMetadata(
        batchMetricsByRoute[group.key],
        routeAggregateMetricsByRoute[group.key],
      );
    }
    return out;
  }, [
    batchMetricsByRoute,
    isRouteGrouped,
    routeAggregateMetricsByRoute,
    routeGroups,
  ]);

  const filteredRouteGroups = useMemo<RouteGroup[]>(() => {
    if (!isRouteGrouped) return routeGroups;
    if (selectedBadgeFilters.size === 0) return routeGroups;
    return routeGroups.filter((group) => {
      const metadata = routeBadgeMetadataByRoute[group.key];
      if (!metadata) return false;
      for (const filter of selectedBadgeFilters) {
        if (metadata.filters.has(filter)) return true;
      }
      return false;
    });
  }, [
    isRouteGrouped,
    routeBadgeMetadataByRoute,
    routeGroups,
    selectedBadgeFilters,
  ]);

  const endpointPreferenceDeltaByRoute = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const ir of displaySorted) {
      const routeKey = routeGroupKey(ir.row);
      out[routeKey] = (out[routeKey] ?? 0) + (ir.endpointPreferences?.scoreDelta ?? 0);
    }
    return out;
  }, [displaySorted]);

  const routeScoreSummaryByRoute = useMemo<Record<string, RouteScoreSummary>>(
    () => {
      if (!isRouteGrouped) return {};
      const out: Record<string, RouteScoreSummary> = {};
      for (const group of routeGroups) {
        const routeSummary = batchMetricsByRoute[group.key];
        const routeRecommendationScore =
          routeRecommendationScoreFromMetrics({
            routeDailyIskPerJump: routeSummary?.routeDailyIskPerJump ?? 0,
            routeWeakestExecutionQuality:
              routeSummary?.routeWeakestExecutionQuality ?? 0,
            routeWeightedSlippagePct:
              routeSummary?.routeWeightedSlippagePct ?? 0,
            routeTotalRiskCount:
              (routeSummary?.routeRiskSpikeCount ?? 0) +
              (routeSummary?.routeRiskNoHistoryCount ?? 0) +
              (routeSummary?.routeRiskUnstableHistoryCount ?? 0) +
              (routeSummary?.routeRiskThinFillCount ?? 0),
            routeTurnoverDays: routeSummary?.routeTurnoverDays ?? null,
            routeCapacityUsedPercent:
              routeSummary?.routeCapacityUsedPercent ?? null,
          }) ?? 0;
        const rowScores = group.rows.map((item) => ({
          score: scoreFlipResult(
            item.row,
            opportunityProfile,
            displayScoreContext,
          ).finalScore,
          tracked: watchlistIds.has(item.row.TypeID),
        }));
        const bestRowScore =
          rowScores.length > 0 ? Math.max(...rowScores.map((item) => item.score)) : 0;
        const avgRowScore =
          rowScores.length > 0
            ? rowScores.reduce((sum, value) => sum + value.score, 0) /
              rowScores.length
            : 0;
        const trackedCount = rowScores.filter((item) => item.tracked).length;
        const trackedShare =
          rowScores.length > 0 ? trackedCount / rowScores.length : 0;
        const bestTrackedRowScore = rowScores
          .filter((item) => item.tracked)
          .reduce((best, item) => Math.max(best, item.score), 0);
        const trackedBonus = trackedRecommendationBonus({
          trackedShare,
          baselineRecommendationScore: routeRecommendationScore,
          bestTrackedRowScore,
        });
        out[group.key] = {
          routeRecommendationScore: Math.max(
            0,
            routeRecommendationScore +
              (endpointPreferenceDeltaByRoute[group.key] ?? 0) +
              trackedBonus,
          ),
          bestRowScore,
          avgRowScore,
          trackedShare,
        };
      }
      return out;
    },
    [
      batchMetricsByRoute,
      displayScoreContext,
      endpointPreferenceDeltaByRoute,
      isRouteGrouped,
      opportunityProfile,
      routeGroups,
      watchlistIds,
    ],
  );

  const topRoutePickCandidates = useMemo(() => {
    const labelByRoute = new Map<string, string>();
    const endpointDeltaByRoute = new Map<string, number>();
    const endpointRuleHitsByRoute = new Map<string, number>();
    const trackedCountByRoute = new Map<string, number>();
    const deprioritizedByRoute = new Map<string, boolean>();
    const loopOutboundByRoute = new Map<string, boolean>();
    const loopReturnByRoute = new Map<string, boolean>();
    for (const ir of displaySorted) {
      const key = routeGroupKey(ir.row);
      if (!labelByRoute.has(key)) {
        labelByRoute.set(
          key,
          `${ir.row.BuyStation || ir.row.BuySystemName} → ${
            ir.row.SellStation || ir.row.SellSystemName
          }`,
        );
      }
      endpointDeltaByRoute.set(
        key,
        (endpointDeltaByRoute.get(key) ?? 0) +
          (ir.endpointPreferences?.scoreDelta ?? 0),
      );
      endpointRuleHitsByRoute.set(
        key,
        (endpointRuleHitsByRoute.get(key) ?? 0) +
          (ir.endpointPreferences?.appliedRules.length ?? 0),
      );
      if (watchlistIds.has(ir.row.TypeID)) {
        trackedCountByRoute.set(key, (trackedCountByRoute.get(key) ?? 0) + 1);
      }
      if (isFlipResultDeprioritized(ir.row, sessionStationFilters)) {
        deprioritizedByRoute.set(key, true);
      }
      const outboundKey = `${ir.row.BuySystemID}:${ir.row.SellSystemID}`;
      const returnKey = `${ir.row.SellSystemID}:${ir.row.BuySystemID}`;
      loopOutboundByRoute.set(key, routeSafetyMap[outboundKey] !== undefined);
      loopReturnByRoute.set(key, routeSafetyMap[returnKey] !== undefined);
    }
    const candidates: TopRoutePickCandidate[] = [];
    for (const [routeKey, routeLabel] of labelByRoute.entries()) {
      const routeSummary = batchMetricsByRoute[routeKey];
      const routeAggregate = routeAggregateMetricsByRoute[routeKey];
      const confidence = calcRouteConfidence(routeAggregate);
      const routeScoreSummary = routeScoreSummaryByRoute[routeKey];
      candidates.push({
        routeKey,
        routeLabel,
        totalProfit: routeSummary?.routeTotalProfit ?? 0,
        dailyIskPerJump: routeSummary?.routeDailyIskPerJump ?? 0,
        confidenceScore: confidence.score,
        cargoUsePercent: routeSummary?.routeCapacityUsedPercent ?? 0,
        recommendationScore: routeScoreSummary?.routeRecommendationScore ?? 0,
        trackedShare: routeScoreSummary?.trackedShare ?? 0,
        stopCount: routeSummary?.routeStopCount ?? 0,
        riskCount:
          (routeSummary?.routeRiskSpikeCount ?? 0) +
          (routeSummary?.routeRiskNoHistoryCount ?? 0) +
          (routeSummary?.routeRiskUnstableHistoryCount ?? 0) +
          (routeSummary?.routeRiskThinFillCount ?? 0),
        endpointScoreDelta: endpointDeltaByRoute.get(routeKey) ?? 0,
        endpointRuleHits: endpointRuleHitsByRoute.get(routeKey) ?? 0,
        hasWatchlistSignal: (trackedCountByRoute.get(routeKey) ?? 0) > 0,
        hasLoopCandidate: loopOutboundByRoute.get(routeKey) ?? false,
        hasBackhaulCandidate: loopReturnByRoute.get(routeKey) ?? false,
        hasDeprioritizedRows: deprioritizedByRoute.get(routeKey) ?? false,
      });
    }
    return candidates;
  }, [
    batchMetricsByRoute,
    displaySorted,
    routeAggregateMetricsByRoute,
    routeScoreSummaryByRoute,
    routeSafetyMap,
    sessionStationFilters,
    watchlistIds,
  ]);

  const topRoutePicks = useMemo(
    () => selectTopRoutePicks(topRoutePickCandidates),
    [topRoutePickCandidates],
  );

  const suppressionTelemetry = useMemo(
    () => ({
      hardBanFiltered: Math.max(0, results.length - indexed.length),
      softSessionFiltered: Math.max(0, indexed.length - filtered.length),
      endpointExcluded: Math.max(0, indexed.length - filtered.length),
      deprioritizedRows: sorted.filter((item) =>
        isFlipResultDeprioritized(item.row, sessionStationFilters),
      ).length,
    }),
    [filtered.length, indexed.length, results.length, sessionStationFilters, sorted],
  );

  const actionQueue = useMemo<ActionQueueItem[]>(
    () =>
      deriveActionQueue({
        candidates: topRoutePickCandidates,
        suppression: suppressionTelemetry,
      }).slice(0, 6),
    [suppressionTelemetry, topRoutePickCandidates],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("eve:scan-queue-telemetry", {
        detail: {
          ...suppressionTelemetry,
          queueSize: actionQueue.length,
          actionCounts: actionQueue.reduce<Record<string, number>>((acc, item) => {
            acc[item.action] = (acc[item.action] ?? 0) + 1;
            return acc;
          }, {}),
        },
      }),
    );
  }, [actionQueue, suppressionTelemetry]);

  useEffect(() => {
    if (!isRouteGrouped) {
      setExpandedRouteGroups(new Set());
      return;
    }
    const existing = new Set(filteredRouteGroups.map((g) => g.key));
    setExpandedRouteGroups((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const key of prev) {
        if (existing.has(key)) next.add(key);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [filteredRouteGroups, isRouteGrouped]);

  useEffect(() => {
    if (!isItemGrouped) {
      setExpandedItemGroups(new Set());
      return;
    }
    const existing = new Set(itemGroups.map((g) => g.key));
    setExpandedItemGroups((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const key of prev) {
        if (existing.has(key)) next.add(key);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [isItemGrouped, itemGroups]);

  const defaultCollapsedRegionGroups = useMemo(() => {
    if (!isRegionGrouped || regionGroups.length <= 1) {
      return new Set<string>();
    }
    return new Set(regionGroups.slice(1).map((g) => g.key));
  }, [isRegionGrouped, regionGroups]);

  useEffect(() => {
    if (!isRegionGrouped) {
      setCollapsedRegionGroups(new Set());
      setRegionCollapseInitialized(false);
      return;
    }
    // New scan result set: reset collapse state and apply default collapsed on first grouped render.
    setCollapsedRegionGroups(new Set());
    setRegionCollapseInitialized(false);
  }, [isRegionGrouped, results]);

  useEffect(() => {
    if (
      !isRegionGrouped ||
      regionCollapseInitialized ||
      regionGroups.length === 0
    ) {
      return;
    }
    setCollapsedRegionGroups(new Set(defaultCollapsedRegionGroups));
    setRegionCollapseInitialized(true);
  }, [
    defaultCollapsedRegionGroups,
    isRegionGrouped,
    regionCollapseInitialized,
    regionGroups.length,
  ]);

  useEffect(() => {
    if (!isRegionGrouped) return;
    const existing = new Set(regionGroups.map((g) => g.key));
    setCollapsedRegionGroups((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const key of prev) {
        if (existing.has(key)) next.add(key);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [isRegionGrouped, regionGroups]);

  const effectiveCollapsedRegionGroups = useMemo(() => {
    if (!isRegionGrouped) return collapsedRegionGroups;
    if (regionCollapseInitialized) return collapsedRegionGroups;
    return defaultCollapsedRegionGroups;
  }, [
    collapsedRegionGroups,
    defaultCollapsedRegionGroups,
    isRegionGrouped,
    regionCollapseInitialized,
  ]);

  const visibleRows = useMemo(() => {
    if (isRegionGrouped) {
      const rows: IndexedRow[] = [];
      for (const group of regionGroups) {
        if (effectiveCollapsedRegionGroups.has(group.key)) continue;
        rows.push(...group.rows);
      }
      return rows;
    }
    if (isRouteGrouped) {
      const rows: IndexedRow[] = [];
      for (const group of filteredRouteGroups) {
        if (group.rows.length === 0) continue;
        rows.push(group.rows[0]);
        if (!expandedRouteGroups.has(group.key)) continue;
        rows.push(...group.rows.slice(1));
      }
      return rows;
    }
    if (!isItemGrouped) return displaySorted;

    const rows: IndexedRow[] = [];
    for (const group of itemGroups) {
      if (group.rows.length === 0) continue;
      rows.push(group.rows[0]);
      if (group.rows.length <= 1 || !expandedItemGroups.has(group.key))
        continue;
      const limit = Math.max(
        1,
        groupRowLimit.get(group.key) ?? GROUP_PAGE_SIZE,
      );
      rows.push(...group.rows.slice(1, limit));
    }
    return rows;
  }, [
    displaySorted,
    effectiveCollapsedRegionGroups,
    expandedItemGroups,
    expandedRouteGroups,
    groupRowLimit,
    isItemGrouped,
    isRouteGrouped,
    isRegionGrouped,
    itemGroups,
    filteredRouteGroups,
    regionGroups,
  ]);

  const { pageRows, totalPages, safePage } = useMemo(() => {
    if (isRegionGrouped || isItemGrouped || isRouteGrouped) {
      return { pageRows: visibleRows, totalPages: 1, safePage: 0 };
    }
    const totalPages = Math.max(1, Math.ceil(displaySorted.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageRows = displaySorted.slice(
      safePage * PAGE_SIZE,
      (safePage + 1) * PAGE_SIZE,
    );
    return { pageRows, totalPages, safePage };
  }, [
    displaySorted,
    isItemGrouped,
    isRegionGrouped,
    isRouteGrouped,
    page,
    visibleRows,
  ]);

  // Reset page when data/filters/sort change
  useEffect(() => {
    setPage(0);
  }, [
    results,
    filters,
    sortKey,
    sortDir,
    showHiddenRows,
    hiddenMap,
    groupByItem,
    routeViewMode,
    selectedBadgeFilters,
  ]);

  // Reset selection/pins/context menu/group limits when results change
  useEffect(() => {
    setSelectedIds(new Set());
    setPinnedKeys(new Set());
    setContextMenu(null);
    setGroupRowLimit(new Map());
    if (!scanning && results.length > 0) {
      setLastScanTs(Date.now());
    }
  }, [results]);

  // Drop filters for columns that are no longer visible
  useEffect(() => {
    const allowed = new Set(columnDefs.map((col) => col.key));
    setFilters((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (allowed.has(key as SortKey)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columnDefs]);

  // Prune selected rows that are hidden by filters
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visibleIds = new Set(visibleRows.map((ir) => ir.id));
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [selectedIds.size, visibleRows]);

  useEffect(() => {
    if (!ignoredModalOpen) {
      setIgnoredSearch("");
      setIgnoredTab("all");
      setIgnoredSelectedKeys(new Set());
    }
  }, [ignoredModalOpen]);

  useEffect(() => {
    setIgnoredSelectedKeys((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const key of prev) {
        if (hiddenMap[key]) next.add(key);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [hiddenMap]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCacheNowTs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const cacheView = useMemo(() => {
    const scopeLabel =
      tradeStateTab === "region"
        ? t("hiddenScopeRegionScan")
        : t("hiddenScopeRadiusScan");
    const fallbackRegionCount = showRegions ? 2 : 1;
    return mapServerCacheMeta(
      cacheMeta,
      scopeLabel,
      fallbackRegionCount,
      lastScanTs,
    );
  }, [cacheMeta, lastScanTs, showRegions, t, tradeStateTab]);

  const cacheSecondsLeft = useMemo(
    () => Math.floor((cacheView.nextExpiryAt - cacheNowTs) / 1000),
    [cacheNowTs, cacheView.nextExpiryAt],
  );
  const isCacheStale = useMemo(
    () => cacheSecondsLeft <= 0 && cacheNowTs >= cacheStaleSuppressedUntilTs,
    [cacheNowTs, cacheSecondsLeft, cacheStaleSuppressedUntilTs],
  );

  const cacheBadgeText = useMemo(() => {
    if (isCacheStale) return t("cacheStale");
    return t("cacheLabel", { time: formatCountdown(cacheSecondsLeft) });
  }, [cacheSecondsLeft, isCacheStale, t]);

  useEffect(() => {
    setCacheStaleSuppressedUntilTs(0);
  }, [cacheView.currentRevision]);

  const refreshHiddenStates = useCallback(
    async (currentRevision?: number) => {
      try {
        const resp = await getStationTradeStates({
          tab: tradeStateTab,
          currentRevision,
        });
        const states = Array.isArray(resp.states) ? resp.states : [];
        const byStateKey = new Map<string, IndexedRow>();
        for (const ir of indexed) {
          const ids = flipStateIDs(ir.row);
          byStateKey.set(
            tradeStateIndexKey(ids.typeID, ids.stationID, ids.regionID),
            ir,
          );
        }
        setHiddenMap((prev) => {
          const next: Record<string, HiddenFlipEntry> = {};
          for (const s of states) {
            const stateKey = tradeStateIndexKey(
              s.type_id,
              s.station_id,
              s.region_id,
            );
            const ir = byStateKey.get(stateKey);
            const key = ir ? flipStateKey(ir.row) : stateKey;
            const prevEntry = prev[key];
            next[key] = {
              key,
              mode: s.mode,
              updatedAt: s.updated_at,
              typeName:
                ir?.row.TypeName ??
                prevEntry?.typeName ??
                t("hiddenTypeFallback", { id: s.type_id }),
              buyStation:
                ir?.row.BuyStation ??
                prevEntry?.buyStation ??
                t("hiddenUnknown"),
              sellStation:
                ir?.row.SellStation ??
                prevEntry?.sellStation ??
                t("hiddenUnknown"),
              stateTypeID: s.type_id,
              stateStationID: s.station_id,
              stateRegionID: s.region_id,
            };
          }
          return next;
        });
      } catch {
        // best effort
      }
    },
    [indexed, t, tradeStateTab],
  );

  useEffect(() => {
    if (scanning) return;
    void refreshHiddenStates(cacheView.currentRevision);
  }, [cacheView.currentRevision, refreshHiddenStates, scanning, results]);

  // ── Summary stats ──
  const summary = useMemo(() => {
    const baseRows =
      isItemGrouped && selectedIds.size === 0 ? displaySorted : visibleRows;
    const rows =
      selectedIds.size > 0
        ? visibleRows.filter((ir) => selectedIds.has(ir.id))
        : baseRows;
    if (rows.length === 0) return null;
    const totalProfit = rows.reduce(
      (s, ir) =>
        s + (ir.row.RealProfit ?? ir.row.ExpectedProfit ?? ir.row.TotalProfit),
      0,
    );
    const avgMargin =
      rows.reduce((s, ir) => s + ir.row.MarginPercent, 0) / rows.length;
    return { totalProfit, avgMargin, count: rows.length };
  }, [displaySorted, isItemGrouped, selectedIds, visibleRows]);

  // ── Callbacks ──
  const toggleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
      setDecisionLens("custom");
    },
    [sortKey],
  );

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);
  const applyDecisionLens = useCallback(
    (preset: DecisionLensPreset) => {
      const rowModeMapping: Record<
        Exclude<DecisionLensPreset, "best_route_pack">,
        { key: SortKey; dir: SortDir }
      > = {
        recommended: { key: "DailyIskPerJump", dir: "desc" },
        fastest_isk: { key: "RealIskPerJump", dir: "desc" },
        cargo: { key: "RealIskPerM3PerJump", dir: "desc" },
        safest: { key: "RouteSafety", dir: "asc" },
        capital_efficient: { key: "TurnoverDays", dir: "asc" },
      };
      const routeModeMapping: Record<
        DecisionLensPreset,
        { key: SortKey; dir: SortDir }
      > = {
        recommended: { key: "RoutePackRecommendationScore", dir: "desc" },
        best_route_pack: { key: "RoutePackDailyIskPerJump", dir: "desc" },
        fastest_isk: { key: "RoutePackRealIskPerJump", dir: "desc" },
        safest: { key: "RouteSafety", dir: "asc" },
        cargo: { key: "RoutePackRealIskPerM3PerJump", dir: "desc" },
        capital_efficient: { key: "RoutePackTurnoverDays", dir: "asc" },
      };
      const next =
        routeViewMode === "route"
          ? routeModeMapping[preset]
          : (rowModeMapping[
              preset as Exclude<typeof preset, "best_route_pack">
            ] ?? routeModeMapping.fastest_isk);
      setSortKey(next.key);
      setSortDir(next.dir);
      setDecisionLens(preset);
    },
    [routeViewMode],
  );

  useEffect(() => {
    if (decisionLens === "recommended") {
      applyDecisionLens("recommended");
    }
  }, [applyDecisionLens, decisionLens]);

  const hasActiveFilters = Object.values(filters).some((v) => !!v);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === visibleRows.length) return new Set();
      return new Set(visibleRows.map((ir) => ir.id));
    });
  }, [visibleRows]);

  const togglePin = useCallback(
    (row: FlipResult) => {
      const mapped = mapScanRowToPinnedOpportunity(row);
      const stableKey = mapped.opportunity_key;
      const removing = pinnedKeys.has(stableKey);
      setPinnedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(stableKey)) next.delete(stableKey);
        else next.add(stableKey);
        return next;
      });
      (removing
        ? removePinnedOpportunity(stableKey)
        : addPinnedOpportunity(mapped)
      ).catch(() => {
        setPinnedKeys((prev) => {
          const next = new Set(prev);
          if (removing) next.add(stableKey);
          else next.delete(stableKey);
          return next;
        });
        addToast(t("watchlistError"), "error", 3000);
      });
    },
    [addToast, pinnedKeys, t],
  );

  const toggleItemGroupExpanded = useCallback((typeID: number) => {
    const key = String(typeID ?? 0);
    startTransition(() => {
      setExpandedItemGroups((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    });
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: number, row: FlipResult) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, id, row });
    },
    [],
  );

  const copyText = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      addToast(t("copied"), "success", 2000);
      setContextMenu(null);
    },
    [addToast, t],
  );

  const addBuyStationIgnore = useCallback(
    (stationID: number) => {
      if (stationID <= 0) return;
      onUpdateSessionStationFilters?.((prev) => ({
        ...prev,
        ignoredBuyStationIds: new Set(prev.ignoredBuyStationIds).add(stationID),
      }));
      setContextMenu(null);
    },
    [onUpdateSessionStationFilters],
  );

  const addSellStationIgnore = useCallback(
    (stationID: number) => {
      if (stationID <= 0) return;
      onUpdateSessionStationFilters?.((prev) => ({
        ...prev,
        ignoredSellStationIds: new Set(prev.ignoredSellStationIds).add(stationID),
      }));
      setContextMenu(null);
    },
    [onUpdateSessionStationFilters],
  );

  const addDeprioritizedStation = useCallback(
    (stationID: number) => {
      if (stationID <= 0) return;
      onUpdateSessionStationFilters?.((prev) => ({
        ...prev,
        deprioritizedStationIds: new Set(prev.deprioritizedStationIds).add(
          stationID,
        ),
      }));
      setContextMenu(null);
    },
    [onUpdateSessionStationFilters],
  );

  const clearTemporaryStationFilters = useCallback(() => {
    onUpdateSessionStationFilters?.((prev) => ({
      ...prev,
      ignoredBuyStationIds: new Set<number>(),
      ignoredSellStationIds: new Set<number>(),
      deprioritizedStationIds: new Set<number>(),
    }));
    setContextMenu(null);
  }, [onUpdateSessionStationFilters]);

  const setRowHiddenState = useCallback(
    async (row: FlipResult, mode: HiddenMode) => {
      const key = flipStateKey(row);
      const ids = flipStateIDs(row);
      const entry: HiddenFlipEntry = {
        key,
        mode,
        updatedAt: new Date().toISOString(),
        typeName: row.TypeName,
        buyStation: row.BuyStation,
        sellStation: row.SellStation,
        stateTypeID: ids.typeID,
        stateStationID: ids.stationID,
        stateRegionID: ids.regionID,
      };
      setHiddenMap((prev) => ({ ...prev, [key]: entry }));
      setContextMenu(null);

      // Undo toast
      const toastText =
        mode === "done"
          ? t("hiddenContextMarkedDoneToast")
          : t("hiddenContextIgnoredToast");
      const toastId = addToast(toastText, "info", 5000, {
        label: t("undo"),
        onClick: () => {
          setHiddenMap((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          void deleteStationTradeStates({
            tab: tradeStateTab,
            keys: [
              {
                type_id: ids.typeID,
                station_id: ids.stationID,
                region_id: ids.regionID,
              },
            ],
          });
        },
      });

      try {
        await setStationTradeState({
          tab: tradeStateTab,
          type_id: ids.typeID,
          station_id: ids.stationID,
          region_id: ids.regionID,
          mode,
          until_revision: mode === "done" ? cacheView.currentRevision : 0,
        });
      } catch {
        removeToast(toastId);
        addToast(t("hiddenStateSaveFailed"), "error", 2600);
        void refreshHiddenStates(cacheView.currentRevision);
      }
    },
    [
      addToast,
      removeToast,
      cacheView.currentRevision,
      refreshHiddenStates,
      t,
      tradeStateTab,
    ],
  );

  const unhideRowsByKeys = useCallback(
    async (keys: string[]) => {
      if (keys.length === 0) return;
      const unique = [...new Set(keys)];
      const payload = unique
        .map((k) => hiddenMap[k])
        .filter(Boolean)
        .map((e) => ({
          type_id: e.stateTypeID,
          station_id: e.stateStationID,
          region_id: e.stateRegionID,
        }));
      setHiddenMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const key of unique) {
          if (next[key]) {
            delete next[key];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setIgnoredSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const key of unique) next.delete(key);
        return next;
      });
      try {
        if (payload.length > 0) {
          await deleteStationTradeStates({ tab: tradeStateTab, keys: payload });
        }
      } catch {
        addToast(t("hiddenStateUnhideFailed"), "error", 2600);
        void refreshHiddenStates(cacheView.currentRevision);
      }
    },
    [
      addToast,
      cacheView.currentRevision,
      hiddenMap,
      refreshHiddenStates,
      t,
      tradeStateTab,
    ],
  );

  const clearDoneHiddenRows = useCallback(async () => {
    const hasDone = Object.values(hiddenMap).some((h) => h.mode === "done");
    if (!hasDone) return;
    setHiddenMap((prev) => {
      const next: Record<string, HiddenFlipEntry> = {};
      for (const [key, entry] of Object.entries(prev)) {
        if (entry.mode !== "done") next[key] = entry;
      }
      return next;
    });
    try {
      await clearStationTradeStates({ tab: tradeStateTab, mode: "done" });
    } catch {
      addToast(t("hiddenStateClearDoneFailed"), "error", 2600);
      void refreshHiddenStates(cacheView.currentRevision);
    }
  }, [
    addToast,
    cacheView.currentRevision,
    hiddenMap,
    refreshHiddenStates,
    t,
    tradeStateTab,
  ]);

  const clearAllHiddenRows = useCallback(async () => {
    if (Object.keys(hiddenMap).length === 0) return;
    setHiddenMap({});
    setIgnoredSelectedKeys(new Set());
    try {
      await clearStationTradeStates({ tab: tradeStateTab });
    } catch {
      addToast(t("hiddenStateClearAllFailed"), "error", 2600);
      void refreshHiddenStates(cacheView.currentRevision);
    }
  }, [
    addToast,
    cacheView.currentRevision,
    hiddenMap,
    refreshHiddenStates,
    t,
    tradeStateTab,
  ]);

  const handleRebootCache = useCallback(async () => {
    if (cacheRebooting) return;
    setCacheRebooting(true);
    try {
      const res = await rebootStationCache();
      const nowTs = Date.now();
      setLastScanTs(nowTs);
      setCacheNowTs(nowTs);
      // Give backend cache reboot a short grace period before stale marker returns.
      setCacheStaleSuppressedUntilTs(nowTs + 45_000);
      addToast(t("cacheRebooted", { count: res.cleared }), "success", 2400);
      addToast(t("cacheRebootRescanHint"), "info", 2600);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("cacheRebootFailed");
      addToast(msg, "error", 2800);
    } finally {
      setCacheRebooting(false);
    }
  }, [addToast, cacheRebooting, t]);

  const exportCSV = useCallback(() => {
    const rows =
      selectedIds.size > 0
        ? visibleRows.filter((ir) => selectedIds.has(ir.id))
        : visibleRows;
    const header = columnDefs.map((c) => t(c.labelKey)).join(",");
    const csvRows = rows.map((ir) =>
      columnDefs
        .map((col) => {
          const str = String(
            getCellValue(
              ir.row,
              col.key,
              batchMetricsByRow,
              opportunityProfile,
            ) ?? "",
          );
          return str.includes(",") ? `"${str}"` : str;
        })
        .join(","),
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eve-flipper-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`${t("exportCSV")}: ${rows.length} rows`, "success", 2000);
  }, [
    visibleRows,
    selectedIds,
    columnDefs,
    batchMetricsByRow,
    opportunityProfile,
    displayScoreContext,
    addToast,
    t,
  ]);

  const copyTable = useCallback(() => {
    const rows =
      selectedIds.size > 0
        ? visibleRows.filter((ir) => selectedIds.has(ir.id))
        : visibleRows;
    const header = columnDefs.map((c) => t(c.labelKey)).join("\t");
    const tsv = rows.map((ir) =>
      columnDefs
        .map((col) =>
          fmtCell(
            col,
            ir.row,
            batchMetricsByRow,
            opportunityProfile,
            displayScoreContext,
          ),
        )
        .join("\t"),
    );
    navigator.clipboard.writeText([header, ...tsv].join("\n"));
    addToast(t("copied"), "success", 2000);
  }, [
    visibleRows,
    selectedIds,
    columnDefs,
    batchMetricsByRow,
    opportunityProfile,
    displayScoreContext,
    addToast,
    t,
  ]);

  const hiddenEntries = useMemo(
    () =>
      Object.values(hiddenMap).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [hiddenMap],
  );
  const hiddenCounts = useMemo(() => {
    let done = 0;
    let ignored = 0;
    for (const row of hiddenEntries) {
      if (row.mode === "done") done++;
      if (row.mode === "ignored") ignored++;
    }
    return { total: hiddenEntries.length, done, ignored };
  }, [hiddenEntries]);
  const filteredHiddenEntries = useMemo(() => {
    const q = ignoredSearch.trim().toLowerCase();
    return hiddenEntries.filter((entry) => {
      if (ignoredTab !== "all" && entry.mode !== ignoredTab) return false;
      if (!q) return true;
      return (
        entry.typeName.toLowerCase().includes(q) ||
        entry.buyStation.toLowerCase().includes(q) ||
        entry.sellStation.toLowerCase().includes(q)
      );
    });
  }, [hiddenEntries, ignoredSearch, ignoredTab]);

  const contextHiddenEntry = contextMenu
    ? hiddenMap[flipStateKey(contextMenu.row)]
    : undefined;

  const activeSessionFilterChips = useMemo(() => {
    if (!sessionStationFilters) return [] as Array<{ key: string; label: string; onRemove: () => void }>;
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    for (const stationID of sessionStationFilters.ignoredBuyStationIds) {
      chips.push({
        key: `buy:${stationID}`,
        label: `Ignore buy: ${stationID}`,
        onRemove: () =>
          onUpdateSessionStationFilters?.((prev) => {
            const next = {
              ...prev,
              ignoredBuyStationIds: new Set(prev.ignoredBuyStationIds),
            };
            next.ignoredBuyStationIds.delete(stationID);
            return next;
          }),
      });
    }
    for (const stationID of sessionStationFilters.ignoredSellStationIds) {
      chips.push({
        key: `sell:${stationID}`,
        label: `Ignore sell: ${stationID}`,
        onRemove: () =>
          onUpdateSessionStationFilters?.((prev) => {
            const next = {
              ...prev,
              ignoredSellStationIds: new Set(prev.ignoredSellStationIds),
            };
            next.ignoredSellStationIds.delete(stationID);
            return next;
          }),
      });
    }
    for (const stationID of sessionStationFilters.deprioritizedStationIds) {
      chips.push({
        key: `deprio:${stationID}`,
        label: `Deprioritized: ${stationID}`,
        onRemove: () =>
          onUpdateSessionStationFilters?.((prev) => {
            const next = {
              ...prev,
              deprioritizedStationIds: new Set(prev.deprioritizedStationIds),
            };
            next.deprioritizedStationIds.delete(stationID);
            return next;
          }),
      });
    }
    return chips;
  }, [onUpdateSessionStationFilters, sessionStationFilters]);

  // Stable LMB handler for region detail panel
  const onLmbClick = useCallback((row: FlipResult) => {
    setDayDetailRow(row);
  }, []);

  // ── Keyboard navigation (E feature) ──
  // Update ref on every render so the one-time effect can always read fresh state
  keyNavRef.current = {
    pageRows,
    focusedRowId,
    setFocusedRowId,
    setExecPlanRow,
    setRowHiddenState,
    hiddenMap,
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // App keeps multiple tables mounted (hidden tabs preserve state).
      // Process shortcuts only for the currently visible table instance.
      const root = keyNavRootRef.current;
      if (!root || root.offsetParent === null) return;

      // Don't intercept when typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const {
        pageRows,
        focusedRowId,
        setFocusedRowId,
        setExecPlanRow,
        setRowHiddenState,
      } = keyNavRef.current;
      if (pageRows.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx =
          focusedRowId != null
            ? pageRows.findIndex((ir) => ir.id === focusedRowId)
            : -1;
        let nextIdx: number;
        if (e.key === "ArrowDown") {
          nextIdx =
            currentIdx < 0 ? 0 : Math.min(currentIdx + 1, pageRows.length - 1);
        } else {
          nextIdx = currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
        }
        setFocusedRowId(pageRows[nextIdx].id);
        return;
      }

      if (!focusedRowId) return;
      const focused = pageRows.find((ir) => ir.id === focusedRowId);
      if (!focused) return;

      if (e.key === "Enter") {
        e.preventDefault();
        setExecPlanRow(focused.row);
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        void setRowHiddenState(focused.row, "done");
        setFocusedRowId(null);
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        void setRowHiddenState(focused.row, "ignored");
        setFocusedRowId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedRowId == null) return;
    document
      .querySelector(`[data-row-id="${focusedRowId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [focusedRowId]);

  const jumpToRouteGroup = useCallback((routeKey: string) => {
    setRouteViewMode("route");
    setExpandedRouteGroups((prev) => {
      const next = new Set(prev);
      next.add(routeKey);
      return next;
    });
    setTimeout(() => {
      const node = document.querySelector(
        `[data-route-group="${routeKey}"]`,
      ) as { scrollIntoView?: (args?: unknown) => void } | null;
      if (typeof node?.scrollIntoView === "function") {
        node.scrollIntoView({ block: "nearest" });
      }
    }, 0);
  }, []);

  // renderDataRow: renders a DataRow memo component — only the changed row re-renders
  const handleRouteSafetyClick = useCallback(
    (from: number, to: number, e: import("react").MouseEvent) => {
      e.stopPropagation();
      const key = `${from}:${to}`;
      const entry = routeSafetyMap[key];
      if (entry && entry.status === "full") {
        setRouteSafetyModal({ systems: entry.systems });
        return;
      }
      getGankCheck(from, to).then((systems) => {
        setRouteSafetyMap((prev) => {
          const pe = prev[key];
          const danger = pe && pe.status !== "loading" ? pe.danger : "green";
          const kills = pe && pe.status !== "loading" ? pe.kills : 0;
          const totalISK = pe && pe.status !== "loading" ? pe.totalISK : 0;
          return {
            ...prev,
            [key]: { status: "full", danger, kills, totalISK, systems },
          };
        });
        setRouteSafetyModal({ systems });
      });
    },
    [routeSafetyMap],
  );

  const renderDataRow = useCallback(
    (
      ir: IndexedRow,
      globalIdx: number,
      itemVariantState?: { expandable: boolean; expanded: boolean },
    ) => (
      <DataRow
        key={ir.id}
        ir={ir}
        globalIdx={globalIdx}
        columnDefs={columnDefs}
        compactMode={compactMode}
        isPinned={pinnedKeys.has(
          mapScanRowToPinnedOpportunity(ir.row).opportunity_key,
        )}
        isSelected={selectedIds.has(ir.id)}
        isFocused={focusedRowId === ir.id}
        isTracked={watchlistIds.has(ir.row.TypeID)}
        showTrackedChip={showTrackedChip}
        variant={variantByRowId.get(ir.id)}
        rowHidden={hiddenMap[flipStateKey(ir.row)]}
        isItemGrouped={isItemGrouped}
        isRegionGrouped={isRegionGrouped}
        variantExpandable={itemVariantState?.expandable ?? false}
        variantExpanded={itemVariantState?.expanded ?? false}
        onToggleVariantGroup={toggleItemGroupExpanded}
        onContextMenu={handleContextMenu}
        onLmbClick={onLmbClick}
        onToggleSelect={toggleSelect}
        onTogglePin={togglePin}
        tFn={t}
        routeSafetyEntry={
          routeSafetyMap[`${ir.row.BuySystemID}:${ir.row.SellSystemID}`]
        }
        onRouteSafetyClick={handleRouteSafetyClick}
        onOpenScore={setScoreExplainRow}
        batchMetricsByRow={batchMetricsByRow}
        opportunityProfile={opportunityProfile}
        scoreContext={displayScoreContext}
        endpointPreferenceMeta={endpointPreferenceMetaByRowId.get(ir.id)}
      />
    ),
    [
      columnDefs,
      compactMode,
      focusedRowId,
      handleContextMenu,
      hiddenMap,
      isItemGrouped,
      isRegionGrouped,
      onLmbClick,
      pinnedKeys,
      selectedIds,
      t,
      toggleItemGroupExpanded,
      togglePin,
      toggleSelect,
      variantByRowId,
      watchlistIds,
      showTrackedChip,
      routeSafetyMap,
      handleRouteSafetyClick,
      batchMetricsByRow,
      opportunityProfile,
      displayScoreContext,
      endpointPreferenceMetaByRowId,
    ],
  );

  // ── Render ──
  return (
    <div ref={keyNavRootRef} className="relative flex-1 flex flex-col min-h-0">
      {activeSessionFilterChips.length > 0 && (
        <div className="shrink-0 px-2 pt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          {activeSessionFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-eve-accent/40 bg-eve-accent/10 text-eve-accent hover:bg-eve-accent/20"
              title="Remove temporary filter"
            >
              {chip.label} <span aria-hidden>✕</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearTemporaryStationFilters}
            className="px-2 py-0.5 rounded-sm border border-eve-border text-eve-dim hover:text-eve-text"
          >
            Clear all
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div className="shrink-0 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-2 text-eve-dim">
            {scanning ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-eve-accent animate-pulse" />
                {progress}
              </span>
            ) : results.length > 0 ? (
              filtered.length !== indexed.length ? (
                t("showing", { shown: filtered.length, total: indexed.length })
              ) : (
                t("foundDeals", { count: indexed.length })
              )
            ) : null}
            {!scanning && results.length > 0 && hiddenCounts.total > 0 && (
              <span className="text-eve-dim">
                | {" "}
                {t("hiddenVisibleSummary", {
                  visible: displaySorted.length,
                  hidden: hiddenCounts.total,
                })}
              </span>
            )}
            {pinnedKeys.size > 0 && (
              <span className="text-eve-accent">📌 {t("pinned", { count: pinnedKeys.size })}</span>
            )}
            {watchlistIds.size > 0 && (
              <span className="text-emerald-300">★ Tracked: {watchlistIds.size}</span>
            )}
            {selectedIds.size > 0 && (
              <span className="text-eve-accent">{t("selected", { count: selectedIds.size })}</span>
            )}
          </div>

          <div className="flex-1" />

          {!isRegionGrouped && !isItemGrouped && !isRouteGrouped && displaySorted.length > PAGE_SIZE && (
            <div className="flex items-center gap-1 text-eve-dim">
              <button onClick={() => setPage(0)} disabled={safePage === 0} className="px-1.5 py-0.5 rounded-sm hover:text-eve-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="px-1.5 py-0.5 rounded-sm hover:text-eve-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
              <span className="px-2 text-eve-text font-mono tabular-nums">{safePage + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1} className="px-1.5 py-0.5 rounded-sm hover:text-eve-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
              <button onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1} className="px-1.5 py-0.5 rounded-sm hover:text-eve-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
            </div>
          )}

          {results.length > 0 && !scanning && (
            <>
              {!isRegionGrouped && (
                <>
                  <div className="inline-flex items-center rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] overflow-hidden">
                    {([
                      ["rows", "Row view"],
                      ["route", "Group by route"],
                    ] as const).map(([mode, label]) => {
                      const active = routeViewMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setRouteViewMode(mode)}
                          className={`px-2 py-0.5 border-r last:border-r-0 border-eve-border/40 transition-colors ${
                            active
                              ? "bg-eve-accent/15 text-eve-accent border-eve-accent/40"
                              : "text-eve-dim hover:text-eve-text"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {routeViewMode === "rows" && (
                    <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] cursor-pointer">
                      <input type="checkbox" checked={groupByItem} onChange={(e) => setGroupByItem(e.target.checked)} className="accent-eve-accent" />
                      <span>Group by item</span>
                    </label>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setShowAdvancedToolbar((v) => !v)}
                className="px-2 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] hover:border-eve-accent/50 hover:text-eve-accent transition-colors"
                aria-expanded={showAdvancedToolbar}
                aria-controls="scan-results-advanced-toolbar"
                title="Toggle advanced controls"
              >
                Advanced {showAdvancedToolbar ? "▾" : "▸"}
              </button>
            </>
          )}

          <ToolbarBtn
            label={t("columnsButton")}
            title={t("columnsPanelTitle")}
            active={showColumnPanel}
            onClick={() => setShowColumnPanel((v) => !v)}
          />
          <ToolbarBtn
            label="⊞"
            title={showFilters ? t("clearFilters") : t("filterPlaceholder")}
            active={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          />
          {hasActiveFilters && <ToolbarBtn label="✕" title={t("clearFilters")} onClick={clearFilters} />}
          {results.length > 0 && (
            <>
              <ToolbarBtn
                label={compactMode ? "⊞" : "⊟"}
                title={compactMode ? t("comfyRows") : t("compactRows")}
                active={compactMode}
                onClick={() => setCompactMode((v) => !v)}
              />
              <ToolbarBtn label="CSV" title={t("exportCSV")} onClick={exportCSV} />
              <ToolbarBtn label="⎘" title={t("copyTable")} onClick={copyTable} />
            </>
          )}
        </div>

        {showAdvancedToolbar && results.length > 0 && !scanning && (
          <div id="scan-results-advanced-toolbar" className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            {!isRegionGrouped && (
              <>
                <div className="inline-flex items-center rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] overflow-hidden">
                  {([
                    ["all", "Tracked: All"],
                    ["tracked_only", "Tracked only"],
                    ["hide_non_tracked", "Hide non-tracked"],
                  ] as const).map(([mode, label]) => {
                    const active = trackedVisibilityMode === mode;
                    return (
                      <button key={mode} type="button" onClick={() => setTrackedVisibilityMode(mode)} className={`px-2 py-0.5 border-r last:border-r-0 border-eve-border/40 transition-colors ${active ? "bg-eve-accent/15 text-eve-accent border-eve-accent/40" : "text-eve-dim hover:text-eve-text"}`} title={label}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] cursor-pointer">
                  <input type="checkbox" checked={trackedFirst} onChange={(e) => setTrackedFirst(e.target.checked)} className="accent-eve-accent" />
                  <span>Tracked first</span>
                </label>
                <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] cursor-pointer">
                  <input type="checkbox" checked={showTrackedChip} onChange={(e) => setShowTrackedChip(e.target.checked)} className="accent-eve-accent" />
                  <span>Tracked chip</span>
                </label>
                <div className="inline-flex items-center gap-1 px-1 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px]">
                  <span className="text-eve-dim px-1">Endpoint prefs</span>
                  <select
                    value={endpointPreferenceMode}
                    onChange={(e) =>
                      setEndpointPreferenceMode(
                        e.target.value === EndpointPreferenceApplicationMode.Hide
                          ? EndpointPreferenceApplicationMode.Hide
                          : EndpointPreferenceApplicationMode.Deprioritize,
                      )
                    }
                    className="bg-eve-input border border-eve-border rounded-sm px-1 py-0.5 text-[11px]"
                  >
                    <option value={EndpointPreferenceApplicationMode.Deprioritize}>Deprioritize</option>
                    <option value={EndpointPreferenceApplicationMode.Hide}>Hide</option>
                  </select>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const key = e.target.value as keyof typeof ENDPOINT_PREFERENCE_PRESETS;
                      if (!key || !ENDPOINT_PREFERENCE_PRESETS[key]) return;
                      setEndpointPreferenceProfile(ENDPOINT_PREFERENCE_PRESETS[key]);
                      e.currentTarget.value = "";
                    }}
                    className="bg-eve-input border border-eve-border rounded-sm px-1 py-0.5 text-[11px]"
                    title="Quick profile preset"
                  >
                    <option value="">Preset…</option>
                    <option value="safe_arbitrage">Safe Arbitrage</option>
                    <option value="structure_exit">Structure Exit</option>
                    <option value="low_attention">Low Attention</option>
                  </select>
                  <input value={majorHubInput} onChange={(e) => setMajorHubInput(e.target.value)} className="w-44 bg-eve-input border border-eve-border rounded-sm px-1 py-0.5 text-[11px]" placeholder="Major hubs (comma-separated)" title="Editable major hub systems" />
                </div>
              </>
            )}

            <button type="button" onClick={() => setShowHiddenRows((v) => !v)} title={t("showHidden")} className={`px-2 py-0.5 rounded-sm border text-[13px] transition-colors ${showHiddenRows ? "border-eve-accent/60 text-eve-accent bg-eve-accent/10" : "border-eve-border/60 text-eve-text/50 bg-eve-dark/40 hover:border-eve-accent/40 hover:text-eve-accent/70"}`}>
              {showHiddenRows ? "Hide hidden" : "Show hidden"}
            </button>
            <button type="button" onClick={() => setIgnoredModalOpen(true)} className="px-2 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] hover:border-eve-accent/50 hover:text-eve-accent transition-colors" title={t("hiddenOpenManagerTitle")}>
              {t("hiddenButton", { count: hiddenCounts.total })}
            </button>
            <button type="button" onClick={() => { void handleRebootCache(); }} disabled={cacheRebooting} className={`px-2 py-0.5 rounded-sm border bg-eve-dark/40 text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isCacheStale ? "border-red-500/60 text-red-300 hover:bg-red-900/20" : "border-eve-border/60 text-eve-dim hover:border-eve-accent/50 hover:text-eve-accent"}`} title={t("cacheHardResetTitle")}>
              {cacheRebooting ? t("cacheRebooting") : t("cacheReboot")}
            </button>
            <button type="button" className={`px-2 py-0.5 rounded-sm border text-[11px] font-mono transition-colors ${isCacheStale ? "border-red-500/50 text-red-300 bg-red-950/30" : "border-eve-border/60 text-eve-accent bg-eve-dark/40 hover:border-eve-accent/50"}`} title={`${t("cacheTooltipScope")}: ${cacheView.scopeLabel}
${t("cacheTooltipRegions")}: ${cacheView.regionCount}
${t("cacheTooltipLastRefresh")}: ${new Date(cacheView.lastRefreshAt).toLocaleTimeString()}
${t("cacheTooltipNextExpiry")}: ${new Date(cacheView.nextExpiryAt).toLocaleTimeString()}`}>
              {cacheBadgeText}
            </button>

            <div className="inline-flex items-center rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] overflow-hidden">
              {(["all", "green", "yellow", "red"] as const).map((lvl) => {
                const active = routeSafetyFilter === lvl;
                return (
                  <button key={lvl} type="button" onClick={() => setRouteSafetyFilter(lvl)} className={`px-1.5 py-0.5 border-r last:border-r-0 border-eve-border/40 flex items-center transition-colors ${active ? "bg-eve-accent/15 text-eve-accent border-eve-accent/40" : "text-eve-dim hover:text-eve-text"}`} title={`Route safety: ${lvl}`}>
                    {lvl === "all" ? "Route: All" : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </button>
                );
              })}
            </div>

            {!isRegionGrouped && (
              <div className="inline-flex items-center gap-1 px-1 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px]">
                <span className="text-eve-dim px-1">{t("decisionLensTitle")}</span>
                {(routeViewMode === "route"
                  ? ([
                      ["recommended", "decisionLensTitle"],
                      ["best_route_pack", "decisionLensBestRoutePack"],
                      ["fastest_isk", "decisionLensFastestRoute"],
                      ["safest", "decisionLensSafestRoute"],
                      ["cargo", "decisionLensBestCargoUse"],
                      ["capital_efficient", "decisionLensLowestCapitalLockup"],
                    ] as const)
                  : ([
                      ["recommended", "decisionLensTitle"],
                      ["fastest_isk", "decisionLensFastest"],
                      ["cargo", "decisionLensCargo"],
                      ["safest", "decisionLensSafest"],
                      ["capital_efficient", "decisionLensCapital"],
                    ] as const)
                ).map(([preset, labelKey]) => {
                  const active = decisionLens === preset;
                  return (
                    <button key={preset} type="button" onClick={() => applyDecisionLens(preset)} className={`px-1.5 py-0.5 rounded-sm border transition-colors ${active ? "border-eve-accent/70 bg-eve-accent/15 text-eve-accent" : "border-eve-border/50 text-eve-dim hover:text-eve-text"}`} title={t(labelKey)}>
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
            )}

            {isRouteGrouped && (
              <div className="inline-flex items-center gap-1 px-1 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px]">
                <span className="text-eve-dim px-1" title={t("routeBadgeFilterModeTooltip")}>{t("routeBadgeFilterTitle")}</span>
                {routeBadgeFilterOptions.map((filter) => {
                  const active = selectedBadgeFilters.has(filter.key);
                  return (
                    <button key={filter.key} type="button" onClick={() => setSelectedBadgeFilters((prev) => { const next = new Set(prev); if (next.has(filter.key)) next.delete(filter.key); else next.add(filter.key); return next; })} className={`px-1.5 py-0.5 rounded-sm border transition-colors ${active ? "border-eve-accent/70 bg-eve-accent/15 text-eve-accent" : "border-eve-border/50 text-eve-dim hover:text-eve-text"}`} title={t(filter.tooltipKey)}>
                      {t(filter.labelKey)}
                    </button>
                  );
                })}
                {selectedBadgeFilters.size > 0 && (
                  <button type="button" onClick={() => setSelectedBadgeFilters(new Set())} className="px-1.5 py-0.5 rounded-sm border border-red-500/50 text-red-300 hover:bg-red-900/20 transition-colors" title={t("routeBadgeFilterClearTooltip")}>
                    {t("routeBadgeFilterClear")}
                  </button>
                )}
              </div>
            )}

            {isRegionGrouped && (
              <>
                <div className="inline-flex items-center gap-1 px-1 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px]">
                  <span className="text-eve-dim px-1">Sort:</span>
                  {([
                    ["period_profit", "Period"],
                    ["now_profit", "Now"],
                    ["trade_score", "Score"],
                  ] as const).map(([mode, label]) => {
                    const active = regionGroupSortMode === mode;
                    return (
                      <button key={mode} type="button" onClick={() => setRegionGroupSortMode(mode)} className={`px-1.5 py-0.5 rounded-sm border transition-colors ${active ? "border-eve-accent/70 bg-eve-accent/15 text-eve-accent" : "border-eve-border/50 text-eve-dim hover:text-eve-text"}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const activeCount = categoryFilter.size + groupFilter.size + (securityFilter !== "all" ? 1 : 0);
                  return (
                    <button
                      ref={filterBtnRef}
                      type="button"
                      onClick={() => {
                        setFilterPanelOpen((v) => !v);
                        setFilterSearch("");
                      }}
                      className={`relative px-2 py-0.5 rounded-sm border text-[11px] transition-colors ${
                        filterPanelOpen || activeCount > 0
                          ? "border-eve-accent/70 bg-eve-accent/15 text-eve-accent"
                          : "border-eve-border/60 bg-eve-dark/40 text-eve-dim hover:border-eve-accent/50 hover:text-eve-accent"
                      }`}
                      title="Open item filter (category · group · security)"
                    >
                      ⚙ Filters
                      {activeCount > 0 && <span className="ml-1 px-1 rounded-full bg-eve-accent text-eve-dark text-[9px] font-bold">{activeCount}</span>}
                    </button>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Region item filter popup ── */}
      {isRegionGrouped && filterPanelOpen && results.length > 0 && (
        <div
          ref={filterPanelRef}
          className="absolute z-40 top-[calc(var(--toolbar-h,36px)+2px)] left-0 right-0 mx-2 bg-eve-panel border border-eve-border rounded-sm shadow-2xl text-xs"
          style={{
            maxHeight: "60vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-eve-border shrink-0">
            <span className="text-eve-accent font-semibold">Item Filter</span>

            {/* Security */}
            <div className="flex items-center gap-1 ml-2">
              <span className="text-eve-dim">Sec:</span>
              {(["all", "highsec", "lowsec", "nullsec"] as const).map((s) => {
                const labels = {
                  all: "All",
                  highsec: "≥0.5",
                  lowsec: "0.1-0.4",
                  nullsec: "<0.1",
                } as const;
                const activeColors = {
                  all: "border-eve-accent/70 bg-eve-accent/15 text-eve-accent",
                  highsec: "text-green-300 border-green-500/60 bg-green-900/20",
                  lowsec:
                    "text-yellow-300 border-yellow-500/60 bg-yellow-900/20",
                  nullsec: "text-red-300 border-red-500/60 bg-red-900/20",
                } as const;
                const active = securityFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSecurityFilter(s)}
                    className={`px-1.5 py-0.5 rounded-sm border transition-colors ${active ? activeColors[s] : "border-eve-border/50 text-eve-dim hover:text-eve-text"}`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>

            <div className="flex-1" />

            {/* Reset all */}
            {(categoryFilter.size > 0 ||
              groupFilter.size > 0 ||
              securityFilter !== "all") && (
              <button
                onClick={() => {
                  setCategoryFilter(new Set());
                  setGroupFilter(new Set());
                  setSecurityFilter("all");
                }}
                className="px-2 py-0.5 rounded-sm border border-red-500/50 text-red-300 hover:bg-red-900/20 transition-colors"
              >
                Reset all
              </button>
            )}

            {/* Search */}
            <input
              autoFocus
              type="text"
              placeholder="Search categories / groups…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-48 px-2 py-0.5 rounded-sm border border-eve-border bg-eve-dark text-eve-text placeholder-eve-dim focus:outline-none focus:border-eve-accent"
            />

            <button
              onClick={() => setFilterPanelOpen(false)}
              className="text-eve-dim hover:text-eve-text ml-1"
            >
              ✕
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto p-3 space-y-3">
            {/* Category section */}
            {availableCategories.length > 0 &&
              (() => {
                const q = filterSearch.trim().toLowerCase();
                const cats = q
                  ? availableCategories.filter((c) =>
                      c.name.toLowerCase().includes(q),
                    )
                  : availableCategories;
                if (cats.length === 0) return null;
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-eve-dim uppercase tracking-wider text-[10px]">
                        Category
                      </span>
                      {categoryFilter.size > 0 && (
                        <button
                          onClick={() => {
                            setCategoryFilter(new Set());
                            setGroupFilter(new Set());
                          }}
                          className="text-red-400 hover:text-red-300 text-[10px]"
                        >
                          ✕ clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cats.map(({ id, name, count }) => {
                        const active = categoryFilter.has(id);
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              setCategoryFilter((prev) => {
                                const n = new Set(prev);
                                if (active) n.delete(id);
                                else n.add(id);
                                return n;
                              });
                              setGroupFilter(new Set());
                            }}
                            className={`px-2 py-0.5 rounded-sm border transition-colors ${active ? "border-eve-accent/70 bg-eve-accent/15 text-eve-accent" : "border-eve-border/50 text-eve-dim hover:border-eve-accent/40 hover:text-eve-text"}`}
                          >
                            {name} <span className="opacity-60">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            {/* Group section */}
            {availableGroups.length > 0 &&
              (() => {
                const q = filterSearch.trim().toLowerCase();
                const grps = q
                  ? availableGroups.filter((g) =>
                      g.name.toLowerCase().includes(q),
                    )
                  : availableGroups;
                if (grps.length === 0) return null;
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-eve-dim uppercase tracking-wider text-[10px]">
                        Group
                      </span>
                      {groupFilter.size > 0 && (
                        <button
                          onClick={() => setGroupFilter(new Set())}
                          className="text-red-400 hover:text-red-300 text-[10px]"
                        >
                          ✕ clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {grps.map(({ name, count }) => {
                        const active = groupFilter.has(name);
                        return (
                          <button
                            key={name}
                            onClick={() =>
                              setGroupFilter((prev) => {
                                const n = new Set(prev);
                                if (active) n.delete(name);
                                else n.add(name);
                                return n;
                              })
                            }
                            className={`px-2 py-0.5 rounded-sm border transition-colors ${active ? "border-sky-400/70 bg-sky-900/20 text-sky-300" : "border-eve-border/50 text-eve-dim hover:border-sky-400/40 hover:text-eve-text"}`}
                          >
                            {name} <span className="opacity-60">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      )}

      {showColumnPanel && (
        <div className="shrink-0 px-2 pb-2">
          <div className="border border-eve-border rounded-sm bg-eve-dark/40 p-2 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-eve-dim">{t("columnsPanelTitle")}</span>
              <button
                type="button"
                onClick={() => setHiddenColumns(new Set())}
                className="px-2 py-0.5 rounded-sm border border-eve-border/60 hover:border-eve-accent/50 hover:text-eve-accent transition-colors"
              >
                {t("columnsShowAll")}
              </button>
              <button
                type="button"
                onClick={resetColumns}
                className="px-2 py-0.5 rounded-sm border border-eve-border/60 hover:border-eve-accent/50 hover:text-eve-accent transition-colors"
              >
                {t("columnsReset")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-y-2">
              {orderedColumnDefs.map((col) => {
                const visible = !hiddenColumns.has(col.key);
                const isDragged = colDraggedKey === col.key;
                const isOver = colDragOverKey === col.key && !isDragged;
                const showGapBefore = isOver && colDragOverSide === "before";
                const showGapAfter = isOver && colDragOverSide === "after";

                return (
                  <div key={col.key} className="flex items-center">
                    {/* Drop gap — before */}
                    <div
                      className={[
                        "flex items-center justify-center self-stretch transition-all duration-150 overflow-hidden",
                        showGapBefore ? "w-7 opacity-100" : "w-0 opacity-0",
                      ].join(" ")}
                    >
                      <div className="w-0.5 h-full min-h-[24px] rounded-full bg-eve-accent shadow-[0_0_6px_2px] shadow-eve-accent/40" />
                    </div>

                    {/* Chip */}
                    <div
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => {
                        setColDraggedKey(col.key);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setColDraggedKey(null);
                        setColDragOverKey(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (colDraggedKey === col.key) return;
                        const rect = (
                          e.currentTarget as HTMLElement
                        ).getBoundingClientRect();
                        const side =
                          e.clientX < rect.left + rect.width / 2
                            ? "before"
                            : "after";
                        if (
                          colDragOverKey !== col.key ||
                          colDragOverSide !== side
                        ) {
                          setColDragOverKey(col.key);
                          setColDragOverSide(side);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (
                          !e.currentTarget.contains(e.relatedTarget as Node)
                        ) {
                          setColDragOverKey(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (colDraggedKey && colDraggedKey !== col.key) {
                          insertColumn(colDraggedKey, col.key, colDragOverSide);
                        }
                        setColDraggedKey(null);
                        setColDragOverKey(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          moveColumn(col.key, -1);
                        } else if (e.key === "ArrowRight") {
                          e.preventDefault();
                          moveColumn(col.key, 1);
                        }
                      }}
                      className={[
                        "flex items-center gap-1.5 rounded-sm border px-2 py-1 cursor-grab active:cursor-grabbing select-none transition-all duration-150",
                        isDragged
                          ? "opacity-30 scale-95 border-eve-accent/30 bg-eve-accent/5"
                          : isOver
                            ? "border-eve-accent/50 bg-eve-accent/10"
                            : colDraggedKey
                              ? "border-eve-border/30 bg-eve-panel/40"
                              : "border-eve-border/40 bg-eve-panel/60 hover:border-eve-accent/30 hover:bg-eve-accent/5",
                      ].join(" ")}
                    >
                      <span className="text-eve-dim/40 text-[11px] leading-none">
                        ⠿
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(e) =>
                            toggleColumnVisibility(col.key, e.target.checked)
                          }
                          className="accent-eve-accent w-3 h-3"
                        />
                        <span
                          className={
                            visible
                              ? "text-eve-text"
                              : "text-eve-dim/50 line-through"
                          }
                        >
                          {t(col.labelKey)}
                        </span>
                      </label>
                    </div>

                    {/* Drop gap — after */}
                    <div
                      className={[
                        "flex items-center justify-center self-stretch transition-all duration-150 overflow-hidden",
                        showGapAfter ? "w-7 opacity-100" : "w-0 opacity-0",
                      ].join(" ")}
                    >
                      <div className="w-0.5 h-full min-h-[24px] rounded-full bg-eve-accent shadow-[0_0_6px_2px] shadow-eve-accent/40" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!isRegionGrouped && (
        <RadiusInsightsPanel
          topRoutePicks={topRoutePicks}
          actionQueue={actionQueue}
          loopOpportunities={loopOpportunities ?? []}
          suppressionSummary={
            suppressionTelemetry.softSessionFiltered > 0 ||
            suppressionTelemetry.deprioritizedRows > 0 ||
            hiddenCounts.total > 0
              ? `Hidden/deprioritized: ${suppressionTelemetry.softSessionFiltered} session-filtered, ${suppressionTelemetry.deprioritizedRows} deprioritized, ${hiddenCounts.total} manually hidden.`
              : undefined
          }
          jumpToRouteGroup={jumpToRouteGroup}
        />
      )}


      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col border border-eve-border rounded-sm overflow-auto table-scroll-container">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-eve-dark border-b border-eve-border">
              <th className="w-8 px-1 py-2 text-center">
                <input
                  type="checkbox"
                  checked={
                    visibleRows.length > 0 &&
                    selectedIds.size === visibleRows.length
                  }
                  onChange={toggleSelectAll}
                  className="accent-eve-accent cursor-pointer"
                />
              </th>
              <th className="w-8 px-1 py-2" />
              {columnDefs.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  title={
                    col.tooltipKey
                      ? `${t(col.labelKey)}: ${t(col.tooltipKey)}`
                      : t(col.labelKey)
                  }
                  className={`${col.width} px-3 py-2 text-left text-[11px] uppercase tracking-wider text-eve-dim font-medium cursor-pointer select-none hover:text-eve-accent transition-colors ${sortKey === col.key ? "text-eve-accent" : ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {t(col.labelKey)}
                    {col.tooltipKey ? (
                      <span className="text-eve-dim/70 normal-case text-[10px]">
                        ?
                      </span>
                    ) : null}
                  </span>
                  {sortKey === col.key && (
                    <span className="ml-1">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
            {showFilters && (
              <tr className="bg-eve-dark/80 border-b border-eve-border">
                <th className="w-8" />
                <th className="w-8" />
                {columnDefs.map((col) => (
                  <th key={col.key} className={`${col.width} px-1 py-1`}>
                    <input
                      type="text"
                      value={filters[col.key] ?? ""}
                      onChange={(e) => setFilter(col.key, e.target.value)}
                      title={
                        col.tooltipKey
                          ? `${t(col.labelKey)}: ${t(col.tooltipKey)}`
                          : t(col.labelKey)
                      }
                      placeholder={
                        col.numeric ? "e.g. >100" : t("filterPlaceholder")
                      }
                      className="w-full px-2 py-0.5 bg-eve-input border border-eve-border rounded-sm text-eve-text text-xs font-mono placeholder:text-eve-dim/50 focus:outline-none focus:border-eve-accent/50 transition-colors"
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {isRegionGrouped
              ? (() => {
                  let rowIndex = 0;
                  return regionGroups.map((group) => {
                    const collapsed = effectiveCollapsedRegionGroups.has(
                      group.key,
                    );
                    return (
                      <Fragment key={`group:${group.key}`}>
                        <tr className="border-b border-eve-border/60 bg-eve-dark/50">
                          <td
                            colSpan={columnDefs.length + 2}
                            className="px-2 py-1.5"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setRegionCollapseInitialized(true);
                                startTransition(() => {
                                  setCollapsedRegionGroups((prev) => {
                                    const next = regionCollapseInitialized
                                      ? new Set(prev)
                                      : new Set(defaultCollapsedRegionGroups);
                                    if (next.has(group.key))
                                      next.delete(group.key);
                                    else next.add(group.key);
                                    return next;
                                  });
                                });
                              }}
                              className="inline-flex items-center gap-2 text-xs text-eve-text hover:text-eve-accent transition-colors"
                            >
                              <span className="text-eve-accent">
                                {collapsed ? "▶" : "▼"}
                              </span>
                              <span className="font-medium">{group.label}</span>
                              <span className="text-eve-dim">
                                {group.rows.length}
                              </span>
                              <span className="text-eve-accent font-mono">
                                {regionGroupSortMode === "trade_score"
                                  ? `Score ${group.sortValue.toFixed(1)}`
                                  : formatISK(group.sortValue)}
                              </span>
                            </button>
                          </td>
                        </tr>
                        {!collapsed &&
                          (() => {
                            const limit =
                              groupRowLimit.get(group.key) ?? GROUP_PAGE_SIZE;
                            const sliced = group.rows.slice(0, limit);
                            const hasMore = group.rows.length > limit;
                            return (
                              <>
                                {sliced.map((ir) => {
                                  const rendered = renderDataRow(ir, rowIndex);
                                  rowIndex++;
                                  return rendered;
                                })}
                                {hasMore && (
                                  <tr className="bg-eve-dark/30">
                                    <td
                                      colSpan={columnDefs.length + 2}
                                      className="px-4 py-1.5 text-center"
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setGroupRowLimit((prev) => {
                                            const next = new Map(prev);
                                            next.set(
                                              group.key,
                                              group.rows.length,
                                            );
                                            return next;
                                          })
                                        }
                                        className="text-[11px] text-eve-dim hover:text-eve-accent transition-colors"
                                      >
                                        Show all {group.rows.length} items (
                                        {group.rows.length - limit} more) ↓
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })()}
                      </Fragment>
                    );
                  });
                })()
              : isItemGrouped
                ? (() => {
                    let rowIndex = 0;
                    return itemGroups.map((group) => {
                      if (group.rows.length === 0) return null;
                      const topRow = group.rows[0];
                      const expanded =
                        group.rows.length > 1 &&
                        expandedItemGroups.has(group.key);
                      const limit = Math.max(
                        1,
                        groupRowLimit.get(group.key) ?? GROUP_PAGE_SIZE,
                      );
                      const childRows = expanded
                        ? group.rows.slice(1, limit)
                        : [];
                      const hasMore = expanded && group.rows.length > limit;
                      const topRendered = renderDataRow(topRow, rowIndex, {
                        expandable: group.rows.length > 1,
                        expanded,
                      });
                      rowIndex++;
                      return (
                        <Fragment key={`item-group:${group.key}`}>
                          {topRendered}
                          {childRows.map((ir) => {
                            const rendered = renderDataRow(ir, rowIndex);
                            rowIndex++;
                            return rendered;
                          })}
                          {hasMore && (
                            <tr className="bg-eve-dark/30">
                              <td
                                colSpan={columnDefs.length + 2}
                                className="px-4 py-1.5 text-center"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setGroupRowLimit((prev) => {
                                      const next = new Map(prev);
                                      next.set(group.key, group.rows.length);
                                      return next;
                                    })
                                  }
                                  className="text-[11px] text-eve-dim hover:text-eve-accent transition-colors"
                                >
                                  Show all {group.rows.length} items (
                                  {group.rows.length - limit} more) ↓
                                </button>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    });
                  })()
                : isRouteGrouped
                  ? (() => {
                      let rowIndex = 0;
                      return filteredRouteGroups.map((group) => {
                        if (group.rows.length === 0) return null;
                        const expanded = expandedRouteGroups.has(group.key);
                        const routeSummary = batchMetricsByRoute[group.key];
                        const routeAggregate =
                          routeAggregateMetricsByRoute[group.key];
                        const routeScoreSummary =
                          routeScoreSummaryByRoute[group.key];
                        const badgeMetadata =
                          routeBadgeMetadataByRoute[group.key] ??
                          deriveRouteBadgeMetadata(routeSummary, routeAggregate);
                        return (
                          <Fragment key={`route-group:${group.key}`}>
                            <tr
                              className="border-b border-eve-border/60 bg-eve-dark/50"
                              data-route-group={group.key}
                            >
                              <td
                                colSpan={columnDefs.length + 2}
                                className="px-2 py-1.5"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedRouteGroups((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(group.key))
                                        next.delete(group.key);
                                      else next.add(group.key);
                                      return next;
                                    })
                                  }
                                  className="inline-flex w-full items-center justify-between gap-3 text-xs text-eve-text hover:text-eve-accent transition-colors"
                                >
                                  <span
                                    className="inline-flex items-center gap-2 min-w-0"
                                    data-testid={`route-header-left:${group.key}`}
                                  >
                                    <span className="text-eve-accent shrink-0">
                                      {expanded ? "▼" : "▶"}
                                    </span>
                                    <span
                                      className={`px-1 py-0.5 rounded-sm border text-[10px] font-bold shrink-0 ${complexityBadgeClass(
                                        badgeMetadata.complexity,
                                      )}`}
                                    >
                                      {badgeMetadata.complexity}
                                    </span>
                                    {badgeMetadata.riskSpikeCount > 0 && (
                                      <span
                                        className="px-1 py-0.5 rounded-sm border border-red-500/60 text-[10px] font-bold text-red-300 bg-red-900/20 shrink-0"
                                        title="Price spike warnings"
                                      >
                                        SPIKE {badgeMetadata.riskSpikeCount}
                                      </span>
                                    )}
                                    {badgeMetadata.riskNoHistoryCount > 0 && (
                                      <span
                                        className="px-1 py-0.5 rounded-sm border border-amber-500/60 text-[10px] font-bold text-amber-300 bg-amber-900/20 shrink-0"
                                        title="No history warnings"
                                      >
                                        NO HIST {badgeMetadata.riskNoHistoryCount}
                                      </span>
                                    )}
                                    {badgeMetadata.riskUnstableHistoryCount > 0 && (
                                      <span
                                        className="px-1 py-0.5 rounded-sm border border-yellow-500/60 text-[10px] font-bold text-yellow-300 bg-yellow-900/20 shrink-0"
                                        title="Unstable history warnings"
                                      >
                                        UNSTABLE{" "}
                                        {badgeMetadata.riskUnstableHistoryCount}
                                      </span>
                                    )}
                                    {badgeMetadata.riskThinFillCount > 0 && (
                                      <span
                                        className="px-1 py-0.5 rounded-sm border border-orange-500/60 text-[10px] font-bold text-orange-300 bg-orange-900/20 shrink-0"
                                        title="Thin fill warnings"
                                      >
                                        THIN {badgeMetadata.riskThinFillCount}
                                      </span>
                                    )}
                                    <span
                                      className={`px-1 py-0.5 rounded-sm border text-[10px] font-bold shrink-0 ${badgeMetadata.confidence.color}`}
                                      title={badgeMetadata.confidence.hint}
                                    >
                                      {badgeMetadata.confidence.label}{" "}
                                      {badgeMetadata.confidence.score}
                                    </span>
                                    <span className="font-medium truncate">
                                      {group.label}
                                    </span>
                                  </span>

                                  <span className="inline-flex items-center gap-2 shrink-0">
                                    <span className="text-eve-dim">
                                      {routeSummary?.routeItemCount ??
                                        group.rows.length}{" "}
                                      items
                                    </span>
                                  <span
                                    className="text-eve-accent font-mono"
                                    title="Total route profit"
                                  >
                                    P{" "}
                                    {formatISK(
                                      routeSummary?.routeTotalProfit ?? 0,
                                    )}
                                  </span>
                                  <span
                                    className="text-eve-dim font-mono"
                                    title="Route capital"
                                  >
                                    C{" "}
                                    {formatISK(
                                      routeSummary?.routeTotalCapital ?? 0,
                                    )}
                                  </span>
                                  <span
                                    className="text-eve-dim font-mono"
                                    title="Route volume"
                                  >
                                    V{" "}
                                    {(
                                      routeSummary?.routeTotalVolume ?? 0
                                    ).toLocaleString()}{" "}
                                    m³
                                  </span>
                                  <span
                                    className="text-eve-dim font-mono"
                                    title="Capacity used"
                                  >
                                    Cap{" "}
                                    {formatBatchSyntheticCell(
                                      "RoutePackCapacityUsedPercent",
                                      routeSummary?.routeCapacityUsedPercent ??
                                        null,
                                    )}
                                  </span>
                                  <span
                                    className="text-eve-accent font-mono"
                                    title="Daily ISK per jump"
                                  >
                                    D/J{" "}
                                    {formatBatchSyntheticCell(
                                      "RoutePackDailyIskPerJump",
                                      routeSummary?.routeDailyIskPerJump ??
                                        null,
                                    )}
                                  </span>
                                  <span
                                    className="text-eve-dim font-mono"
                                    title="Real ISK per m3 per jump"
                                  >
                                    m³/J{" "}
                                    {formatBatchSyntheticCell(
                                      "RoutePackRealIskPerM3PerJump",
                                      routeSummary?.routeRealIskPerM3PerJump ??
                                        null,
                                    )}
                                  </span>
                                  <span
                                    className={`px-1 py-0.5 rounded-sm border text-[10px] font-bold font-mono ${routeScoreToneClass(
                                      routeScoreSummary?.routeRecommendationScore ??
                                        0,
                                    )}`}
                                    title={t("routeScoreTooltip")}
                                  >
                                    {t("routeScoreLabel")}{" "}
                                    {(
                                      routeScoreSummary?.routeRecommendationScore ??
                                      0
                                    ).toFixed(1)}
                                  </span>
                                  <span
                                    className={`px-1 py-0.5 rounded-sm border text-[10px] font-bold font-mono ${routeScoreToneClass(
                                      routeScoreSummary?.avgRowScore ?? 0,
                                    )}`}
                                    title={t("routeRowScoreTooltip")}
                                  >
                                    {t("routeRowScoreLabel")}{" "}
                                    {(
                                      routeScoreSummary?.bestRowScore ?? 0
                                    ).toFixed(1)}
                                    /
                                    {(
                                      routeScoreSummary?.avgRowScore ?? 0
                                    ).toFixed(1)}
                                  </span>
                                  <span className="text-eve-dim font-mono">
                                    EQ min{" "}
                                    {(
                                      routeSummary?.routeWeakestExecutionQuality ??
                                      0
                                    ).toFixed(1)}
                                  </span>
                                  <span className="text-eve-dim font-mono">
                                    {t("routeStopCountShort")}{" "}
                                    {routeSummary?.routeStopCount ?? 0}
                                  </span>
                                  <span className="text-eve-dim font-mono">
                                    B{routeSummary?.routeBuyStopCount ?? 0}/S
                                    {routeSummary?.routeSellStopCount ?? 0}
                                  </span>
                                  <span className="text-eve-dim font-mono">
                                    Fill min/avg{" "}
                                    {(
                                      routeSummary?.routeWorstFillConfidencePct ??
                                      0
                                    ).toFixed(0)}
                                    %/
                                    {(
                                      routeSummary?.routeAverageFillConfidencePct ??
                                      0
                                    ).toFixed(0)}
                                    %
                                  </span>
                                  <span className="text-eve-dim font-mono">
                                    Rem{" "}
                                    {(
                                      routeSummary?.routeRemainingCargoM3 ?? 0
                                    ).toLocaleString(undefined, {
                                      maximumFractionDigits: 1,
                                    })}{" "}
                                    m³
                                  </span>
                                  <span
                                    className="text-eve-dim font-mono"
                                    title="Weighted slippage percent"
                                  >
                                    Slip{" "}
                                    {formatBatchSyntheticCell(
                                      "RoutePackWeightedSlippagePct",
                                      routeSummary?.routeWeightedSlippagePct ??
                                        null,
                                    )}
                                  </span>
                                  <span
                                    className="text-eve-dim font-mono"
                                    title="Exit overhang"
                                  >
                                    OH{" "}
                                    {formatBatchSyntheticCell(
                                      "RoutePackExitOverhangDays",
                                      routeSummary?.routeExitOverhangDays ??
                                        null,
                                    )}
                                  </span>
                                  <span
                                    className="text-eve-dim font-mono"
                                    title="Route safety"
                                  >
                                    Safety{" "}
                                    {routeAggregate?.routeSafetyRank === 0
                                      ? "🟢"
                                      : routeAggregate?.routeSafetyRank === 1
                                        ? "🟡"
                                        : "🔴"}
                                  </span>
                                  </span>
                                </button>
                              </td>
                            </tr>
                            {expanded &&
                              group.rows.map((ir) => {
                                const rendered = renderDataRow(ir, rowIndex);
                                rowIndex++;
                                return rendered;
                              })}
                          </Fragment>
                        );
                      });
                    })()
                  : pageRows.map((ir, i) =>
                      renderDataRow(ir, safePage * PAGE_SIZE + i),
                    )}
            {isRouteGrouped &&
              !scanning &&
              displaySorted.length > 0 &&
              filteredRouteGroups.length === 0 && (
                <tr>
                  <td
                    colSpan={columnDefs.length + 2}
                    className="p-6 text-center text-sm text-eve-dim"
                  >
                    {t("routeBadgeFilterEmpty")}
                  </td>
                </tr>
              )}
            {displaySorted.length === 0 && !scanning && (
              <tr>
                <td colSpan={columnDefs.length + 2} className="p-0">
                  {results.length > 0 &&
                  hiddenCounts.total > 0 &&
                  !showHiddenRows ? (
                    <div className="p-6 text-center text-sm text-eve-dim">
                      {t("hiddenAllRowsPrefix")}{" "}
                      <span className="text-eve-accent">{t("showHidden")}</span>{" "}
                      {t("hiddenAllRowsOrOpen")}{" "}
                      <span className="text-eve-accent">
                        {t("hiddenButton", { count: hiddenCounts.total })}
                      </span>
                      .
                    </div>
                  ) : (
                    <EmptyState
                      reason={emptyReason}
                      wikiSlug="Getting-Started"
                    />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      {summary && displaySorted.length > 0 && (
        <div className="shrink-0 flex items-center gap-6 px-3 py-1.5 border-t border-eve-border text-xs">
          <span className="text-eve-dim">
            {t("colRealProfit")}:{" "}
            <span className="text-eve-accent font-mono font-semibold">
              {formatISK(summary.totalProfit)}
            </span>
          </span>
          <span className="text-eve-dim">
            {t("avgMargin")}:{" "}
            <span className="text-eve-accent font-mono font-semibold">
              {formatMargin(summary.avgMargin)}
            </span>
          </span>
          {selectedIds.size > 0 && (
            <span className="text-eve-dim italic">
              ({t("selected", { count: selectedIds.size })})
            </span>
          )}
        </div>
      )}

      {scoreExplainRow && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setScoreExplainRow(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] w-[520px] rounded-sm border border-eve-border bg-eve-dark shadow-eve-glow-strong p-3"
          >
            <div className="mb-2 text-sm font-medium text-eve-text">
              Why this score?
            </div>
            <OpportunityScoreDetails
              explanation={scoreFlipResult(
                scoreExplainRow,
                opportunityProfile,
                displayScoreContext,
              )}
              executionQuality={executionQualityForFlip(scoreExplainRow)}
            />
            <div className="mt-2 text-center">
              <button
                type="button"
                className="text-xs text-eve-dim hover:text-eve-accent"
                onClick={() => setScoreExplainRow(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            ref={contextMenuRef}
            className="fixed z-50 bg-eve-panel border border-eve-border rounded-sm shadow-eve-glow-strong py-1 min-w-[200px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <ContextItem
              label={t("copyItem")}
              onClick={() => copyText(contextMenu.row.TypeName ?? "")}
            />
            <ContextItem
              label={t("copyBuyStation")}
              onClick={() => copyText(contextMenu.row.BuyStation ?? "")}
            />
            <ContextItem
              label={t("copySellStation")}
              onClick={() => copyText(contextMenu.row.SellStation ?? "")}
            />
            <ContextItem
              label={t("copyTradeRoute")}
              onClick={() =>
                copyText(
                  `Buy: ${contextMenu.row.TypeName} x${contextMenu.row.UnitsToBuy} @ ${contextMenu.row.BuyStation} \u2192 Sell: @ ${contextMenu.row.SellStation}`,
                )
              }
            />
            <ContextItem
              label={t("buildBatch")}
              onClick={() => {
                setBatchPlanRow(contextMenu.row);
                setContextMenu(null);
              }}
            />
            <ContextItem
              label={t("copySystemAutopilot")}
              onClick={() => copyText(contextMenu.row.BuySystemName)}
            />
            {(contextMenu.row.BuyLocationID ?? 0) > 0 && (
              <ContextItem
                label="Ignore this buy station (session)"
                onClick={() =>
                  addBuyStationIgnore(getBuyLocationID(contextMenu.row))
                }
              />
            )}
            {(contextMenu.row.SellLocationID ?? 0) > 0 && (
              <ContextItem
                label="Ignore this sell station (session)"
                onClick={() =>
                  addSellStationIgnore(getSellLocationID(contextMenu.row))
                }
              />
            )}
            {((contextMenu.row.BuyLocationID ?? 0) > 0 ||
              (contextMenu.row.SellLocationID ?? 0) > 0) && (
              <ContextItem
                label="Deprioritize this station"
                onClick={() =>
                  addDeprioritizedStation(
                    getBuyLocationID(contextMenu.row) ||
                      getSellLocationID(contextMenu.row),
                  )
                }
              />
            )}
            <ContextItem
              label="Clear all temporary station filters"
              onClick={clearTemporaryStationFilters}
            />
            <div className="h-px bg-eve-border my-1" />
            <ContextItem
              label={t("openInEveref")}
              onClick={() => {
                window.open(
                  `https://everef.net/type/${contextMenu.row.TypeID}`,
                  "_blank",
                );
                setContextMenu(null);
              }}
            />
            <ContextItem
              label={t("openInJitaSpace")}
              onClick={() => {
                window.open(
                  `https://www.jita.space/market/${contextMenu.row.TypeID}`,
                  "_blank",
                );
                setContextMenu(null);
              }}
            />
            <div className="h-px bg-eve-border my-1" />
            <ContextItem
              label={
                watchlistIds.has(contextMenu.row.TypeID)
                  ? t("untrackItem")
                  : `\u2B50 ${t("trackItem")}`
              }
              onClick={() => {
                const row = contextMenu.row;
                if (watchlistIds.has(row.TypeID)) {
                  removeFromWatchlist(row.TypeID)
                    .then(setWatchlist)
                    .then(() =>
                      addToast(t("watchlistRemoved"), "success", 2000),
                    )
                    .catch(() => addToast(t("watchlistError"), "error", 3000));
                } else {
                  addToWatchlist(row.TypeID, row.TypeName)
                    .then((r) => {
                      setWatchlist(r.items);
                      addToast(
                        r.inserted
                          ? t("watchlistItemAdded")
                          : t("watchlistAlready"),
                        r.inserted ? "success" : "info",
                        2000,
                      );
                    })
                    .catch(() => addToast(t("watchlistError"), "error", 3000));
                }
                setContextMenu(null);
              }}
            />
            <div className="h-px bg-eve-border my-1" />
            {contextHiddenEntry ? (
              <ContextItem
                label={t("hiddenContextUnhide")}
                onClick={() => {
                  void unhideRowsByKeys([contextHiddenEntry.key]);
                  setContextMenu(null);
                }}
              />
            ) : (
              <>
                <ContextItem
                  label={t("hiddenContextMarkDone")}
                  onClick={() => {
                    void setRowHiddenState(contextMenu.row, "done");
                  }}
                />
                <ContextItem
                  label={t("hiddenContextIgnore")}
                  onClick={() => {
                    void setRowHiddenState(contextMenu.row, "ignored");
                  }}
                />
              </>
            )}
            {(contextMenu.row.BuyRegionID != null ||
              contextMenu.row.SellRegionID != null) && (
              <ContextItem
                label={t("placeDraft")}
                onClick={() => {
                  setExecPlanRow(contextMenu.row);
                  setContextMenu(null);
                }}
              />
            )}
            {/* EVE UI actions */}
            {isLoggedIn && (
              <>
                <div className="h-px bg-eve-border my-1" />
                <ContextItem
                  label={`🎮 ${t("openMarket")}`}
                  onClick={async () => {
                    try {
                      await openMarketInGame(contextMenu.row.TypeID);
                      addToast(t("actionSuccess"), "success", 2000);
                    } catch (err: any) {
                      const { messageKey, duration } = handleEveUIError(err);
                      addToast(t(messageKey), "error", duration);
                    }
                    setContextMenu(null);
                  }}
                />
                <ContextItem
                  label={`🎯 ${t("setDestination")} (Buy)`}
                  onClick={async () => {
                    try {
                      await setWaypointInGame(contextMenu.row.BuySystemID);
                      addToast(t("actionSuccess"), "success", 2000);
                    } catch (err: any) {
                      const { messageKey, duration } = handleEveUIError(err);
                      addToast(t(messageKey), "error", duration);
                    }
                    setContextMenu(null);
                  }}
                />
                {contextMenu.row.SellSystemID !==
                  contextMenu.row.BuySystemID && (
                  <ContextItem
                    label={`🎯 ${t("setDestination")} (Sell)`}
                    onClick={async () => {
                      try {
                        await setWaypointInGame(contextMenu.row.SellSystemID);
                        addToast(t("actionSuccess"), "success", 2000);
                      } catch (err: any) {
                        addToast(
                          t("actionFailed").replace("{error}", err.message),
                          "error",
                          3000,
                        );
                      }
                      setContextMenu(null);
                    }}
                  />
                )}
              </>
            )}
            <div className="h-px bg-eve-border my-1" />
            <ContextItem
              label={
                pinnedKeys.has(
                  mapScanRowToPinnedOpportunity(contextMenu.row)
                    .opportunity_key,
                )
                  ? t("unpinRow")
                  : t("pinRow")
              }
              onClick={() => {
                togglePin(contextMenu.row);
                setContextMenu(null);
              }}
            />
          </div>
        </>
      )}

      {ignoredModalOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/70"
            onClick={() => setIgnoredModalOpen(false)}
          />
          <div className="fixed z-[61] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(980px,92vw)] h-[min(680px,88vh)] rounded-sm border border-eve-border bg-eve-panel shadow-eve-glow-strong p-3 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm uppercase tracking-wider text-eve-text font-semibold">
                  {t("hiddenDealsTitle")}
                </h3>
                <p className="text-[11px] text-eve-dim mt-0.5">
                  {t("hiddenSummary", {
                    done: hiddenCounts.done,
                    ignored: hiddenCounts.ignored,
                    total: hiddenCounts.total,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIgnoredModalOpen(false)}
                className="px-2 py-1 rounded-sm border border-eve-border/60 text-eve-dim hover:text-eve-accent hover:border-eve-accent/50 transition-colors text-xs"
              >
                {t("close")}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={ignoredSearch}
                onChange={(e) => setIgnoredSearch(e.target.value)}
                placeholder={t("hiddenSearchItemOrStation")}
                className="h-8 px-2 min-w-[240px] rounded-sm border border-eve-border bg-eve-input text-eve-text text-xs"
              />
              <div className="flex items-center gap-1">
                {(["all", "done", "ignored"] as HiddenFilterTab[]).map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setIgnoredTab(tab)}
                      className={`px-2 py-1 rounded-sm border text-xs uppercase tracking-wide transition-colors ${
                        ignoredTab === tab
                          ? "border-eve-accent text-eve-accent bg-eve-accent/10"
                          : "border-eve-border/60 text-eve-dim hover:border-eve-accent/40 hover:text-eve-text"
                      }`}
                    >
                      {tab === "all"
                        ? t("hiddenFilterAll")
                        : tab === "done"
                          ? t("hiddenFilterDone")
                          : t("hiddenFilterIgnored")}
                    </button>
                  ),
                )}
              </div>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => {
                  void unhideRowsByKeys([...ignoredSelectedKeys]);
                }}
                disabled={ignoredSelectedKeys.size === 0}
                className="px-2 py-1 rounded-sm border border-eve-accent/60 text-eve-accent hover:bg-eve-accent/10 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("hiddenUnignoreSelected")}
              </button>
              <button
                type="button"
                onClick={() => {
                  void clearDoneHiddenRows();
                }}
                disabled={hiddenCounts.done === 0}
                className="px-2 py-1 rounded-sm border border-eve-border/60 text-eve-text hover:border-eve-accent/40 hover:text-eve-accent transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("hiddenClearDone")}
              </button>
              <button
                type="button"
                onClick={() => {
                  void clearAllHiddenRows();
                }}
                disabled={hiddenCounts.total === 0}
                className="px-2 py-1 rounded-sm border border-red-500/50 text-red-300 hover:bg-red-500/10 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("hiddenClearAll")}
              </button>
            </div>

            <div className="mt-3 flex-1 min-h-0 border border-eve-border/60 rounded-sm overflow-auto eve-scrollbar">
              {filteredHiddenEntries.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-eve-dark/95 border-b border-eve-border/60">
                    <tr>
                      <th className="w-8 px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredHiddenEntries.length > 0 &&
                            filteredHiddenEntries.every((entry) =>
                              ignoredSelectedKeys.has(entry.key),
                            )
                          }
                          onChange={(e) => {
                            if (!e.target.checked) {
                              setIgnoredSelectedKeys(new Set());
                              return;
                            }
                            setIgnoredSelectedKeys(
                              new Set(
                                filteredHiddenEntries.map((entry) => entry.key),
                              ),
                            );
                          }}
                          className="accent-eve-accent"
                        />
                      </th>
                      <th className="px-2 py-1 text-left text-eve-dim uppercase tracking-wide">
                        {t("colItem")}
                      </th>
                      <th className="px-2 py-1 text-left text-eve-dim uppercase tracking-wide">
                        {t("hiddenColRoute")}
                      </th>
                      <th className="px-2 py-1 text-left text-eve-dim uppercase tracking-wide">
                        {t("colType")}
                      </th>
                      <th className="px-2 py-1 text-left text-eve-dim uppercase tracking-wide">
                        {t("updated")}
                      </th>
                      <th className="px-2 py-1 text-right text-eve-dim uppercase tracking-wide">
                        {t("orderDeskAction")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHiddenEntries.map((entry, idx) => (
                      <tr
                        key={entry.key}
                        className={`border-b border-eve-border/30 ${
                          idx % 2 === 0 ? "bg-eve-panel" : "bg-eve-dark"
                        }`}
                      >
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={ignoredSelectedKeys.has(entry.key)}
                            onChange={(e) => {
                              setIgnoredSelectedKeys((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(entry.key);
                                else next.delete(entry.key);
                                return next;
                              });
                            }}
                            className="accent-eve-accent"
                          />
                        </td>
                        <td className="px-2 py-1 text-eve-text">
                          {entry.typeName}
                        </td>
                        <td className="px-2 py-1 text-eve-dim truncate">
                          {`${entry.buyStation} -> ${entry.sellStation}`}
                        </td>
                        <td className="px-2 py-1">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[10px] uppercase tracking-wide ${
                              entry.mode === "ignored"
                                ? "border-red-500/40 text-red-300 bg-red-950/30"
                                : "border-eve-accent/40 text-eve-accent bg-eve-accent/10"
                            }`}
                          >
                            {entry.mode === "ignored"
                              ? t("hiddenFilterIgnored")
                              : t("hiddenFilterDone")}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-eve-dim font-mono">
                          {new Date(entry.updatedAt).toLocaleString()}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              void unhideRowsByKeys([entry.key]);
                            }}
                            className="px-2 py-0.5 rounded-sm border border-eve-accent/60 text-eve-accent hover:bg-eve-accent/10 transition-colors text-[11px]"
                          >
                            {t("hiddenUnignore")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center text-eve-dim text-xs">
                  {t("hiddenNoRowsForFilter")}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {dayDetailRow && (
        <DayDetailPanel
          row={dayDetailRow}
          onClose={() => setDayDetailRow(null)}
        />
      )}

      <ExecutionPlannerPopup
        open={execPlanRow !== null}
        onClose={() => setExecPlanRow(null)}
        typeID={execPlanRow?.TypeID ?? 0}
        typeName={execPlanRow?.TypeName ?? ""}
        regionID={execPlanRow?.BuyRegionID ?? 0}
        locationID={execPlanRow?.BuyLocationID ?? 0}
        sellRegionID={execPlanRow?.SellRegionID}
        sellLocationID={execPlanRow?.SellLocationID ?? 0}
        defaultQuantity={execPlanRow?.UnitsToBuy ?? 100}
        brokerFeePercent={brokerFeePercent}
        salesTaxPercent={salesTaxPercent}
        splitTradeFees={splitTradeFees}
        buyBrokerFeePercent={buyBrokerFeePercent}
        sellBrokerFeePercent={sellBrokerFeePercent}
        buySalesTaxPercent={buySalesTaxPercent}
        sellSalesTaxPercent={sellSalesTaxPercent}
      />

      <BatchBuilderPopup
        open={batchPlanRow !== null}
        onClose={() => setBatchPlanRow(null)}
        anchorRow={batchPlanRow}
        rows={results}
        defaultCargoM3={cargoLimit}
        originSystemName={originSystemName}
        minRouteSecurity={minRouteSecurity}
        includeStructures={includeStructures}
        routeMaxJumps={routeMaxJumps}
        maxDetourJumpsPerNode={maxDetourJumpsPerNode}
        allowLowsec={allowLowsec}
        allowNullsec={allowNullsec}
        allowWormhole={allowWormhole}
        onOpenPriceValidation={onOpenPriceValidation}
        salesTaxPercent={salesTaxPercent}
        buyBrokerFeePercent={buyBrokerFeePercent}
        sellBrokerFeePercent={sellBrokerFeePercent}
        cacheMeta={cacheMeta}
        scanSourceTab={tradeStateTab === "region" ? "region" : "radius"}
      />

      {routeSafetyModal && (
        <RouteSafetyModal
          systems={routeSafetyModal.systems}
          onClose={() => setRouteSafetyModal(null)}
        />
      )}
    </div>
  );
}

/* ─── DataRow memo component — renders a single table row ─── */

interface DataRowProps {
  ir: IndexedRow;
  globalIdx: number;
  columnDefs: ColumnDef[];
  compactMode: boolean;
  isPinned: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isTracked: boolean;
  showTrackedChip: boolean;
  variant: { index: number; total: number } | undefined;
  rowHidden: HiddenFlipEntry | undefined;
  isItemGrouped: boolean;
  isRegionGrouped: boolean;
  variantExpandable: boolean;
  variantExpanded: boolean;
  onToggleVariantGroup: (typeID: number) => void;
  onContextMenu: (
    e: import("react").MouseEvent,
    id: number,
    row: FlipResult,
  ) => void;
  onLmbClick: (row: FlipResult) => void;
  onToggleSelect: (id: number) => void;
  onTogglePin: (row: FlipResult) => void;
  tFn: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  routeSafetyEntry: RouteState | undefined;
  onRouteSafetyClick: (
    from: number,
    to: number,
    e: import("react").MouseEvent,
  ) => void;
  onOpenScore: (row: FlipResult) => void;
  batchMetricsByRow: Record<string, RouteBatchMetadata>;
  opportunityProfile?: OpportunityWeightProfile;
  scoreContext?: OpportunityScanContext;
  endpointPreferenceMeta?: {
    appliedRules: string[];
    scoreDelta: number;
    excluded: boolean;
  };
}

/* ─── Trade Score Badge ─── */
function TradeScoreBadge({ score }: { score: number }) {
  const s = Math.round(score);
  const color =
    s >= 70 ? "text-green-300" : s >= 40 ? "text-yellow-300" : "text-red-400";
  const bar = Math.round((s / 100) * 10); // 0-10 blocks
  const filled = "█".repeat(bar);
  const empty = "░".repeat(10 - bar);
  return (
    <span
      className={`font-mono tabular-nums ${color}`}
      title={`Trade Score: ${s}/100\n${filled}${empty}`}
    >
      {s}
    </span>
  );
}

/* ─── Route Safety Cell ─── */
function RouteSafetyCell({
  entry,
  from,
  to,
  onRouteSafetyClick,
}: {
  entry: RouteState | undefined;
  from: number;
  to: number;
  onRouteSafetyClick: (
    from: number,
    to: number,
    e: import("react").MouseEvent,
  ) => void;
}) {
  if (!entry) {
    return <span className="text-eve-dim/30 text-[10px]">—</span>;
  }
  if (entry.status === "loading") {
    return <span className="text-eve-dim/50 text-[10px] animate-pulse">·</span>;
  }
  const danger = entry.danger;
  const kills = entry.kills;
  const dotCls =
    danger === "red"
      ? "bg-red-400"
      : danger === "yellow"
        ? "bg-yellow-400"
        : "bg-green-400";
  const textCls =
    danger === "red"
      ? "text-red-400"
      : danger === "yellow"
        ? "text-yellow-400"
        : "text-green-400/70";
  return (
    <button
      type="button"
      onClick={(e) => onRouteSafetyClick(from, to, e)}
      className="inline-flex items-center gap-1 text-[11px] bg-transparent border-0 cursor-pointer p-0 hover:opacity-80 transition-opacity"
      title={`Route safety: ${danger}${kills > 0 ? ` — ${kills} kills` : ""}`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotCls}`}
      />
      {kills > 0 && (
        <span className={`font-mono tabular-nums leading-none ${textCls}`}>
          {kills}
        </span>
      )}
    </button>
  );
}

const DataRow = memo(
  function DataRow({
    ir,
    globalIdx,
    columnDefs,
    compactMode,
    isPinned,
    isSelected,
    isFocused,
    isTracked,
    showTrackedChip,
    variant,
    rowHidden,
    isItemGrouped,
    isRegionGrouped,
    variantExpandable,
    variantExpanded,
    onToggleVariantGroup,
    onContextMenu,
    onLmbClick,
    onToggleSelect,
    onTogglePin,
    tFn,
    routeSafetyEntry,
    onRouteSafetyClick,
    onOpenScore,
    batchMetricsByRow,
    opportunityProfile,
    scoreContext,
    endpointPreferenceMeta,
  }: DataRowProps) {
    return (
      <tr
        data-row-id={ir.id}
        data-applied-rules={endpointPreferenceMeta?.appliedRules.join(",") ?? ""}
        data-endpoint-score-delta={endpointPreferenceMeta?.scoreDelta ?? 0}
        onContextMenu={(e) => onContextMenu(e, ir.id, ir.row)}
        onClick={(e) => {
          if (!isRegionGrouped) return;
          const target = e.target as HTMLElement;
          if (target.closest("input,button,a")) return;
          onLmbClick(ir.row);
        }}
        className={`border-b border-eve-border/50 hover:bg-eve-accent/5 transition-colors cursor-pointer ${compactMode ? "text-xs" : ""} ${
          isFocused
            ? "ring-1 ring-inset ring-eve-accent/60 bg-eve-accent/10"
            : isPinned
              ? "bg-eve-accent/10 border-l-2 border-l-eve-accent"
              : isTracked
                ? "border-l border-l-emerald-400/45"
              : isSelected
                ? "bg-eve-accent/5"
                : globalIdx % 2 === 0
                  ? "bg-eve-panel"
                  : "bg-eve-dark"
        } ${rowHidden ? "opacity-60" : ""}`}
      >
        <td
          className={`w-8 px-1 text-center ${compactMode ? "py-1" : "py-1.5"}`}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(ir.id)}
            className="accent-eve-accent cursor-pointer"
          />
        </td>
        <td
          className={`w-8 px-1 text-center ${compactMode ? "py-1" : "py-1.5"}`}
        >
          <button
            onClick={() => onTogglePin(ir.row)}
            className={`text-xs cursor-pointer transition-opacity ${isPinned ? "opacity-100" : "opacity-30 hover:opacity-70"}`}
            title={isPinned ? tFn("unpinRow") : tFn("pinRow")}
          >
            📌
          </button>
        </td>
        {columnDefs.map((col) => (
          <td
            key={col.key}
            className={`px-3 ${compactMode ? "py-1" : "py-1.5"} ${col.width} ${col.key === "TypeName" ? "" : "truncate"} ${col.numeric ? "text-eve-accent font-mono" : "text-eve-text"}`}
          >
            {col.key === "TypeName" ? (
              <div className="flex items-center gap-1.5 min-w-0">
                {ir.row.TypeID > 0 && !failedIconIds.has(ir.row.TypeID) && (
                  <img
                    src={`https://images.evetech.net/types/${ir.row.TypeID}/icon?size=32`}
                    alt=""
                    width={16}
                    height={16}
                    className="w-4 h-4 shrink-0 rounded-sm"
                    onError={() => failedIconIds.add(ir.row.TypeID)}
                  />
                )}
                <span className="truncate">{ir.row.TypeName}</span>
                <span
                  title={isTracked ? "Tracked watchlist item" : "Not tracked"}
                  className={`shrink-0 ${isTracked ? "text-yellow-300" : "text-eve-dim/40"}`}
                  aria-hidden
                >
                  ★
                </span>
                {showTrackedChip && isTracked && (
                  <span className="shrink-0 inline-flex items-center px-1 py-px rounded-[2px] border border-emerald-300/35 bg-emerald-400/10 text-emerald-200 text-[9px] leading-none font-medium uppercase tracking-normal">
                    Tracked
                  </span>
                )}
                {/* Price-spike warning: now-profit > 0 but period-profit < 0 means temp spike */}
                {hasDestinationPriceSpike(ir.row) && (
                  <span
                    title="Price spike: current profit looks positive but historical average is below break-even. This trade may be risky."
                    className="shrink-0 inline-flex items-center px-1 py-px rounded-[2px] border border-yellow-400/50 bg-yellow-400/10 text-yellow-300 text-[9px] leading-none font-medium uppercase"
                  >
                    SPIKE
                  </span>
                )}
                {variant &&
                  (variantExpandable && isItemGrouped ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVariantGroup(ir.row.TypeID);
                      }}
                      title={tFn("variantChipHint")}
                      className="shrink-0 inline-flex items-center gap-1 px-1 py-px rounded-[2px] border border-eve-accent/35 bg-eve-accent/10 text-eve-accent text-[9px] leading-none font-medium uppercase tracking-normal hover:border-eve-accent/70 hover:bg-eve-accent/20 transition-colors"
                    >
                      <span>
                        {tFn("variantChip", {
                          index: variant.index,
                          total: variant.total,
                        })}
                      </span>
                      <span className="text-[8px]">
                        {variantExpanded ? "▼" : "▶"}
                      </span>
                    </button>
                  ) : (
                    <span
                      title={tFn("variantChipHint")}
                      className="shrink-0 inline-flex items-center px-1 py-px rounded-[2px] border border-eve-accent/35 bg-eve-accent/10 text-eve-accent text-[9px] leading-none font-medium uppercase tracking-normal"
                    >
                      {tFn("variantChip", {
                        index: variant.index,
                        total: variant.total,
                      })}
                    </span>
                  ))}
              </div>
            ) : col.key === "DayTradeScore" ? (
              <TradeScoreBadge score={ir.row.DayTradeScore ?? 0} />
            ) : col.key === "OpportunityScore" ? (
              <button
                type="button"
                className="inline-flex items-center justify-center min-w-[44px] px-1.5 py-0.5 rounded-sm bg-eve-accent/15 border border-eve-accent/35 text-eve-accent font-mono hover:border-eve-accent/60"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenScore(ir.row);
                }}
                aria-label="Why this score?"
              >
                {scoreFlipResult(
                  ir.row,
                  opportunityProfile,
                  scoreContext,
                ).finalScore.toFixed(1)}
              </button>
            ) : col.key === ("RouteSafety" as SortKey) ? (
              <RouteSafetyCell
                entry={routeSafetyEntry}
                from={ir.row.BuySystemID}
                to={ir.row.SellSystemID}
                onRouteSafetyClick={onRouteSafetyClick}
              />
            ) : col.key === "BuyStation" ? (
              <span className="truncate">
                {fmtCell(
                  col,
                  ir.row,
                  batchMetricsByRow,
                  opportunityProfile,
                  scoreContext,
                )}
              </span>
            ) : (
              fmtCell(
                col,
                ir.row,
                batchMetricsByRow,
                opportunityProfile,
                scoreContext,
              )
            )}
          </td>
        ))}
      </tr>
    );
  },
  // Custom equality: only re-render if this row's relevant props changed
  (prev, next) =>
    prev.isPinned === next.isPinned &&
    prev.isSelected === next.isSelected &&
    prev.isFocused === next.isFocused &&
    prev.isTracked === next.isTracked &&
    prev.showTrackedChip === next.showTrackedChip &&
    prev.rowHidden === next.rowHidden &&
    prev.globalIdx === next.globalIdx &&
    prev.compactMode === next.compactMode &&
    prev.variant === next.variant &&
    prev.variantExpandable === next.variantExpandable &&
    prev.variantExpanded === next.variantExpanded &&
    prev.columnDefs === next.columnDefs &&
    prev.ir === next.ir &&
    prev.isItemGrouped === next.isItemGrouped &&
    prev.isRegionGrouped === next.isRegionGrouped &&
    prev.onToggleVariantGroup === next.onToggleVariantGroup &&
    prev.onContextMenu === next.onContextMenu &&
    prev.onLmbClick === next.onLmbClick &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.onTogglePin === next.onTogglePin &&
    prev.routeSafetyEntry === next.routeSafetyEntry &&
    prev.onRouteSafetyClick === next.onRouteSafetyClick &&
    prev.onOpenScore === next.onOpenScore &&
    prev.opportunityProfile === next.opportunityProfile &&
    prev.scoreContext === next.scoreContext,
);

/* ─── EVE category name lookup ─── */

function eveCategoryName(id: number): string {
  const MAP: Record<number, string> = {
    2: "Celestial",
    4: "Material",
    5: "Accessories",
    6: "Ship",
    7: "Module",
    8: "Charge",
    9: "Blueprint",
    16: "Skill",
    17: "Commodity",
    18: "Drone",
    20: "Implant",
    22: "Deployable",
    23: "Structure",
    24: "Reaction",
    25: "Ore",
    30: "Apparel",
    32: "Structure Module",
    34: "Ancient Relic",
    35: "Decryptor",
    39: "Infrastructure",
    43: "PI Commodity",
    46: "Apparel",
    65: "Structure",
    66: "Struct. Module",
    87: "Fighter",
    91: "Struct. Component",
  };
  return MAP[id] ?? "";
}

/* ─── Regional Day Trader detail panel (LMB on row) ─── */

function DRRow({
  label,
  value,
  accent,
  dim,
}: {
  label: string;
  value: string;
  accent?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-eve-dim">{label}</span>
      <span
        className={
          accent
            ? "text-eve-accent font-semibold"
            : dim
              ? "text-yellow-400"
              : "text-eve-text"
        }
      >
        {value}
      </span>
    </div>
  );
}

function calcConfidence(row: FlipResult): {
  score: number;
  label: string;
  color: string;
  hint: string;
} {
  const dos = row.DayTargetDOS ?? 0;
  const demand = row.DayTargetDemandPerDay ?? 0;
  const srcPrice = row.DaySourceAvgPrice ?? row.BuyPrice ?? 0;
  const tgtNow = row.DayTargetNowPrice ?? row.SellPrice ?? 0;
  const hasPeriodPrice = (row.DayTargetPeriodPrice ?? 0) > 0;
  let score = 100;
  const reasons: string[] = [];
  if (!hasPeriodPrice) {
    score -= 30;
    reasons.push("no period history");
  }
  if (dos > 90) {
    score -= 40;
    reasons.push(`DOS ${dos.toFixed(0)}d saturated`);
  } else if (dos > 30) {
    score -= 15;
    reasons.push(`DOS ${dos.toFixed(0)}d elevated`);
  }
  if (demand > 0 && demand < 1) {
    score -= 30;
    reasons.push(`demand ${demand.toFixed(2)}/day thin`);
  } else if (demand > 0 && demand < 3) {
    score -= 12;
    reasons.push(`demand ${demand.toFixed(2)}/day moderate`);
  }
  if (srcPrice > 0 && tgtNow > 0 && (tgtNow - srcPrice) / srcPrice > 2) {
    score -= 25;
    reasons.push("spread >200%");
  }
  score = Math.max(0, Math.min(100, score));
  const label = score >= 75 ? "High" : score >= 45 ? "Medium" : "Low";
  const color =
    score >= 75
      ? "text-green-300 border-green-500/60 bg-green-900/20"
      : score >= 45
        ? "text-yellow-300 border-yellow-500/60 bg-yellow-900/20"
        : "text-red-300 border-red-500/60 bg-red-900/20";
  const hint =
    reasons.length > 0
      ? `Score ${score}/100 — ${reasons.join("; ")}`
      : `Score ${score}/100 — no risk factors detected`;
  return { score, label, color, hint };
}

function DayDetailPanel({
  row,
  onClose,
}: {
  row: FlipResult;
  onClose: () => void;
}) {
  const signals: { label: string; title: string }[] = [];
  const dos = row.DayTargetDOS ?? 0;
  const demand = row.DayTargetDemandPerDay ?? 0;
  if (dos > 90)
    signals.push({
      label: "SAT",
      title: `Saturated: ${dos.toFixed(0)} days of supply`,
    });
  if (demand > 0 && demand < 1)
    signals.push({
      label: "LOW",
      title: `Low demand: ${demand.toFixed(2)} units/day`,
    });
  const srcPrice = row.DaySourceAvgPrice ?? row.BuyPrice ?? 0;
  const tgtNow = row.DayTargetNowPrice ?? row.SellPrice ?? 0;
  const daySupply = row.DayTargetSupplyUnits;
  const dayLowestAsk = row.DayTargetLowestSell;
  if (srcPrice > 0 && tgtNow > 0 && (tgtNow - srcPrice) / srcPrice > 2)
    signals.push({
      label: "ODD",
      title: `Spread ${(((tgtNow - srcPrice) / srcPrice) * 100).toFixed(0)}% — verify prices`,
    });

  const confidence = calcConfidence(row);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-eve-panel border border-eve-border rounded-sm shadow-2xl w-full max-w-lg mx-4 font-mono text-xs text-eve-text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-eve-border bg-eve-dark/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-eve-accent truncate">
              {row.TypeName}
            </span>
            {row.DayGroupName && (
              <span className="text-[10px] text-eve-dim shrink-0">
                {row.DayGroupName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            <span
              className={`px-1.5 py-0.5 rounded-sm border text-[10px] font-bold cursor-help ${confidence.color}`}
              title={confidence.hint}
            >
              {confidence.label} {confidence.score}
            </span>
            <button
              onClick={onClose}
              className="text-eve-dim hover:text-eve-text"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {signals.map((s, i) => (
                <span
                  key={i}
                  title={s.title}
                  className="px-1.5 py-0.5 rounded-sm border border-yellow-500/60 text-yellow-400 bg-yellow-900/20 text-[10px] font-bold cursor-help"
                >
                  ⚠ {s.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-eve-dim flex-wrap">
            <span className="text-eve-text">
              {row.BuyStation || row.BuySystemName}
            </span>
            <span className="text-eve-accent">
              → {row.SellJumps ?? row.TotalJumps ?? 0}j →
            </span>
            <span className="text-eve-text">
              {row.SellStation || row.SellSystemName}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-sm border border-eve-border/50 bg-eve-dark/30 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-eve-dim font-semibold mb-1">
                Source (Buy)
              </div>
              <DRRow label="Price" value={formatISK(srcPrice)} />
              <DRRow
                label="Available"
                value={`${(row.SellOrderRemain ?? 0).toLocaleString()} units`}
              />
              <DRRow label="Region" value={row.BuyRegionName ?? "—"} />
            </div>
            <div className="rounded-sm border border-eve-border/50 bg-eve-dark/30 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-eve-dim font-semibold mb-1">
                Target (Sell)
              </div>
              <DRRow label="Now price" value={formatISK(tgtNow)} />
              <DRRow
                label="Period avg"
                value={formatISK(row.DayTargetPeriodPrice ?? 0)}
              />
              <DRRow
                label="Lowest ask"
                value={
                  (dayLowestAsk ?? row.TargetLowestSell ?? 0) > 0
                    ? formatISK(dayLowestAsk ?? row.TargetLowestSell ?? 0)
                    : "—"
                }
              />
              <DRRow label="Demand/Day" value={demand.toFixed(2)} />
              <DRRow
                label="Supply"
                value={
                  daySupply != null
                    ? daySupply.toLocaleString()
                    : row.TargetSellSupply != null
                      ? row.TargetSellSupply.toLocaleString()
                      : "—"
                }
              />
              <DRRow
                label="DOS"
                value={`${dos.toFixed(2)} days`}
                dim={dos > 30}
              />
            </div>
          </div>

          <div className="rounded-sm border border-eve-border/50 bg-eve-dark/30 p-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-eve-dim font-semibold mb-1">
              Position ({(row.UnitsToBuy ?? 0).toLocaleString()} units ·{" "}
              {(row.Volume ?? 0).toFixed(2)} m³/unit)
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <DRRow
                label="Capital"
                value={formatISK(row.DayCapitalRequired ?? 0)}
              />
              <DRRow
                label="Shipping"
                value={formatISK(row.DayShippingCost ?? 0)}
              />
              <DRRow
                label="Now Profit"
                value={formatISK(row.DayNowProfit ?? row.TotalProfit ?? 0)}
                accent={(row.DayNowProfit ?? 0) > 0}
              />
              <DRRow
                label="Period Profit"
                value={formatISK(row.DayPeriodProfit ?? row.RealProfit ?? 0)}
                accent={(row.DayPeriodProfit ?? 0) > 0}
              />
              <DRRow
                label="ROI Now"
                value={formatMargin(row.DayROINow ?? 0)}
                accent={(row.DayROINow ?? 0) > 0}
              />
              <DRRow
                label="ROI Period"
                value={formatMargin(row.DayROIPeriod ?? 0)}
                accent={(row.DayROIPeriod ?? 0) > 0}
              />
              <DRRow
                label="Margin"
                value={formatMargin(row.MarginPercent ?? 0)}
              />
            </div>
          </div>

          {((row.DayAssets ?? 0) > 0 || (row.DayActiveOrders ?? 0) > 0) && (
            <div className="rounded-sm border border-eve-border/50 bg-eve-dark/30 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-eve-dim font-semibold mb-1">
                Inventory Coverage
              </div>
              {(row.DayAssets ?? 0) > 0 && (
                <DRRow
                  label="Assets in target"
                  value={`${(row.DayAssets ?? 0).toLocaleString()} units`}
                />
              )}
              {(row.DayActiveOrders ?? 0) > 0 && (
                <DRRow
                  label="Active sell orders"
                  value={`${(row.DayActiveOrders ?? 0).toLocaleString()} units`}
                />
              )}
            </div>
          )}

          {/* Trade Score + Price Spark-line */}
          <div className="rounded-sm border border-eve-border/50 bg-eve-dark/30 p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-eve-dim font-semibold">
                Trade Score
              </div>
              {row.DayTradeScore != null && (
                <TradeScoreBadge score={row.DayTradeScore} />
              )}
            </div>
            {row.DayPriceHistory && row.DayPriceHistory.length >= 2 && (
              <PriceSparkLine prices={row.DayPriceHistory} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── SVG Spark-line chart for 14-day price history ─── */
function PriceSparkLine({ prices }: { prices: number[] }) {
  const W = 380;
  const H = 48;
  const pad = 4;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * innerW;
    const y = pad + innerH - ((p - min) / range) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(" ");
  const lastX = parseFloat(pts[pts.length - 1].split(",")[0]);
  const lastY = parseFloat(pts[pts.length - 1].split(",")[1]);

  // fill area under curve
  const fillPts = `${pad},${H - pad} ` + polyline + ` ${lastX},${H - pad}`;

  const trend = prices[prices.length - 1] - prices[0];
  const lineColor = trend >= 0 ? "#4ade80" : "#f87171"; // green / red

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={fillPts} fill="url(#sparkFill)" />
        <polyline
          points={polyline}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* last dot */}
        <circle cx={lastX} cy={lastY} r="3" fill={lineColor} />
      </svg>
      <div className="flex justify-between text-[9px] text-eve-dim mt-0.5 px-1">
        <span>{prices.length}d ago</span>
        <span className="text-eve-text font-mono">
          {formatISK(min)} – {formatISK(max)}
        </span>
        <span>today</span>
      </div>
    </div>
  );
}

/* ─── Small reusable pieces ─── */

function ToolbarBtn({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-0.5 rounded-sm text-xs font-medium transition-colors cursor-pointer ${
        active
          ? "bg-eve-accent/20 text-eve-accent border border-eve-accent/30"
          : "text-eve-dim hover:text-eve-text border border-eve-border hover:border-eve-border-light"
      }`}
    >
      {label}
    </button>
  );
}

function ContextItem({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="px-4 py-1.5 text-sm text-eve-text hover:bg-eve-accent/20 hover:text-eve-accent cursor-pointer transition-colors"
    >
      {label}
    </div>
  );
}
