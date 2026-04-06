import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { batchCreateRoute, batchFillerSuggestions } from "@/lib/api";
import { formatISK } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import {
  buildBatch,
  routeLineKey,
  safeNumber,
  type BatchBuildResult,
} from "@/lib/batchMetrics";
import {
  formatDetailedManifestItemLine,
  formatBaseBatchManifestText,
  formatOrderedRouteManifestText,
  formatGroupedRouteSections,
} from "@/lib/batchManifestFormat";
import type {
  BaseBatchManifest,
  BatchRouteFillerSuggestionRow,
  BatchCreateRouteRequest,
  MergedBatchManifest,
  FlipResult,
  OrderedRouteManifest,
  RouteAdditionOption,
  StationCacheMeta,
} from "@/lib/types";
import { Modal } from "./Modal";
import { useGlobalToast } from "./Toast";
import { filterFlipResults } from "@/lib/banlistFilters";

interface BatchBuilderPopupProps {
  open: boolean;
  onClose: () => void;
  anchorRow: FlipResult | null;
  rows: FlipResult[];
  defaultCargoM3?: number;
  originSystemName?: string;
  originSystemId?: number;
  originLocationId?: number;
  originLocationName?: string;
  currentSystemId?: number;
  currentLocationId?: number;
  minRouteSecurity?: number;
  includeStructures?: boolean;
  allowLowsec?: boolean;
  allowNullsec?: boolean;
  allowWormhole?: boolean;
  routeMaxJumps?: number;
  maxDetourJumpsPerNode?: number;
  salesTaxPercent?: number;
  buyBrokerFeePercent?: number;
  sellBrokerFeePercent?: number;
  cacheMeta?: StationCacheMeta | null;
  scanSourceTab?: "radius" | "region" | "contracts";
  onOpenPriceValidation?: (manifestText: string) => void;
  bannedTypeIDs?: number[];
  bannedStationIDs?: number[];
}

type RouteState = "idle" | "searching" | "results" | "selected";
type ExecutionScoringPreset =
  | "conservative"
  | "balanced"
  | "aggressive"
  | "max_fill";

function normalizeStationName(name: string | null | undefined): string {
  return (name ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function formatStationFallback(
  line: { buy_location_id: number },
  resolvedStationName?: string,
): string {
  if (resolvedStationName?.trim()) return resolvedStationName.trim();
  if (line.buy_location_id > 0) return `Station ${line.buy_location_id}`;
  return "Unknown Station";
}

function formatSellStationFallback(
  line: { sell_location_id: number },
  matchedRow?: FlipResult,
): string {
  if (matchedRow?.SellStation?.trim()) return matchedRow.SellStation.trim();
  if (line.sell_location_id > 0) return `Station ${line.sell_location_id}`;
  return "Unknown Station";
}

function hasStationName(name: string | null | undefined): name is string {
  return (name ?? "").trim().length > 0;
}

function toKnownJumpCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function buildMergedManifest(
  baseBatch: BaseBatchManifest,
  option: RouteAdditionOption,
): MergedBatchManifest {
  const baseUnits = baseBatch.base_lines.reduce(
    (sum, line) => sum + line.units,
    0,
  );
  const addedUnits = option.lines.reduce((sum, line) => sum + line.units, 0);
  const totalVolume = baseBatch.total_volume_m3 + option.added_volume_m3;
  const remainingCapacity = Math.max(0, baseBatch.cargo_limit_m3 - totalVolume);
  return {
    origin_system_id: baseBatch.origin_system_id,
    origin_location_id: baseBatch.origin_location_id,
    final_sell_system_id: baseBatch.base_sell_system_id,
    final_sell_location_id: baseBatch.base_sell_location_id,
    base_lines: baseBatch.base_lines,
    added_lines: option.lines,
    total_line_count: baseBatch.base_line_count + option.line_count,
    total_units: baseUnits + addedUnits,
    total_volume_m3: totalVolume,
    cargo_limit_m3: baseBatch.cargo_limit_m3,
    remaining_capacity_m3: remainingCapacity,
    utilization_pct:
      baseBatch.cargo_limit_m3 > 0
        ? (totalVolume / baseBatch.cargo_limit_m3) * 100
        : 0,
    total_buy_isk: baseBatch.total_buy_isk + option.total_buy_isk,
    total_sell_isk: baseBatch.total_sell_isk + option.total_sell_isk,
    total_profit_isk: baseBatch.total_profit_isk + option.total_profit_isk,
  };
}

function additionTupleKey(line: {
  type_id: number;
  buy_location_id: number;
  buy_system_id: number;
  sell_location_id: number;
  sell_system_id: number;
}): string {
  const buyKey = safeNumber(line.buy_location_id) || safeNumber(line.buy_system_id);
  const sellKey = safeNumber(line.sell_location_id) || safeNumber(line.sell_system_id);
  return [line.type_id, buyKey, sellKey].join(":");
}

function mergeAdditionLines(
  base: RouteAdditionOption["lines"],
  extras: RouteAdditionOption["lines"],
): RouteAdditionOption["lines"] {
  const byKey = new Map<string, RouteAdditionOption["lines"][number]>();
  const roleRank: Record<string, number> = { core: 3, safe_filler: 2, stretch_filler: 1 };
  for (const line of [...base, ...extras]) {
    const key = additionTupleKey(line);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...line });
      continue;
    }
    const totalUnits = existing.units + line.units;
    const weighted = (left: number, right: number) =>
      totalUnits > 0 ? (left * existing.units + right * line.units) / totalUnits : 0;
    existing.units = totalUnits;
    existing.buy_total_isk += line.buy_total_isk;
    existing.sell_total_isk += line.sell_total_isk;
    existing.profit_total_isk += line.profit_total_isk;
    existing.route_jumps =
      existing.route_jumps > 0 && line.route_jumps > 0
        ? Math.min(existing.route_jumps, line.route_jumps)
        : Math.max(existing.route_jumps, line.route_jumps);
    existing.fill_confidence = weighted(existing.fill_confidence, line.fill_confidence);
    existing.stale_risk = weighted(existing.stale_risk, line.stale_risk);
    existing.concentration_risk = weighted(
      existing.concentration_risk,
      line.concentration_risk,
    );
    existing.line_execution_score = weighted(
      existing.line_execution_score,
      line.line_execution_score,
    );
    if (
      (roleRank[line.line_role] ?? 0) > (roleRank[existing.line_role] ?? 0)
    ) {
      existing.line_role = line.line_role;
    }
  }
  return Array.from(byKey.values());
}

function classifyComplexity(stopCount: number): "Clean" | "Moderate" | "Busy" {
  if (stopCount <= 2) return "Clean";
  if (stopCount <= 4) return "Moderate";
  return "Busy";
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

export function BatchBuilderPopup({
  open,
  onClose,
  anchorRow,
  rows,
  defaultCargoM3 = 0,
  originSystemName,
  originSystemId,
  originLocationId,
  originLocationName,
  currentSystemId,
  currentLocationId,
  minRouteSecurity = 0.45,
  includeStructures = false,
  allowLowsec = false,
  allowNullsec = false,
  allowWormhole = false,
  routeMaxJumps = 12,
  maxDetourJumpsPerNode,
  salesTaxPercent = 0,
  buyBrokerFeePercent = 0,
  sellBrokerFeePercent = 0,
  cacheMeta = null,
  scanSourceTab = "radius",
  onOpenPriceValidation,
  bannedTypeIDs = [],
  bannedStationIDs = [],
}: BatchBuilderPopupProps) {
  const { t } = useI18n();
  const { addToast } = useGlobalToast();
  const [cargoLimitM3, setCargoLimitM3] = useState<number>(
    defaultCargoM3 > 0 ? defaultCargoM3 : 0,
  );
  const [routeState, setRouteState] = useState<RouteState>("idle");
  const [routeOptions, setRouteOptions] = useState<RouteAdditionOption[]>([]);
  const [routeSortBy, setRouteSortBy] = useState<
    "recommended" | "execution_score" | "isk_per_jump" | "total_profit_isk"
  >("recommended");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [executionScoringPreset, setExecutionScoringPreset] =
    useState<ExecutionScoringPreset>("balanced");
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [mergedManifest, setMergedManifest] =
    useState<MergedBatchManifest | null>(null);
  const [lastProgress, setLastProgress] = useState<string>("");
  const [routeDiagnostics, setRouteDiagnostics] = useState<string[]>([]);
  const [fillerSuggestions, setFillerSuggestions] = useState<
    BatchRouteFillerSuggestionRow[]
  >([]);
  const [fillerRemainingM3, setFillerRemainingM3] = useState<number>(0);
  const [selectedFillerKeys, setSelectedFillerKeys] = useState<
    Record<string, boolean>
  >({});
  const [appliedFillerLines, setAppliedFillerLines] = useState<
    RouteAdditionOption["lines"]
  >([]);
  const [fillerLoading, setFillerLoading] = useState(false);
  const activeRequestRef = useRef(0);
  const activeAbortRef = useRef<AbortController | null>(null);
  const activeFillerAbortRef = useRef<AbortController | null>(null);
  const lastAppliedPresetRef = useRef<ExecutionScoringPreset>("balanced");

  useEffect(() => {
    if (!open) return;
    setCargoLimitM3(defaultCargoM3 > 0 ? defaultCargoM3 : 0);
    setRouteState("idle");
    setRouteOptions([]);
    setRouteSortBy("recommended");
    setStrategyFilter("all");
    setExecutionScoringPreset("balanced");
    lastAppliedPresetRef.current = "balanced";
    setRouteError(null);
    setSelectedOptionId(null);
    setMergedManifest(null);
    setLastProgress("");
    setRouteDiagnostics([]);
    setFillerSuggestions([]);
    setFillerRemainingM3(0);
    setSelectedFillerKeys({});
    setAppliedFillerLines([]);
    setFillerLoading(false);
  }, [open, defaultCargoM3]);

  const allowedRows = useMemo(
    () => filterFlipResults(rows, bannedTypeIDs, bannedStationIDs),
    [rows, bannedTypeIDs, bannedStationIDs],
  );

  const safeAnchorRow = useMemo(() => {
    if (!anchorRow) return null;
    const anchorAllowed = filterFlipResults(
      [anchorRow],
      bannedTypeIDs,
      bannedStationIDs,
    );
    return anchorAllowed.length > 0 ? anchorAllowed[0] : null;
  }, [anchorRow, bannedTypeIDs, bannedStationIDs]);

  const batch = useMemo(() => {
    if (!safeAnchorRow) {
      const emptyBatch: BatchBuildResult = {
        lines: [],
        totalVolume: 0,
        totalProfit: 0,
        totalCapital: 0,
        totalGrossSell: 0,
        remainingM3: cargoLimitM3 > 0 ? cargoLimitM3 : null,
        usedPercent: cargoLimitM3 > 0 ? 0 : null,
      };
      return emptyBatch;
    }
    return buildBatch(safeAnchorRow, allowedRows, cargoLimitM3);
  }, [safeAnchorRow, allowedRows, cargoLimitM3]);

  const baseBatchManifest = useMemo<BaseBatchManifest | null>(() => {
    if (!safeAnchorRow || batch.lines.length === 0 || cargoLimitM3 <= 0)
      return null;

    const resolvedOriginSystemId = originSystemId ?? safeAnchorRow.BuySystemID;
    const resolvedOriginSystemName =
      originSystemName?.trim() || safeAnchorRow.BuySystemName;
    const resolvedOriginLocationId =
      originLocationId ?? safeAnchorRow.BuyLocationID ?? 0;
    const resolvedOriginLocationName =
      originLocationName?.trim() || safeAnchorRow.BuyStation;
    if (
      !Number.isFinite(resolvedOriginSystemId) ||
      resolvedOriginSystemId <= 0 ||
      !resolvedOriginSystemName ||
      !Number.isFinite(resolvedOriginLocationId) ||
      resolvedOriginLocationId <= 0 ||
      !resolvedOriginLocationName
    ) {
      return null;
    }

    const baseLines = batch.lines.map((line) => {
      const buyPrice =
        safeNumber(line.row.ExpectedBuyPrice) > 0
          ? safeNumber(line.row.ExpectedBuyPrice)
          : safeNumber(line.row.BuyPrice);
      const sellPrice =
        safeNumber(line.row.ExpectedSellPrice) > 0
          ? safeNumber(line.row.ExpectedSellPrice)
          : safeNumber(line.row.SellPrice);
      return {
        type_id: line.row.TypeID,
        type_name: line.row.TypeName,
        units: line.units,
        unit_volume_m3: safeNumber(line.row.Volume),
        buy_system_id: line.row.BuySystemID,
        buy_location_id: line.row.BuyLocationID ?? 0,
        sell_system_id: line.row.SellSystemID,
        sell_location_id: line.row.SellLocationID ?? 0,
        buy_price_isk: buyPrice,
        sell_price_isk: sellPrice,
        buy_total_isk: line.capital,
        sell_total_isk: line.grossSell,
        profit_total_isk: line.profit,
        jumps: Math.max(0, Math.floor(safeNumber(line.row.TotalJumps))),
      };
    });

    const totalUnits = baseLines.reduce((sum, line) => sum + line.units, 0);
    const remainingCapacity = Math.max(0, cargoLimitM3 - batch.totalVolume);

    return {
      origin_system_id: resolvedOriginSystemId,
      origin_system_name: resolvedOriginSystemName,
      origin_location_id: resolvedOriginLocationId,
      origin_location_name: resolvedOriginLocationName,
      base_buy_system_id: safeAnchorRow.BuySystemID,
      base_buy_location_id: safeAnchorRow.BuyLocationID ?? 0,
      base_sell_system_id: safeAnchorRow.SellSystemID,
      base_sell_location_id: safeAnchorRow.SellLocationID ?? 0,
      base_lines: baseLines,
      base_line_count: baseLines.length,
      total_units: totalUnits,
      total_volume_m3: batch.totalVolume,
      total_buy_isk: batch.totalCapital,
      total_sell_isk: batch.totalGrossSell,
      total_profit_isk: batch.totalProfit,
      cargo_limit_m3: cargoLimitM3,
      remaining_capacity_m3: remainingCapacity,
    };
  }, [
    safeAnchorRow,
    batch,
    cargoLimitM3,
    originSystemId,
    originSystemName,
    originLocationId,
    originLocationName,
  ]);

  const createRouteError = useMemo(() => {
    if (!safeAnchorRow) return null;
    if (!baseBatchManifest) return t("batchBuilderRouteMissingOrigin");
    if (baseBatchManifest.remaining_capacity_m3 <= 0)
      return t("batchBuilderRouteNoRemainingCargo");
    return null;
  }, [safeAnchorRow, baseBatchManifest, t]);

  const sortedRouteOptions = useMemo(() => {
    const decorated = routeOptions.map((option, index) => ({ option, index }));
    decorated.sort((a, b) => {
      const left = a.option;
      const right = b.option;
      if (
        routeSortBy === "recommended" &&
        (left.recommendation_score ?? 0) !== (right.recommendation_score ?? 0)
      ) {
        return (
          (right.recommendation_score ?? 0) - (left.recommendation_score ?? 0)
        );
      }
      if (
        routeSortBy === "isk_per_jump" &&
        left.isk_per_jump !== right.isk_per_jump
      ) {
        return right.isk_per_jump - left.isk_per_jump;
      }
      if (
        routeSortBy === "total_profit_isk" &&
        left.total_profit_isk !== right.total_profit_isk
      ) {
        return right.total_profit_isk - left.total_profit_isk;
      }
      if (left.execution_score !== right.execution_score) {
        return right.execution_score - left.execution_score;
      }
      return a.index - b.index;
    });
    return decorated.map((entry, idx) => ({ ...entry.option, rank: idx + 1 }));
  }, [routeOptions, routeSortBy]);

  const strategyChoices = useMemo(() => {
    const labels = new Map<string, string>();
    for (const option of routeOptions) {
      const id = (option.strategy_id ?? option.option_id ?? "").trim();
      if (!id) continue;
      if (!labels.has(id)) {
        const fallback = id
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        labels.set(id, option.strategy_label?.trim() || fallback);
      }
    }
    return Array.from(labels.entries()).map(([id, label]) => ({ id, label }));
  }, [routeOptions]);

  const visibleRouteOptions = useMemo(
    () =>
      strategyFilter === "all"
        ? sortedRouteOptions
        : sortedRouteOptions.filter(
            (option) => (option.strategy_id ?? option.option_id) === strategyFilter,
          ),
    [sortedRouteOptions, strategyFilter],
  );

  const candidateSnapshot = useMemo(
    () =>
      scanSourceTab === "radius"
        ? allowedRows
            .filter(
              (row) =>
                row.TypeID > 0 &&
                (row.BuyLocationID ?? 0) > 0 &&
                (row.SellLocationID ?? 0) > 0,
            )
            .map((row) => ({
              type_id: row.TypeID,
              type_name: row.TypeName,
              units: Math.max(0, Math.floor(safeNumber(row.UnitsToBuy))),
              unit_volume_m3: safeNumber(row.Volume),
              buy_system_id: row.BuySystemID,
              buy_location_id: row.BuyLocationID ?? 0,
              sell_system_id: row.SellSystemID,
              sell_location_id: row.SellLocationID ?? 0,
              buy_price_isk:
                safeNumber(row.ExpectedBuyPrice) > 0
                  ? safeNumber(row.ExpectedBuyPrice)
                  : safeNumber(row.BuyPrice),
              sell_price_isk:
                safeNumber(row.ExpectedSellPrice) > 0
                  ? safeNumber(row.ExpectedSellPrice)
                  : safeNumber(row.SellPrice),
            }))
            .filter((candidate) => candidate.units > 0 && candidate.unit_volume_m3 > 0)
        : [],
    [scanSourceTab, allowedRows],
  );

  const selectedOption = useMemo(
    () => routeOptions.find((option) => option.option_id === selectedOptionId) ?? null,
    [routeOptions, selectedOptionId],
  );
  const effectiveAddedLines = useMemo(
    () =>
      selectedOption
        ? mergeAdditionLines(selectedOption.lines, appliedFillerLines)
        : [],
    [selectedOption, appliedFillerLines],
  );
  const effectiveSelectedSummary = useMemo(() => {
    const totals = {
      lines: effectiveAddedLines,
      line_count: effectiveAddedLines.length,
      added_volume_m3: 0,
      total_buy_isk: 0,
      total_sell_isk: 0,
      total_profit_isk: 0,
      core_line_count: 0,
      safe_filler_line_count: 0,
      stretch_filler_line_count: 0,
    };
    for (const line of effectiveAddedLines) {
      totals.added_volume_m3 += line.units * line.unit_volume_m3;
      totals.total_buy_isk += line.buy_total_isk;
      totals.total_sell_isk += line.sell_total_isk;
      totals.total_profit_isk += line.profit_total_isk;
      if (line.line_role === "core") totals.core_line_count += 1;
      else if (line.line_role === "safe_filler") totals.safe_filler_line_count += 1;
      else totals.stretch_filler_line_count += 1;
    }
    return totals;
  }, [effectiveAddedLines]);

  const getBaseManifestText = useCallback((): string => {
    if (!anchorRow || batch.lines.length === 0) return "";
    const buyJumps = Math.max(0, Math.floor(safeNumber(anchorRow.BuyJumps)));
    const sellJumps = Math.max(0, Math.floor(safeNumber(anchorRow.SellJumps)));
    return formatBaseBatchManifestText({
      buyStation: anchorRow.BuyStation,
      sellStation: anchorRow.SellStation,
      buyJumps,
      sellJumps,
      cargoLimitM3,
      cargoUnlimitedLabel: t("batchBuilderCargoUnlimited"),
      itemCount: batch.lines.length,
      totalVolume: batch.totalVolume,
      totalCapital: batch.totalCapital,
      totalGrossSell: batch.totalGrossSell,
      totalProfit: batch.totalProfit,
      lines: batch.lines,
      t,
    });
  }, [anchorRow, batch, cargoLimitM3, t]);

  const copyManifest = useCallback(async () => {
    const manifest = getBaseManifestText();
    if (!manifest) return;
    await navigator.clipboard.writeText(manifest);
    addToast(t("batchBuilderCopied"), "success", 2200);
  }, [getBaseManifestText, t, addToast]);

  const openPriceValidation = useCallback(() => {
    const manifest = getBaseManifestText();
    if (!manifest) return;
    onOpenPriceValidation?.(manifest);
  }, [getBaseManifestText, onOpenPriceValidation]);

  const copyMergedManifest = useCallback(async () => {
    if (!baseBatchManifest || !mergedManifest) return;
    const selectedOption = routeOptions.find(
      (option) => option.option_id === selectedOptionId,
    );
    if (!selectedOption) return;
    const selectedOptionLines = mergeAdditionLines(
      selectedOption.lines,
      appliedFillerLines,
    );
    const routeRows = allowedRows.filter((row) => row.TypeID > 0);
    const buyLocationNameById = new Map<number, string>();
    const locationNameMetaById = new Map<number, string>();
    for (const row of routeRows) {
      const buyLocationId = safeNumber(row.BuyLocationID);
      if (buyLocationId > 0 && hasStationName(row.BuyStation)) {
        const trimmedName = row.BuyStation.trim();
        if (!buyLocationNameById.has(buyLocationId)) {
          buyLocationNameById.set(buyLocationId, trimmedName);
        }
        if (!locationNameMetaById.has(buyLocationId)) {
          locationNameMetaById.set(buyLocationId, trimmedName);
        }
      }
      const sellLocationId = safeNumber(row.SellLocationID);
      if (
        sellLocationId > 0 &&
        hasStationName(row.SellStation) &&
        !locationNameMetaById.has(sellLocationId)
      ) {
        locationNameMetaById.set(sellLocationId, row.SellStation.trim());
      }
    }

    type CombinedLine = {
      type_id: number;
      type_name: string;
      units: number;
      unit_volume_m3: number;
      buy_system_id: number;
      buy_location_id: number;
      sell_system_id: number;
      sell_location_id: number;
      buy_total_isk: number;
      sell_total_isk: number;
      profit_total_isk: number;
      route_jumps: number;
      source: "base" | "addition";
      line_role?: "core" | "safe_filler" | "stretch_filler";
    };
    const combinedLines: CombinedLine[] = [
      ...baseBatchManifest.base_lines.map((line) => ({
        type_id: line.type_id,
        type_name: line.type_name,
        units: line.units,
        unit_volume_m3: line.unit_volume_m3,
        buy_system_id: line.buy_system_id,
        buy_location_id: line.buy_location_id,
        sell_system_id: line.sell_system_id,
        sell_location_id: line.sell_location_id,
        buy_total_isk: line.buy_total_isk,
        sell_total_isk: line.sell_total_isk,
        profit_total_isk: line.profit_total_isk,
        route_jumps: line.jumps,
        source: "base" as const,
        line_role: "core" as const,
      })),
      ...selectedOptionLines.map((line) => ({
        ...line,
        source: "addition" as const,
      })),
    ];

    const findRowForLine = (line: CombinedLine): FlipResult | undefined => {
      const exact = routeRows.find((row) => {
        if (row.TypeID !== line.type_id) return false;
        const rowBuyLocationId = safeNumber(row.BuyLocationID);
        const rowSellLocationId = safeNumber(row.SellLocationID);
        if (
          line.buy_location_id > 0 &&
          rowBuyLocationId !== line.buy_location_id
        )
          return false;
        if (
          line.sell_location_id > 0 &&
          rowSellLocationId !== line.sell_location_id
        )
          return false;
        return true;
      });
      if (exact) return exact;
      return routeRows.find((row) => row.TypeID === line.type_id);
    };

    const resolveBuyStationName = (
      line: CombinedLine,
      matchedRow?: FlipResult,
    ): { stationName: string; usedIdFallback: boolean } => {
      if (hasStationName(matchedRow?.BuyStation)) {
        return {
          stationName: matchedRow.BuyStation.trim(),
          usedIdFallback: false,
        };
      }

      const buyLocationId = safeNumber(line.buy_location_id);
      if (buyLocationId > 0) {
        const rowMappedName = buyLocationNameById.get(buyLocationId);
        if (hasStationName(rowMappedName)) {
          return { stationName: rowMappedName, usedIdFallback: false };
        }

        if (
          buyLocationId ===
            safeNumber(baseBatchManifest.base_buy_location_id) &&
          hasStationName(anchorRow?.BuyStation)
        ) {
          return {
            stationName: anchorRow.BuyStation.trim(),
            usedIdFallback: false,
          };
        }
        if (
          buyLocationId === safeNumber(baseBatchManifest.origin_location_id) &&
          hasStationName(baseBatchManifest.origin_location_name)
        ) {
          return {
            stationName: baseBatchManifest.origin_location_name.trim(),
            usedIdFallback: false,
          };
        }
        if (
          buyLocationId ===
            safeNumber(baseBatchManifest.base_sell_location_id) &&
          hasStationName(anchorRow?.SellStation)
        ) {
          return {
            stationName: anchorRow.SellStation.trim(),
            usedIdFallback: false,
          };
        }

        const metaMappedName = locationNameMetaById.get(buyLocationId);
        if (hasStationName(metaMappedName)) {
          return { stationName: metaMappedName, usedIdFallback: false };
        }
      }

      return { stationName: formatStationFallback(line), usedIdFallback: true };
    };

    const fallbackToIdStationIds = new Set<number>();
    const stationOrder: string[] = [];
    const routeIndexBySystemID = new Map<number, number>();
    (selectedOption.route_sequence ?? []).forEach((systemID, idx) => {
      if (!routeIndexBySystemID.has(systemID)) {
        routeIndexBySystemID.set(systemID, idx);
      }
    });
    const stations = new Map<
      string,
      OrderedRouteManifest["stations"][number]
    >();
    const stationSystemByKey = new Map<string, number>();
    for (const line of combinedLines) {
      const matchedRow = findRowForLine(line);
      const matchedSellRow =
        matchedRow ??
        routeRows.find(
          (row) => safeNumber(row.SellLocationID) === line.sell_location_id,
        );
      const { stationName, usedIdFallback } = resolveBuyStationName(
        line,
        matchedRow,
      );
      if (usedIdFallback && line.buy_location_id > 0) {
        fallbackToIdStationIds.add(line.buy_location_id);
      }
      const primaryKey =
        line.buy_location_id > 0 ? `id:${line.buy_location_id}` : "";
      const fallbackKey = normalizeStationName(stationName);
      const stationKey = primaryKey || `name:${fallbackKey}`;
      if (!stations.has(stationKey)) {
        stationOrder.push(stationKey);
        stationSystemByKey.set(stationKey, line.buy_system_id);
        const jumpsToBuy = toKnownJumpCount(matchedRow?.BuyJumps);
        const jumpsBuyToSell = toKnownJumpCount(
          matchedRow?.SellJumps ?? matchedSellRow?.SellJumps,
        );
        stations.set(stationKey, {
          station_key: stationKey,
          buy_station_name: stationName,
          sell_station_name: formatSellStationFallback(line, matchedSellRow),
          cargo_m3: mergedManifest.cargo_limit_m3,
          jumps_to_buy_station: jumpsToBuy,
          jumps_buy_to_sell: jumpsBuyToSell,
          item_count: 0,
          total_volume_m3: 0,
          total_buy_isk: 0,
          total_sell_isk: 0,
          total_profit_isk: 0,
          isk_per_jump: 0,
          lines: [],
        });
      }

      const station = stations.get(stationKey);
      if (!station) continue;
      const units = Math.max(0, Math.floor(safeNumber(line.units)));
      const unitVolumeM3 = safeNumber(line.unit_volume_m3);
      const volumeM3 = unitVolumeM3 * units;
      const buyTotal = safeNumber(line.buy_total_isk);
      const sellTotal = safeNumber(line.sell_total_isk);
      const profit = safeNumber(line.profit_total_isk);
      station.lines.push({
        type_id: line.type_id,
        type_name: line.type_name,
        units,
        unit_volume_m3: unitVolumeM3,
        volume_m3: volumeM3,
        buy_total_isk: buyTotal,
        buy_per_isk: units > 0 ? buyTotal / units : 0,
        sell_total_isk: sellTotal,
        sell_per_isk: units > 0 ? sellTotal / units : 0,
        profit_isk: profit,
      });
      station.item_count += 1;
      station.total_volume_m3 += volumeM3;
      station.total_buy_isk += buyTotal;
      station.total_sell_isk += sellTotal;
      station.total_profit_isk += profit;
      const jumpsToBuy = station.jumps_to_buy_station;
      const jumpsBuyToSell = station.jumps_buy_to_sell;
      const hasKnownSegments = jumpsToBuy != null && jumpsBuyToSell != null;
      if (!hasKnownSegments) {
        station.isk_per_jump = null;
        continue;
      }
      const stationJumps = jumpsToBuy + jumpsBuyToSell;
      station.isk_per_jump =
        stationJumps > 0 && Number.isFinite(station.total_profit_isk)
          ? station.total_profit_isk / stationJumps
          : null;
    }

    if (fallbackToIdStationIds.size > 0) {
      const ids = Array.from(fallbackToIdStationIds).sort((a, b) => a - b);
      console.warn(
        "[BatchBuilderPopup] copyMergedManifest used station ID fallback labels",
        {
          station_ids: ids,
        },
      );
    }

    const orderedStations = stationOrder
      .map((key) => stations.get(key))
      .filter(
        (station): station is OrderedRouteManifest["stations"][number] =>
          station != null,
      );
    orderedStations.sort((left, right) => {
      const leftSystem = stationSystemByKey.get(left.station_key) ?? 0;
      const rightSystem = stationSystemByKey.get(right.station_key) ?? 0;
      const leftRoute = routeIndexBySystemID.get(leftSystem);
      const rightRoute = routeIndexBySystemID.get(rightSystem);
      if (leftRoute != null || rightRoute != null) {
        if (leftRoute == null) return 1;
        if (rightRoute == null) return -1;
        if (leftRoute !== rightRoute) return leftRoute - rightRoute;
      }
      return left.buy_station_name.localeCompare(right.buy_station_name);
    });
    const orderedManifest: OrderedRouteManifest = {
      summary: {
        station_count: orderedStations.length,
        item_count: baseBatchManifest.base_line_count + selectedOptionLines.length,
        total_units: mergedManifest.total_units,
        total_volume_m3: mergedManifest.total_volume_m3,
        total_buy_isk: mergedManifest.total_buy_isk,
        total_sell_isk: mergedManifest.total_sell_isk,
        total_profit_isk: mergedManifest.total_profit_isk,
        total_jumps: selectedOption.total_jumps,
        isk_per_jump:
          selectedOption.total_jumps > 0 &&
          Number.isFinite(selectedOption.isk_per_jump)
            ? selectedOption.isk_per_jump
            : undefined,
      },
      stations: orderedStations,
    };

    const routeManifestText = formatOrderedRouteManifestText({
      originLabel: `${baseBatchManifest.origin_system_name} (${baseBatchManifest.origin_location_name})`,
      metadataHeader: undefined,
      manifest: orderedManifest,
      t,
    });
    const groupedSections = formatGroupedRouteSections({
      baseLines: baseBatchManifest.base_lines,
      addedLines: selectedOptionLines,
      formatDetailedLine: (line) => formatDetailedManifestItemLine(line, t),
    });
    const manifestParts = [routeManifestText];
    if (groupedSections.length > 0) {
      manifestParts.push(
        "",
        t("batchBuilderMergedManifestBaseItemsHeader"),
        ...groupedSections,
      );
    }
    await navigator.clipboard.writeText(manifestParts.join("\n"));
    addToast(t("batchBuilderCopiedMerged"), "success", 2200);
  }, [
    baseBatchManifest,
    mergedManifest,
    addToast,
    t,
    routeOptions,
    selectedOptionId,
    allowedRows,
    anchorRow,
    appliedFillerLines,
  ]);

  const startBatchCreateRoute = useCallback(async () => {
    if (!baseBatchManifest) {
      setRouteState("results");
      setRouteError(t("batchBuilderRouteMissingOrigin"));
      return;
    }
    if (baseBatchManifest.remaining_capacity_m3 <= 0) {
      setRouteState("results");
      setRouteError(t("batchBuilderRouteNoRemainingCargo"));
      return;
    }

    activeAbortRef.current?.abort();
    const controller = new AbortController();
    activeAbortRef.current = controller;

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    const normalizedRouteMaxJumps = Math.max(
      0,
      Math.floor(safeNumber(routeMaxJumps)),
    );
    const normalizedMaxDetourJumpsPerNode = Number.isFinite(
      maxDetourJumpsPerNode,
    )
      ? Math.max(0, Math.floor(safeNumber(maxDetourJumpsPerNode)))
      : undefined;

    const request: BatchCreateRouteRequest = {
      origin_system_id: baseBatchManifest.origin_system_id,
      origin_system_name: baseBatchManifest.origin_system_name,
      origin_location_id: baseBatchManifest.origin_location_id,
      origin_location_name: baseBatchManifest.origin_location_name,
      current_system_id: currentSystemId ?? baseBatchManifest.origin_system_id,
      current_location_id:
        currentLocationId ?? baseBatchManifest.origin_location_id,
      base_batch: baseBatchManifest,
      cargo_limit_m3: baseBatchManifest.cargo_limit_m3,
      remaining_capacity_m3: baseBatchManifest.remaining_capacity_m3,
      min_route_security: minRouteSecurity,
      include_structures: includeStructures,
      allow_lowsec: allowLowsec,
      allow_nullsec: allowNullsec,
      allow_wormhole: allowWormhole,
      route_max_jumps: normalizedRouteMaxJumps,
      ...(normalizedMaxDetourJumpsPerNode !== undefined
        ? { max_detour_jumps_per_node: normalizedMaxDetourJumpsPerNode }
        : {}),
      sales_tax_percent: salesTaxPercent,
      buy_broker_fee_percent: buyBrokerFeePercent,
      sell_broker_fee_percent: sellBrokerFeePercent,
      candidate_context: {
        source_tab: scanSourceTab,
        cache_revision: cacheMeta?.current_revision,
        cache_next_expiry: cacheMeta?.next_expiry_at,
        cache_stale: cacheMeta?.stale ?? false,
      },
      candidate_snapshot:
        scanSourceTab === "radius" ? candidateSnapshot : undefined,
      deterministic_sort: {
        primary: "isk_per_jump",
        secondary: "total_profit_isk",
        tie_break_order: ["utilization_pct", "type_id"],
      },
      execution_scoring: {
        preset: executionScoringPreset,
      },
    };

    setRouteState("searching");
    setRouteError(null);
    setRouteOptions([]);
    setSelectedOptionId(null);
    setMergedManifest(null);
    setAppliedFillerLines([]);
    setFillerSuggestions([]);
    setSelectedFillerKeys({});
    setFillerRemainingM3(0);
    setLastProgress(t("batchBuilderRouteSearchingProgress"));
    setRouteDiagnostics([]);

    try {
      const response = await batchCreateRoute(request, controller.signal);
      if (requestId !== activeRequestRef.current) {
        setRouteState("results");
        setRouteError(t("batchBuilderRouteStaleRequest"));
        return;
      }
      const options = response.ranked_options ?? [];
      const diagnostics = response.diagnostics ?? [];
      setRouteDiagnostics(diagnostics);
      if (
        diagnostics.some((entry) =>
          /fallback|stale|market-only|unavailable/i.test(entry),
        )
      ) {
        addToast(diagnostics[0], "warning", 3500);
      }
      setRouteOptions(options);
      if (options.length === 0) {
        setRouteState("results");
        setRouteError(t("batchBuilderRouteNoOptions"));
        return;
      }
      const recommended =
        options.find((option) => option.recommended) ??
        [...options].sort(
          (a, b) =>
            (b.recommendation_score ?? 0) - (a.recommendation_score ?? 0),
        )[0] ??
        null;
      if (recommended && baseBatchManifest) {
        setSelectedOptionId(recommended.option_id);
        setMergedManifest(buildMergedManifest(baseBatchManifest, recommended));
        setAppliedFillerLines([]);
        setFillerSuggestions([]);
        setSelectedFillerKeys({});
        setFillerRemainingM3(0);
        setRouteState("selected");
      } else {
        setSelectedOptionId(null);
        setMergedManifest(null);
        setRouteState("results");
      }
      setLastProgress(
        t("batchBuilderRouteSearchComplete", { count: options.length }),
      );
    } catch (error) {
      const isAbort = controller.signal.aborted;
      setRouteState("results");
      setRouteError(
        isAbort
          ? t("batchBuilderRouteStaleRequest")
          : t("batchBuilderRouteRequestFailed"),
      );
      if (!isAbort) {
        const msg = error instanceof Error ? error.message : String(error);
        addToast(
          `${t("batchBuilderRouteRequestFailed")}: ${msg}`,
          "error",
          3000,
        );
      }
    }
  }, [
    baseBatchManifest,
    minRouteSecurity,
    includeStructures,
    allowLowsec,
    allowNullsec,
    allowWormhole,
    routeMaxJumps,
    maxDetourJumpsPerNode,
    salesTaxPercent,
    buyBrokerFeePercent,
    sellBrokerFeePercent,
    currentSystemId,
    currentLocationId,
    cacheMeta,
    scanSourceTab,
    candidateSnapshot,
    executionScoringPreset,
    t,
    addToast,
  ]);

  useEffect(() => {
    if (!open || !baseBatchManifest || routeOptions.length === 0) return;
    if (lastAppliedPresetRef.current === executionScoringPreset) return;
    lastAppliedPresetRef.current = executionScoringPreset;
    void startBatchCreateRoute();
  }, [
    executionScoringPreset,
    open,
    baseBatchManifest,
    routeOptions.length,
    startBatchCreateRoute,
  ]);

  useEffect(() => {
    if (!baseBatchManifest || !selectedOption) return;
    const optionForMerge: RouteAdditionOption = {
      ...selectedOption,
      lines: effectiveSelectedSummary.lines,
      line_count: effectiveSelectedSummary.line_count,
      added_volume_m3: effectiveSelectedSummary.added_volume_m3,
      total_buy_isk: effectiveSelectedSummary.total_buy_isk,
      total_sell_isk: effectiveSelectedSummary.total_sell_isk,
      total_profit_isk: effectiveSelectedSummary.total_profit_isk,
      core_line_count: effectiveSelectedSummary.core_line_count,
      safe_filler_line_count: effectiveSelectedSummary.safe_filler_line_count,
      stretch_filler_line_count: effectiveSelectedSummary.stretch_filler_line_count,
    };
    setMergedManifest(buildMergedManifest(baseBatchManifest, optionForMerge));
  }, [baseBatchManifest, selectedOption, effectiveSelectedSummary]);

  useEffect(() => {
    if (!open || !baseBatchManifest || !selectedOption) {
      return;
    }
    if (candidateSnapshot.length === 0) {
      setFillerSuggestions([]);
      setSelectedFillerKeys({});
      setFillerRemainingM3(0);
      return;
    }
    activeFillerAbortRef.current?.abort();
    const controller = new AbortController();
    activeFillerAbortRef.current = controller;
    setFillerLoading(true);
    void batchFillerSuggestions(
      {
        cargo_limit_m3: baseBatchManifest.cargo_limit_m3,
        origin_system_id: baseBatchManifest.origin_system_id,
        current_system_id:
          currentSystemId ?? baseBatchManifest.origin_system_id,
        min_route_security: minRouteSecurity,
        allow_lowsec: allowLowsec,
        allow_nullsec: allowNullsec,
        allow_wormhole: allowWormhole,
        route_max_jumps: Math.max(0, Math.floor(safeNumber(routeMaxJumps))),
        execution_scoring: { preset: executionScoringPreset },
        base_lines: baseBatchManifest.base_lines,
        selected_additions: selectedOption.lines,
        candidate_snapshot: candidateSnapshot,
      },
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        setFillerSuggestions(response.suggestions ?? []);
        setFillerRemainingM3(response.remaining_capacity_m3 ?? 0);
        const defaults: Record<string, boolean> = {};
        for (const suggestion of response.suggestions ?? []) {
          defaults[
            additionTupleKey({
              type_id: suggestion.type_id,
              buy_location_id: suggestion.buy_location_id,
              buy_system_id: suggestion.buy_system_id,
              sell_location_id: suggestion.sell_location_id,
              sell_system_id: suggestion.sell_system_id,
            })
          ] = suggestion.suggested_role === "safe_filler";
        }
        setSelectedFillerKeys(defaults);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFillerSuggestions([]);
        setSelectedFillerKeys({});
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setFillerLoading(false);
        }
      });
    return () => controller.abort();
  }, [
    open,
    baseBatchManifest,
    selectedOption,
    candidateSnapshot,
    currentSystemId,
    minRouteSecurity,
    allowLowsec,
    allowNullsec,
    allowWormhole,
    routeMaxJumps,
    executionScoringPreset,
  ]);

  const onSelectOption = useCallback(
    (option: RouteAdditionOption) => {
      if (!baseBatchManifest) return;
      setSelectedOptionId(option.option_id);
      setMergedManifest(buildMergedManifest(baseBatchManifest, option));
      setAppliedFillerLines([]);
      setSelectedFillerKeys({});
      setRouteState("selected");
    },
    [baseBatchManifest],
  );

  const suggestionToAdditionLine = useCallback(
    (suggestion: BatchRouteFillerSuggestionRow): RouteAdditionOption["lines"][number] => ({
      type_id: suggestion.type_id,
      type_name: suggestion.type_name,
      units: suggestion.units,
      unit_volume_m3: suggestion.unit_volume_m3,
      buy_system_id: suggestion.buy_system_id,
      buy_location_id: suggestion.buy_location_id,
      sell_system_id: suggestion.sell_system_id,
      sell_location_id: suggestion.sell_location_id,
      buy_total_isk: suggestion.added_capital_isk,
      sell_total_isk:
        suggestion.added_capital_isk + suggestion.added_profit_isk,
      profit_total_isk: suggestion.added_profit_isk,
      route_jumps: 0,
      fill_confidence: suggestion.fill_confidence,
      stale_risk: suggestion.stale_risk,
      concentration_risk: 0,
      line_execution_score: suggestion.filler_score,
      line_role:
        suggestion.suggested_role === "core" ||
        suggestion.suggested_role === "safe_filler" ||
        suggestion.suggested_role === "stretch_filler"
          ? suggestion.suggested_role
          : "stretch_filler",
    }),
    [],
  );

  if (!anchorRow) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t("batchBuilderTitle")}: ${anchorRow.BuyStation} -> ${anchorRow.SellStation}`}
      width="max-w-5xl"
    >
      <div className="p-4 flex flex-col gap-3">
        <p className="text-xs text-eve-dim">{t("batchBuilderHint")}</p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-eve-dim">
            <span>{t("batchBuilderCargoLabel")}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={cargoLimitM3}
              onChange={(e) =>
                setCargoLimitM3(
                  Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0),
                )
              }
              className="w-36 px-2 py-1 bg-eve-input border border-eve-border rounded-sm text-eve-text font-mono text-sm"
            />
            <span className="text-[10px] text-eve-dim/80">
              {t("batchBuilderCargoHint")}
            </span>
          </label>

          <button
            type="button"
            onClick={() => {
              void copyManifest();
            }}
            disabled={batch.lines.length === 0}
            className="px-3 py-1.5 rounded-sm border border-eve-accent/70 text-eve-accent hover:bg-eve-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold uppercase tracking-wider"
          >
            {t("batchBuilderCopyManifest")}
          </button>
          <button
            type="button"
            onClick={openPriceValidation}
            disabled={batch.lines.length === 0}
            className="px-3 py-1.5 rounded-sm border border-purple-400/70 text-purple-300 hover:bg-purple-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold uppercase tracking-wider"
          >
            {t("batchBuilderOpenPriceValidation")}
          </button>

          <button
            type="button"
            onClick={() => {
              void startBatchCreateRoute();
            }}
            disabled={
              routeState === "searching" ||
              !!createRouteError ||
              batch.lines.length === 0
            }
            className="px-3 py-1.5 rounded-sm border border-blue-400/70 text-blue-300 hover:bg-blue-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold uppercase tracking-wider"
          >
            {t("batchBuilderBatchCreateRoute")}
          </button>

          <button
            type="button"
            onClick={() => {
              void copyMergedManifest();
            }}
            disabled={!mergedManifest}
            className="px-3 py-1.5 rounded-sm border border-green-500/60 text-green-300 hover:bg-green-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold uppercase tracking-wider"
          >
            {t("batchBuilderCopyMergedManifest")}
          </button>
        </div>

        {createRouteError && routeState === "idle" && (
          <div className="border border-yellow-600/40 rounded-sm p-2 text-xs text-yellow-300">
            {createRouteError}
          </div>
        )}

        {routeState === "searching" && (
          <div
            role="status"
            aria-live="polite"
            className="border border-eve-border rounded-sm p-3 text-sm text-eve-dim flex items-center gap-2"
          >
            <span className="inline-block w-3 h-3 border-2 border-eve-accent/40 border-t-eve-accent rounded-full animate-spin" />
            <span>
              {lastProgress || t("batchBuilderRouteSearchingProgress")}
            </span>
          </div>
        )}

        {routeError && routeState !== "idle" && routeState !== "searching" && (
          <div className="border border-red-500/40 rounded-sm p-2 text-xs text-red-300">
            {routeError}
          </div>
        )}
        {routeDiagnostics.length > 0 && (
          <div
            className="border border-amber-500/40 rounded-sm p-2 text-xs text-amber-200"
            data-testid="route-diagnostics"
          >
            {routeDiagnostics.map((entry, idx) => (
              <p key={`${idx}-${entry}`}>{entry}</p>
            ))}
          </div>
        )}

        {routeOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-eve-dim">
                {t("batchBuilderRouteOptionsTitle")}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-eve-dim flex items-center gap-2">
                  <span>Preset</span>
                  <select
                    aria-label="Execution scoring preset"
                    value={executionScoringPreset}
                    onChange={(e) =>
                      setExecutionScoringPreset(
                        e.target.value as ExecutionScoringPreset,
                      )
                    }
                    className="px-2 py-1 bg-eve-input border border-eve-border rounded-sm text-eve-text"
                  >
                    <option value="conservative">Conservative</option>
                    <option value="balanced">Balanced</option>
                    <option value="aggressive">Aggressive</option>
                    <option value="max_fill">Max Fill</option>
                  </select>
                </label>
                <label className="text-xs text-eve-dim flex items-center gap-2">
                  <span>Sort</span>
                  <select
                    value={routeSortBy}
                    onChange={(e) =>
                      setRouteSortBy(
                        e.target.value as
                          | "recommended"
                          | "execution_score"
                          | "isk_per_jump"
                          | "total_profit_isk",
                      )
                    }
                    className="px-2 py-1 bg-eve-input border border-eve-border rounded-sm text-eve-text"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="execution_score">Execution Score</option>
                    <option value="isk_per_jump">ISK / Jump</option>
                    <option value="total_profit_isk">Net Profit</option>
                  </select>
                </label>
              </div>
            </div>
            {strategyChoices.length > 1 && routeOptions.length >= 4 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStrategyFilter("all")}
                  className={`rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    strategyFilter === "all"
                      ? "border-blue-400/50 bg-blue-500/15 text-blue-200"
                      : "border-eve-border bg-eve-panel text-eve-dim"
                  }`}
                >
                  All
                </button>
                {strategyChoices.map((choice) => (
                  <button
                    type="button"
                    key={choice.id}
                    onClick={() => setStrategyFilter(choice.id)}
                    className={`rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      strategyFilter === choice.id
                        ? "border-blue-400/50 bg-blue-500/15 text-blue-200"
                        : "border-eve-border bg-eve-panel text-eve-dim"
                    }`}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              {visibleRouteOptions.map((option) => {
                const optionMerged = baseBatchManifest
                  ? buildMergedManifest(baseBatchManifest, option)
                  : null;
                const selected = option.option_id === selectedOptionId;
                const recommended = !!option.recommended;
                const buyStops = new Set(
                  option.lines.map((line) =>
                    line.buy_location_id > 0
                      ? `buy:loc:${line.buy_location_id}`
                      : `buy:sys:${line.buy_system_id}`,
                  ),
                );
                const sellStops = new Set(
                  option.lines.map((line) =>
                    line.sell_location_id > 0
                      ? `sell:loc:${line.sell_location_id}`
                      : `sell:sys:${line.sell_system_id}`,
                  ),
                );
                const stopCount = new Set([...buyStops, ...sellStops]).size;
                const avgFillConfidence =
                  option.lines.length > 0
                    ? option.lines.reduce(
                        (sum, line) => sum + Math.max(0, line.fill_confidence),
                        0,
                      ) / option.lines.length
                    : 0;
                const worstFillConfidence =
                  option.lines.length > 0
                    ? Math.min(
                        ...option.lines.map((line) =>
                          Math.max(0, line.fill_confidence),
                        ),
                      )
                    : 0;
                const complexity = classifyComplexity(stopCount);
                return (
                  <button
                    type="button"
                    key={option.option_id}
                    data-testid={`route-option-${option.option_id}`}
                    onClick={() => onSelectOption(option)}
                    className={`text-left rounded-sm border p-3 transition-colors ${
                      selected
                        ? "border-blue-400 bg-blue-500/10"
                        : "border-eve-border bg-eve-panel hover:border-blue-400/70"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-eve-text font-semibold">
                        {t("batchBuilderRouteSummary", {
                          buy: anchorRow.BuySystemName,
                          sell: anchorRow.SellSystemName,
                        })}
                      </span>
                      <span className="text-eve-dim">#{option.rank}</span>
                    </div>
                    {recommended && (
                      <div className="mt-1 inline-flex items-center rounded-sm border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                        Recommended
                      </div>
                    )}
                    {(option.strategy_label || option.strategy_id) && (
                      <div className="mt-1 inline-flex items-center rounded-sm border border-indigo-400/40 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-indigo-200">
                        {(option.strategy_label || option.strategy_id || "").replace(
                          /[-_]+/g,
                          " ",
                        )}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-blue-300">
                      Execution: {option.execution_score.toFixed(1)} |
                      Recommendation:{" "}
                      {(option.recommendation_score ?? 0).toFixed(1)}
                    </div>
                    {((option.reason_chips?.length ?? 0) > 0 ||
                      (option.warning_chips?.length ?? 0) > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(option.reason_chips ?? []).map((chip) => (
                          <span
                            key={`${option.option_id}-reason-${chip}`}
                            className="rounded-sm border border-blue-400/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-200"
                          >
                            {chip}
                          </span>
                        ))}
                        {(option.warning_chips ?? []).map((chip) => (
                          <span
                            key={`${option.option_id}-warning-${chip}`}
                            className="rounded-sm border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[11px] mt-2">
                      <div className="text-eve-dim">
                        {t("batchBuilderRouteAddedItems")}: {option.line_count}
                      </div>
                      <div className="text-eve-dim">
                        {t("batchBuilderRouteAddedVolume")}:{" "}
                        {option.added_volume_m3.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </div>
                      <div className="text-eve-dim">
                        {t("batchBuilderRouteAddedCapital")}:{" "}
                        {formatISK(option.total_buy_isk)}
                      </div>
                      <div className="text-green-400">
                        {t("batchBuilderRouteAddedProfit")}:{" "}
                        {formatISK(option.total_profit_isk)}
                      </div>
                      <div className="text-eve-text">
                        {t("batchBuilderRouteMergedVolume")}:{" "}
                        {optionMerged?.total_volume_m3.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 1 },
                        ) ?? "-"}
                      </div>
                      <div className="text-eve-text">
                        {t("batchBuilderRouteMergedCapital")}:{" "}
                        {optionMerged
                          ? formatISK(optionMerged.total_buy_isk)
                          : "-"}
                      </div>
                      <div className="text-eve-text">
                        {t("batchBuilderRouteMergedGross")}:{" "}
                        {optionMerged
                          ? formatISK(optionMerged.total_sell_isk)
                          : "-"}
                      </div>
                      <div className="text-green-300">
                        {t("batchBuilderRouteMergedProfit")}:{" "}
                        {optionMerged
                          ? formatISK(optionMerged.total_profit_isk)
                          : "-"}
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-eve-dim">
                      {t("batchBuilderRouteIskPerJump")}:{" "}
                      {formatISK(option.isk_per_jump)} |{" "}
                      {t("batchBuilderRouteJumpSegments")}: {option.total_jumps}
                    </div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-1 text-[11px]">
                      <div className="text-eve-dim">
                        {t("routeStopCountShort")}: {stopCount}
                      </div>
                      <div className="text-eve-dim">
                        {t("routeBuySellStopsShort")}: {buyStops.size}/{sellStops.size}
                      </div>
                      <div className="text-eve-dim">
                        {t("routeFillConfidenceShort")}:{" "}
                        {(worstFillConfidence * 100).toFixed(0)}% /{" "}
                        {(avgFillConfidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-eve-dim">
                        {t("batchBuilderRouteAddedCapital")}:{" "}
                        {formatISK(option.total_buy_isk)}
                      </div>
                      <div className="text-eve-dim">
                        {t("routeRemainingCargoShort")}:{" "}
                        {optionMerged?.remaining_capacity_m3.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        }) ?? "0"}{" "}
                        m³
                      </div>
                      <div>
                        <span
                          className={`px-1 py-0.5 rounded-sm border text-[10px] font-bold ${complexityBadgeClass(complexity)}`}
                        >
                          {complexity}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-eve-dim grid grid-cols-1 md:grid-cols-3 gap-1">
                      <div>
                        Core: {option.core_line_count} items /{" "}
                        {formatISK(option.core_profit_total_isk)}
                      </div>
                      <div>
                        Safe filler: {option.safe_filler_line_count} /{" "}
                        {formatISK(option.safe_filler_profit_isk)}
                      </div>
                      <div>
                        Stretch: {option.stretch_filler_line_count} /{" "}
                        {formatISK(option.stretch_filler_profit_isk)}
                      </div>
                    </div>
                    {!!option.score_breakdown?.length && (
                      <details className="mt-2 text-[11px] text-eve-dim">
                        <summary className="cursor-pointer">
                          Why this rank?
                        </summary>
                        <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-1">
                          {option.score_breakdown.map((factor) => (
                            <div
                              key={`${option.option_id}-${factor.key}`}
                              className="font-mono"
                            >
                              {factor.label}:{" "}
                              {factor.contribution >= 0 ? "+" : ""}
                              {factor.contribution.toFixed(3)} (w{" "}
                              {factor.weight.toFixed(2)} · n{" "}
                              {factor.normalized.toFixed(2)})
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedOption && (
              <div className="border border-eve-border rounded-sm p-3 bg-eve-panel/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-eve-text">
                    Fill Remaining Hull
                  </div>
                  <div className="text-xs text-eve-dim" data-testid="filler-remaining-m3">
                    Remaining m³:{" "}
                    {fillerRemainingM3.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-eve-dim">
                  Current selection: {effectiveSelectedSummary.line_count} lines ·
                  Core {effectiveSelectedSummary.core_line_count} · Safe{" "}
                  {effectiveSelectedSummary.safe_filler_line_count} · Stretch{" "}
                  {effectiveSelectedSummary.stretch_filler_line_count}
                </div>
                {fillerLoading ? (
                  <div className="mt-2 text-xs text-eve-dim">Loading filler suggestions…</div>
                ) : fillerSuggestions.length === 0 ? (
                  <div className="mt-2 text-xs text-eve-dim">No filler suggestions available.</div>
                ) : (
                  <div className="mt-2 max-h-52 overflow-auto border border-eve-border rounded-sm">
                    <table className="w-full text-[11px]">
                      <thead className="bg-eve-panel border-b border-eve-border text-eve-dim">
                        <tr>
                          <th className="text-left px-2 py-1">Pick</th>
                          <th className="text-left px-2 py-1">Item</th>
                          <th className="text-right px-2 py-1">m3</th>
                          <th className="text-right px-2 py-1">Profit</th>
                          <th className="text-right px-2 py-1">Capital</th>
                          <th className="text-right px-2 py-1">Fill</th>
                          <th className="text-right px-2 py-1">Stale</th>
                          <th className="text-right px-2 py-1">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fillerSuggestions.map((suggestion) => {
                          const rowKey = additionTupleKey({
                            type_id: suggestion.type_id,
                            buy_location_id: suggestion.buy_location_id,
                            buy_system_id: suggestion.buy_system_id,
                            sell_location_id: suggestion.sell_location_id,
                            sell_system_id: suggestion.sell_system_id,
                          });
                          return (
                            <tr key={rowKey} data-testid={`filler-row-${suggestion.type_id}`} className="border-b border-eve-border/40 last:border-b-0">
                              <td className="px-2 py-1">
                                <input
                                  type="checkbox"
                                  checked={!!selectedFillerKeys[rowKey]}
                                  onChange={(e) =>
                                    setSelectedFillerKeys((prev) => ({
                                      ...prev,
                                      [rowKey]: e.target.checked,
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-2 py-1 text-eve-text">{suggestion.type_name}</td>
                              <td className="px-2 py-1 text-right">{suggestion.volume_m3.toFixed(1)}</td>
                              <td className="px-2 py-1 text-right text-green-300">{formatISK(suggestion.added_profit_isk)}</td>
                              <td className="px-2 py-1 text-right">{formatISK(suggestion.added_capital_isk)}</td>
                              <td className="px-2 py-1 text-right">{(suggestion.fill_confidence * 100).toFixed(0)}%</td>
                              <td className="px-2 py-1 text-right">{(suggestion.stale_risk * 100).toFixed(0)}%</td>
                              <td className="px-2 py-1 text-right">{suggestion.suggested_role}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 rounded-sm border border-blue-400/60 text-blue-300 text-xs"
                    onClick={() => {
                      const selected = fillerSuggestions.filter((suggestion) => {
                        const key = additionTupleKey({
                          type_id: suggestion.type_id,
                          buy_location_id: suggestion.buy_location_id,
                          buy_system_id: suggestion.buy_system_id,
                          sell_location_id: suggestion.sell_location_id,
                          sell_system_id: suggestion.sell_system_id,
                        });
                        return !!selectedFillerKeys[key];
                      });
                      setAppliedFillerLines(selected.map(suggestionToAdditionLine));
                    }}
                  >
                    Add selected fillers
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-sm border border-emerald-400/60 text-emerald-300 text-xs"
                    onClick={() =>
                      setAppliedFillerLines(
                        fillerSuggestions
                          .filter((row) => row.suggested_role === "safe_filler")
                          .map(suggestionToAdditionLine),
                      )
                    }
                  >
                    Add all safe fillers
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-sm border border-eve-border text-eve-dim text-xs"
                    onClick={() => setAppliedFillerLines([])}
                  >
                    Keep current pack
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {batch.lines.length === 0 ? (
          <div className="border border-eve-border rounded-sm p-3 text-sm text-eve-dim">
            {t("batchBuilderNoCandidates")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">
                  {t("batchBuilderTotalVolume")}
                </div>
                <div className="text-eve-accent font-mono mt-0.5">
                  {batch.totalVolume.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}{" "}
                  m3
                </div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">
                  {t("batchBuilderTotalProfit")}
                </div>
                <div className="text-green-400 font-mono mt-0.5">
                  {formatISK(batch.totalProfit)}
                </div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">
                  {t("batchBuilderTotalCapital")}
                </div>
                <div className="text-eve-text font-mono mt-0.5">
                  {formatISK(batch.totalCapital)}
                </div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">
                  {t("batchBuilderCargoUsage")}
                </div>
                <div className="text-yellow-300 font-mono mt-0.5">
                  {batch.usedPercent != null
                    ? `${batch.usedPercent.toFixed(1)}%`
                    : t("batchBuilderCargoUnlimited")}
                </div>
                {batch.remainingM3 != null && (
                  <div className="text-[11px] text-eve-dim mt-0.5">
                    {t("batchBuilderCargoRemaining")}:{" "}
                    {batch.remainingM3.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{" "}
                    m3
                  </div>
                )}
              </div>
            </div>

            <div className="border border-eve-border rounded-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-eve-panel border-b border-eve-border text-eve-dim uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-2 py-1.5">
                      {t("batchBuilderColItem")}
                    </th>
                    <th className="text-right px-2 py-1.5">
                      {t("batchBuilderColQty")}
                    </th>
                    <th className="text-right px-2 py-1.5">
                      {t("batchBuilderColVolume")}
                    </th>
                    <th className="text-right px-2 py-1.5">
                      {t("batchBuilderColCapital")}
                    </th>
                    <th className="text-right px-2 py-1.5">
                      {t("batchBuilderColProfit")}
                    </th>
                    <th className="text-right px-2 py-1.5">
                      {t("batchBuilderColDensity")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batch.lines.map((line) => (
                    <tr
                      key={routeLineKey(line.row)}
                      className="border-b border-eve-border/50 last:border-b-0"
                    >
                      <td className="px-2 py-1.5 text-eve-text">
                        {line.row.TypeName}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-eve-text">
                        {line.units.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-eve-dim">
                        {line.volume.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-eve-dim">
                        {formatISK(line.capital)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-green-400">
                        {formatISK(line.profit)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-yellow-300">
                        {formatISK(line.iskPerM3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
