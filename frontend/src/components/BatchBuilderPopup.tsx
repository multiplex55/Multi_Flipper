import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { batchCreateRoute } from "@/lib/api";
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
} from "@/lib/batchManifestFormat";
import type {
  BaseBatchManifest,
  BatchCreateRouteRequest,
  MergedBatchManifest,
  FlipResult,
  OrderedRouteManifest,
  RouteAdditionOption,
  StationCacheMeta,
} from "@/lib/types";
import { Modal } from "./Modal";
import { useGlobalToast } from "./Toast";

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
}

type RouteState = "idle" | "searching" | "results" | "selected";

function normalizeStationName(name: string | null | undefined): string {
  return (name ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function formatStationFallback(line: { buy_location_id: number }, resolvedStationName?: string): string {
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
  const baseUnits = baseBatch.base_lines.reduce((sum, line) => sum + line.units, 0);
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
    utilization_pct: baseBatch.cargo_limit_m3 > 0 ? (totalVolume / baseBatch.cargo_limit_m3) * 100 : 0,
    total_buy_isk: baseBatch.total_buy_isk + option.total_buy_isk,
    total_sell_isk: baseBatch.total_sell_isk + option.total_sell_isk,
    total_profit_isk: baseBatch.total_profit_isk + option.total_profit_isk,
  };
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
}: BatchBuilderPopupProps) {
  const { t } = useI18n();
  const { addToast } = useGlobalToast();
  const [cargoLimitM3, setCargoLimitM3] = useState<number>(
    defaultCargoM3 > 0 ? defaultCargoM3 : 0,
  );
  const [routeState, setRouteState] = useState<RouteState>("idle");
  const [routeOptions, setRouteOptions] = useState<RouteAdditionOption[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [mergedManifest, setMergedManifest] = useState<MergedBatchManifest | null>(null);
  const [lastProgress, setLastProgress] = useState<string>("");
  const [routeDiagnostics, setRouteDiagnostics] = useState<string[]>([]);
  const activeRequestRef = useRef(0);
  const activeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setCargoLimitM3(defaultCargoM3 > 0 ? defaultCargoM3 : 0);
    setRouteState("idle");
    setRouteOptions([]);
    setRouteError(null);
    setSelectedOptionId(null);
    setMergedManifest(null);
    setLastProgress("");
    setRouteDiagnostics([]);
  }, [open, defaultCargoM3]);

  const batch = useMemo(() => {
    if (!anchorRow) {
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
    return buildBatch(anchorRow, rows, cargoLimitM3);
  }, [anchorRow, rows, cargoLimitM3]);

  const baseBatchManifest = useMemo<BaseBatchManifest | null>(() => {
    if (!anchorRow || batch.lines.length === 0 || cargoLimitM3 <= 0) return null;

    const resolvedOriginSystemId = originSystemId ?? anchorRow.BuySystemID;
    const resolvedOriginSystemName = originSystemName?.trim() || anchorRow.BuySystemName;
    const resolvedOriginLocationId = originLocationId ?? anchorRow.BuyLocationID ?? 0;
    const resolvedOriginLocationName = originLocationName?.trim() || anchorRow.BuyStation;
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
      base_buy_system_id: anchorRow.BuySystemID,
      base_buy_location_id: anchorRow.BuyLocationID ?? 0,
      base_sell_system_id: anchorRow.SellSystemID,
      base_sell_location_id: anchorRow.SellLocationID ?? 0,
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
    anchorRow,
    batch,
    cargoLimitM3,
    originSystemId,
    originSystemName,
    originLocationId,
    originLocationName,
  ]);

  const createRouteError = useMemo(() => {
    if (!anchorRow) return null;
    if (!baseBatchManifest) return t("batchBuilderRouteMissingOrigin");
    if (baseBatchManifest.remaining_capacity_m3 <= 0) return t("batchBuilderRouteNoRemainingCargo");
    return null;
  }, [anchorRow, baseBatchManifest, t]);

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
    const selectedOption = routeOptions.find((option) => option.option_id === selectedOptionId);
    if (!selectedOption) return;
    const routeRows = rows.filter((row) => row.TypeID > 0);
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
      if (sellLocationId > 0 && hasStationName(row.SellStation) && !locationNameMetaById.has(sellLocationId)) {
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
      })),
      ...selectedOption.lines.map((line) => ({ ...line, source: "addition" as const })),
    ];

    const findRowForLine = (line: CombinedLine): FlipResult | undefined => {
      const exact = routeRows.find((row) => {
        if (row.TypeID !== line.type_id) return false;
        const rowBuyLocationId = safeNumber(row.BuyLocationID);
        const rowSellLocationId = safeNumber(row.SellLocationID);
        if (line.buy_location_id > 0 && rowBuyLocationId !== line.buy_location_id) return false;
        if (line.sell_location_id > 0 && rowSellLocationId !== line.sell_location_id) return false;
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
        return { stationName: matchedRow.BuyStation.trim(), usedIdFallback: false };
      }

      const buyLocationId = safeNumber(line.buy_location_id);
      if (buyLocationId > 0) {
        const rowMappedName = buyLocationNameById.get(buyLocationId);
        if (hasStationName(rowMappedName)) {
          return { stationName: rowMappedName, usedIdFallback: false };
        }

        if (
          buyLocationId === safeNumber(baseBatchManifest.base_buy_location_id) &&
          hasStationName(anchorRow?.BuyStation)
        ) {
          return { stationName: anchorRow.BuyStation.trim(), usedIdFallback: false };
        }
        if (
          buyLocationId === safeNumber(baseBatchManifest.origin_location_id) &&
          hasStationName(baseBatchManifest.origin_location_name)
        ) {
          return { stationName: baseBatchManifest.origin_location_name.trim(), usedIdFallback: false };
        }
        if (
          buyLocationId === safeNumber(baseBatchManifest.base_sell_location_id) &&
          hasStationName(anchorRow?.SellStation)
        ) {
          return { stationName: anchorRow.SellStation.trim(), usedIdFallback: false };
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
    const stations = new Map<string, OrderedRouteManifest["stations"][number]>();
    const stationSystemByKey = new Map<string, number>();
    for (const line of combinedLines) {
      const matchedRow = findRowForLine(line);
      const matchedSellRow =
        matchedRow ??
        routeRows.find((row) => safeNumber(row.SellLocationID) === line.sell_location_id);
      const { stationName, usedIdFallback } = resolveBuyStationName(line, matchedRow);
      if (usedIdFallback && line.buy_location_id > 0) {
        fallbackToIdStationIds.add(line.buy_location_id);
      }
      const primaryKey = line.buy_location_id > 0 ? `id:${line.buy_location_id}` : "";
      const fallbackKey = normalizeStationName(stationName);
      const stationKey = primaryKey || `name:${fallbackKey}`;
      if (!stations.has(stationKey)) {
        stationOrder.push(stationKey);
        stationSystemByKey.set(stationKey, line.buy_system_id);
        const jumpsToBuy = toKnownJumpCount(matchedRow?.BuyJumps);
        const jumpsBuyToSell = toKnownJumpCount(matchedRow?.SellJumps ?? matchedSellRow?.SellJumps);
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
      console.warn("[BatchBuilderPopup] copyMergedManifest used station ID fallback labels", {
        station_ids: ids,
      });
    }

    const orderedStations = stationOrder
      .map((key) => stations.get(key))
      .filter((station): station is OrderedRouteManifest["stations"][number] => station != null);
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
        item_count: mergedManifest.total_line_count,
        total_units: mergedManifest.total_units,
        total_volume_m3: mergedManifest.total_volume_m3,
        total_buy_isk: mergedManifest.total_buy_isk,
        total_sell_isk: mergedManifest.total_sell_isk,
        total_profit_isk: mergedManifest.total_profit_isk,
        total_jumps: selectedOption.total_jumps,
        isk_per_jump:
          selectedOption.total_jumps > 0 && Number.isFinite(selectedOption.isk_per_jump)
            ? selectedOption.isk_per_jump
            : undefined,
      },
      stations: orderedStations,
    };

    const routeManifestText = formatOrderedRouteManifestText({
      originLabel: `${baseBatchManifest.origin_system_name} (${baseBatchManifest.origin_location_name})`,
      metadataHeader: undefined,
      manifest: orderedManifest,
    });
    const baseManifestItems = combinedLines.map((line) => {
      const units = Math.max(0, Math.floor(safeNumber(line.units)));
      const volume = safeNumber(line.unit_volume_m3) * units;
      const buyTotal = safeNumber(line.buy_total_isk);
      const sellTotal = safeNumber(line.sell_total_isk);
      return formatDetailedManifestItemLine(
        {
          typeName: line.type_name,
          qty: units,
          buyTotal,
          buyPer: units > 0 ? buyTotal / units : 0,
          sellTotal,
          sellPer: units > 0 ? sellTotal / units : 0,
          volume,
          profit: safeNumber(line.profit_total_isk),
        },
        t,
      );
    });
    const manifestParts = [routeManifestText];
    if (baseManifestItems.length > 0) {
      manifestParts.push("", t("batchBuilderMergedManifestBaseItemsHeader"), ...baseManifestItems);
    }
    await navigator.clipboard.writeText(manifestParts.join("\n"));
    addToast(t("batchBuilderCopiedMerged"), "success", 2200);
  }, [baseBatchManifest, mergedManifest, addToast, t, routeOptions, selectedOptionId, rows, anchorRow]);

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
    const normalizedRouteMaxJumps = Math.max(0, Math.floor(safeNumber(routeMaxJumps)));
    const normalizedMaxDetourJumpsPerNode = Number.isFinite(maxDetourJumpsPerNode)
      ? Math.max(0, Math.floor(safeNumber(maxDetourJumpsPerNode)))
      : undefined;

    const request: BatchCreateRouteRequest = {
      origin_system_id: baseBatchManifest.origin_system_id,
      origin_system_name: baseBatchManifest.origin_system_name,
      origin_location_id: baseBatchManifest.origin_location_id,
      origin_location_name: baseBatchManifest.origin_location_name,
      current_system_id: currentSystemId ?? baseBatchManifest.origin_system_id,
      current_location_id: currentLocationId ?? baseBatchManifest.origin_location_id,
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
        scanSourceTab === "radius"
          ? rows
              .filter(
                (row) => row.TypeID > 0 && (row.BuyLocationID ?? 0) > 0 && (row.SellLocationID ?? 0) > 0,
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
          : undefined,
      deterministic_sort: {
        primary: "isk_per_jump",
        secondary: "total_profit_isk",
        tie_break_order: ["utilization_pct", "type_id"],
      },
    };

    setRouteState("searching");
    setRouteError(null);
    setRouteOptions([]);
    setSelectedOptionId(null);
    setMergedManifest(null);
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
      if (diagnostics.some((entry) => /fallback|stale|market-only|unavailable/i.test(entry))) {
        addToast(diagnostics[0], "warning", 3500);
      }
      setRouteOptions(options);
      if (options.length === 0) {
        setRouteState("results");
        setRouteError(t("batchBuilderRouteNoOptions"));
        return;
      }
      setSelectedOptionId(null);
      setMergedManifest(null);
      setRouteState("results");
      setLastProgress(t("batchBuilderRouteSearchComplete", { count: options.length }));
    } catch (error) {
      const isAbort = controller.signal.aborted;
      setRouteState("results");
      setRouteError(
        isAbort ? t("batchBuilderRouteStaleRequest") : t("batchBuilderRouteRequestFailed"),
      );
      if (!isAbort) {
        const msg = error instanceof Error ? error.message : String(error);
        addToast(`${t("batchBuilderRouteRequestFailed")}: ${msg}`, "error", 3000);
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
    rows,
    t,
    addToast,
  ]);

  const onSelectOption = useCallback(
    (option: RouteAdditionOption) => {
      if (!baseBatchManifest) return;
      setSelectedOptionId(option.option_id);
      setMergedManifest(buildMergedManifest(baseBatchManifest, option));
      setRouteState("selected");
    },
    [baseBatchManifest],
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
                setCargoLimitM3(Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0))
              }
              className="w-36 px-2 py-1 bg-eve-input border border-eve-border rounded-sm text-eve-text font-mono text-sm"
            />
            <span className="text-[10px] text-eve-dim/80">{t("batchBuilderCargoHint")}</span>
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
            disabled={routeState === "searching" || !!createRouteError || batch.lines.length === 0}
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
            <span>{lastProgress || t("batchBuilderRouteSearchingProgress")}</span>
          </div>
        )}

        {routeError && routeState !== "idle" && routeState !== "searching" && (
          <div className="border border-red-500/40 rounded-sm p-2 text-xs text-red-300">{routeError}</div>
        )}
        {routeDiagnostics.length > 0 && (
          <div className="border border-amber-500/40 rounded-sm p-2 text-xs text-amber-200" data-testid="route-diagnostics">
            {routeDiagnostics.map((entry, idx) => (
              <p key={`${idx}-${entry}`}>{entry}</p>
            ))}
          </div>
        )}

        {routeOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs text-eve-dim">{t("batchBuilderRouteOptionsTitle")}</div>
            <div className="grid grid-cols-1 gap-2">
              {routeOptions.map((option) => {
                const optionMerged = baseBatchManifest ? buildMergedManifest(baseBatchManifest, option) : null;
                const selected = option.option_id === selectedOptionId;
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[11px] mt-2">
                      <div className="text-eve-dim">{t("batchBuilderRouteAddedItems")}: {option.line_count}</div>
                      <div className="text-eve-dim">
                        {t("batchBuilderRouteAddedVolume")}: {option.added_volume_m3.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </div>
                      <div className="text-eve-dim">{t("batchBuilderRouteAddedCapital")}: {formatISK(option.total_buy_isk)}</div>
                      <div className="text-green-400">{t("batchBuilderRouteAddedProfit")}: {formatISK(option.total_profit_isk)}</div>
                      <div className="text-eve-text">{t("batchBuilderRouteMergedVolume")}: {optionMerged?.total_volume_m3.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "-"}</div>
                      <div className="text-eve-text">{t("batchBuilderRouteMergedCapital")}: {optionMerged ? formatISK(optionMerged.total_buy_isk) : "-"}</div>
                      <div className="text-eve-text">{t("batchBuilderRouteMergedGross")}: {optionMerged ? formatISK(optionMerged.total_sell_isk) : "-"}</div>
                      <div className="text-green-300">{t("batchBuilderRouteMergedProfit")}: {optionMerged ? formatISK(optionMerged.total_profit_isk) : "-"}</div>
                    </div>
                    <div className="mt-2 text-[11px] text-eve-dim">
                      {t("batchBuilderRouteIskPerJump")}: {formatISK(option.isk_per_jump)} | {t("batchBuilderRouteJumpSegments")}: {option.total_jumps}
                    </div>
                  </button>
                );
              })}
            </div>
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
                <div className="text-eve-dim">{t("batchBuilderTotalVolume")}</div>
                <div className="text-eve-accent font-mono mt-0.5">
                  {batch.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} m3
                </div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">{t("batchBuilderTotalProfit")}</div>
                <div className="text-green-400 font-mono mt-0.5">{formatISK(batch.totalProfit)}</div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">{t("batchBuilderTotalCapital")}</div>
                <div className="text-eve-text font-mono mt-0.5">{formatISK(batch.totalCapital)}</div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">{t("batchBuilderCargoUsage")}</div>
                <div className="text-yellow-300 font-mono mt-0.5">
                  {batch.usedPercent != null
                    ? `${batch.usedPercent.toFixed(1)}%`
                    : t("batchBuilderCargoUnlimited")}
                </div>
                {batch.remainingM3 != null && (
                  <div className="text-[11px] text-eve-dim mt-0.5">
                    {t("batchBuilderCargoRemaining")}: {" "}
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
                    <th className="text-left px-2 py-1.5">{t("batchBuilderColItem")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColQty")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColVolume")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColCapital")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColProfit")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColDensity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.lines.map((line) => (
                    <tr
                      key={routeLineKey(line.row)}
                      className="border-b border-eve-border/50 last:border-b-0"
                    >
                      <td className="px-2 py-1.5 text-eve-text">{line.row.TypeName}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-eve-text">
                        {line.units.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-eve-dim">
                        {line.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })}
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
