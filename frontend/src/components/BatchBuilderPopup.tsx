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
  formatBatchLinesToMultibuyLines,
  formatMergedBatchManifestText,
} from "@/lib/batchManifestFormat";
import type {
  BaseBatchManifest,
  BatchCreateRouteRequest,
  MergedBatchManifest,
  FlipResult,
  RouteAdditionOption,
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
  salesTaxPercent?: number;
  buyBrokerFeePercent?: number;
  sellBrokerFeePercent?: number;
}

type RouteState = "idle" | "searching" | "results" | "selected";

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
  salesTaxPercent = 0,
  buyBrokerFeePercent = 0,
  sellBrokerFeePercent = 0,
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

  const copyManifest = useCallback(async () => {
    if (!anchorRow || batch.lines.length === 0) return;
    const lines: string[] = [];
    const multibuyLines = formatBatchLinesToMultibuyLines(batch.lines);
    const buyJumps = Math.max(0, Math.floor(safeNumber(anchorRow.BuyJumps)));
    const sellJumps = Math.max(0, Math.floor(safeNumber(anchorRow.SellJumps)));
    const totalRouteJumps = buyJumps + sellJumps;
    const totalIskPerJump = totalRouteJumps > 0 ? batch.totalProfit / totalRouteJumps : 0;
    lines.push(t("batchBuilderManifestBuyStation", { station: anchorRow.BuyStation }));
    lines.push(t("batchBuilderManifestJumpsToBuyStation", { jumps: buyJumps }));
    lines.push(t("batchBuilderManifestSellStation", { station: anchorRow.SellStation }));
    lines.push(t("batchBuilderManifestJumpsBuyToSell", { jumps: sellJumps }));
    lines.push(
      `Cargo m3: ${
        cargoLimitM3 > 0 ? cargoLimitM3.toLocaleString() : t("batchBuilderCargoUnlimited")
      }`,
    );
    lines.push(t("batchBuilderManifestItems", { count: batch.lines.length }));
    lines.push(
      t("batchBuilderManifestTotalVolume", {
        volume: batch.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      }),
    );
    lines.push(
      t("batchBuilderManifestTotalCapital", {
        isk: Math.round(batch.totalCapital).toLocaleString(),
      }),
    );
    lines.push(
      t("batchBuilderManifestTotalGrossSell", {
        isk: Math.round(batch.totalGrossSell).toLocaleString(),
      }),
    );
    lines.push(
      t("batchBuilderManifestTotalProfit", {
        isk: Math.round(batch.totalProfit).toLocaleString(),
      }),
    );
    lines.push(
      t("batchBuilderManifestTotalIskPerJump", {
        isk: Math.round(totalIskPerJump).toLocaleString(),
      }),
    );
    lines.push("");
    for (const line of batch.lines) {
      const qty = line.units;
      const buyTotal = line.capital;
      const buyPer = line.capital / line.units;
      const sellTotal = line.grossSell;
      const sellPer = line.grossSell / line.units;
      const vol = line.volume;
      const profit = line.profit;
      lines.push(
        `${line.row.TypeName} | ${t("batchBuilderManifestItemQty", { qty: qty.toLocaleString() })} | ${t("batchBuilderManifestItemBuyTotal", { isk: Math.round(buyTotal).toLocaleString() })} | ${t("batchBuilderManifestItemBuyPer", { isk: Math.round(buyPer).toLocaleString() })} | ${t("batchBuilderManifestItemSellTotal", { isk: Math.round(sellTotal).toLocaleString() })} | ${t("batchBuilderManifestItemSellPer", { isk: Math.round(sellPer).toLocaleString() })} | ${t("batchBuilderManifestItemVol", { volume: vol.toLocaleString(undefined, { maximumFractionDigits: 1 }) })} | ${t("batchBuilderManifestItemProfit", { isk: Math.round(profit).toLocaleString() })}`,
      );
    }
    lines.push("");
    lines.push(...multibuyLines);
    await navigator.clipboard.writeText(lines.join("\n"));
    addToast(t("batchBuilderCopied"), "success", 2200);
  }, [anchorRow, batch, cargoLimitM3, t, addToast]);

  const copyMergedManifest = useCallback(async () => {
    if (!baseBatchManifest || !mergedManifest) return;
    const selectedOption = routeOptions.find((option) => option.option_id === selectedOptionId);
    if (!selectedOption) return;
    const corridor =
      anchorRow?.BuySystemName && anchorRow?.SellSystemName
        ? `${anchorRow.BuySystemName} -> ${anchorRow.SellSystemName}`
        : undefined;
    const manifest = formatMergedBatchManifestText({
      baseBatchManifest,
      selectedOption,
      metadataHeader: {
        corridor,
        jumps: selectedOption.total_jumps,
        iskPerJump: selectedOption.isk_per_jump,
      },
    });
    await navigator.clipboard.writeText(manifest);
    addToast(t("batchBuilderCopiedMerged"), "success", 2200);
  }, [baseBatchManifest, mergedManifest, addToast, t, anchorRow, routeOptions, selectedOptionId]);

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
      route_max_jumps: routeMaxJumps,
      sales_tax_percent: salesTaxPercent,
      buy_broker_fee_percent: buyBrokerFeePercent,
      sell_broker_fee_percent: sellBrokerFeePercent,
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

    try {
      const response = await batchCreateRoute(request, controller.signal);
      if (requestId !== activeRequestRef.current) {
        setRouteState("results");
        setRouteError(t("batchBuilderRouteStaleRequest"));
        return;
      }
      const options = response.ranked_options ?? [];
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
    salesTaxPercent,
    buyBrokerFeePercent,
    sellBrokerFeePercent,
    currentSystemId,
    currentLocationId,
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
