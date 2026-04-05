import { useEffect, useMemo, useState } from "react";
import { formatISK } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import {
  buildOrderedRouteManifestFromRouteResult,
  formatOrderedRouteManifestText,
} from "@/lib/batchManifestFormat";
import type { RouteResult } from "@/lib/types";
import {
  evaluateRoutePlanValidation,
  type ValidationBand,
} from "@/lib/routePlanValidation";
import { Modal } from "./Modal";
import { useGlobalToast } from "./Toast";

export type RoutePlannerAction =
  | "expand_route"
  | "build_cargo_plan"
  | "validate_route_prices";

export interface RoutePlannerActiveFilters {
  minHops: number;
  maxHops: number;
  targetSystemName: string;
  minISKPerJump: number;
  allowEmptyHops: boolean;
}

export interface RoutePlannerExecutionSettings {
  cargoCapacityM3: number;
  feeModel: {
    splitTradeFees: boolean;
    salesTaxPercent: number;
    brokerFeePercent: number;
    buyBrokerFeePercent: number;
    sellBrokerFeePercent: number;
  };
  riskConstraints: {
    minRouteSecurity: number;
    maxDetourJumpsPerNode: number;
    allowLowsec: boolean;
    allowNullsec: boolean;
    allowWormhole: boolean;
  };
  validationThresholds: {
    maxBuyDriftPct: number;
    maxSellDriftPct: number;
    minProfitRetainedPct: number;
    minLiquidityRetainedPct: number;
  };
}

export interface RoutePlannerSelection {
  route: RouteResult;
  activeFilters: RoutePlannerActiveFilters;
  executionSettings: RoutePlannerExecutionSettings;
}

interface RouteExecutionPlannerProps {
  open: boolean;
  onClose: () => void;
  selection: RoutePlannerSelection | null;
  initialAction: RoutePlannerAction | null;
}

const OPTION_CONFIG: Array<{
  id: RoutePlannerAction;
  title: string;
  description: string;
}> = [
  {
    id: "expand_route",
    title: "Expand Route",
    description: "Show complete station-by-station manifest and systems path.",
  },
  {
    id: "build_cargo_plan",
    title: "Build Cargo Plan",
    description:
      "Generate a cargo execution manifest with filters and fee settings.",
  },
  {
    id: "validate_route_prices",
    title: "Validate Route Prices",
    description:
      "Render a validation band and prep manifest payload for pricing checks.",
  },
];

export function RouteExecutionPlanner({
  open,
  onClose,
  selection,
  initialAction,
}: RouteExecutionPlannerProps) {
  const { t } = useI18n();
  const { addToast } = useGlobalToast();
  const [selectedAction, setSelectedAction] =
    useState<RoutePlannerAction | null>(null);
  const [plannerStep, setPlannerStep] = useState<"options" | "manifest">(
    "options",
  );
  const [validationRequested, setValidationRequested] = useState(false);
  const [validationRunAt, setValidationRunAt] = useState<number>(Date.now());

  useEffect(() => {
    if (!open || !selection) return;
    if (initialAction) {
      setSelectedAction(initialAction);
      setPlannerStep("manifest");
      setValidationRequested(initialAction === "validate_route_prices");
      return;
    }
    setSelectedAction(null);
    setPlannerStep("options");
    setValidationRequested(false);
    setValidationRunAt(Date.now());
  }, [open, selection?.route, initialAction]);

  const validation = useMemo(() => {
    if (!selection) return null;
    return evaluateRoutePlanValidation({
      route: selection.route,
      nowMs: validationRunAt,
      thresholds: {
        max_buy_drift_pct:
          selection.executionSettings.validationThresholds.maxBuyDriftPct,
        max_sell_drift_pct:
          selection.executionSettings.validationThresholds.maxSellDriftPct,
        min_route_profit_retained_pct:
          selection.executionSettings.validationThresholds.minProfitRetainedPct,
        min_stop_liquidity_retained_pct:
          selection.executionSettings.validationThresholds
            .minLiquidityRetainedPct,
      },
    });
  }, [selection, validationRunAt]);

  const bandClass = (band: ValidationBand): string => {
    if (band === "green")
      return "border-green-400/70 bg-green-500/10 text-green-200";
    if (band === "yellow")
      return "border-yellow-400/70 bg-yellow-500/10 text-yellow-100";
    return "border-red-400/70 bg-red-500/10 text-red-100";
  };

  const manifestText = useMemo(() => {
    if (!selection || !selectedAction) return "";
    const manifest = buildOrderedRouteManifestFromRouteResult(selection.route);
    const baseText = formatOrderedRouteManifestText({ manifest, t });
    const lines = [
      baseText,
      "",
      "--- Route Planner Context ---",
      `Action: ${selectedAction}`,
      `Cargo m3: ${selection.executionSettings.cargoCapacityM3}`,
      `Route filters: hops ${selection.activeFilters.minHops}-${selection.activeFilters.maxHops}, min ISK/jump ${selection.activeFilters.minISKPerJump}`,
      `Risk: min security ${selection.executionSettings.riskConstraints.minRouteSecurity.toFixed(2)}, detour <= ${selection.executionSettings.riskConstraints.maxDetourJumpsPerNode}`,
    ];
    return lines.join("\n");
  }, [selection, selectedAction, t]);

  const onSelectAction = (action: RoutePlannerAction) => {
    setSelectedAction(action);
    setPlannerStep("manifest");
    setValidationRequested(action === "validate_route_prices");
  };

  const copyManifest = async () => {
    if (!manifestText) return;
    try {
      await navigator.clipboard.writeText(manifestText);
      addToast(t("copied"), "success", 1400);
    } catch {
      addToast(t("errorSomethingWentWrong"), "error", 2200);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Route Execution Planner"
      width="max-w-5xl"
    >
      <div className="p-4 space-y-3" data-testid="route-execution-planner">
        {!selection ? (
          <div className="text-sm text-eve-dim">No route selected.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">Route hops</div>
                <div className="text-eve-text font-mono">
                  {selection.route.HopCount}
                </div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">Profit</div>
                <div className="text-green-400 font-mono">
                  {formatISK(selection.route.TotalProfit)}
                </div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">ISK / jump</div>
                <div className="text-yellow-300 font-mono">
                  {formatISK(selection.route.ProfitPerJump)}
                </div>
              </div>
            </div>

            <div className="text-xs text-eve-dim">Select a planner option:</div>
            <div className="grid grid-cols-1 gap-2">
              {OPTION_CONFIG.map((option) => {
                const active = option.id === selectedAction;
                return (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`route-planner-option-${option.id}`}
                    className={`text-left rounded-sm border p-3 transition-colors ${
                      active
                        ? "border-blue-400 bg-blue-500/10"
                        : "border-eve-border bg-eve-panel hover:border-blue-400/70"
                    }`}
                    onClick={() => onSelectAction(option.id)}
                  >
                    <div className="text-xs font-semibold text-eve-text">
                      {option.title}
                    </div>
                    <div className="text-[11px] text-eve-dim mt-1">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {plannerStep === "manifest" && selectedAction && (
              <div className="space-y-2" data-testid="route-planner-manifest">
                {validationRequested && (
                  <>
                    <div
                      className={`border rounded-sm p-2 text-xs ${bandClass(validation?.band ?? "yellow")}`}
                      data-testid="route-validation-band"
                    >
                      Validation {validation?.band ?? "yellow"} — pre-undock{" "}
                      {validation?.checkpoints[0]?.band ?? "yellow"}, pre-sale{" "}
                      {validation?.checkpoints[1]?.band ?? "yellow"}.
                    </div>
                    {validation?.snapshot_stale ? (
                      <div
                        className="border border-amber-400/60 bg-amber-500/10 rounded-sm p-2 text-xs text-amber-100"
                        data-testid="route-stale-warning"
                      >
                        Snapshot is stale. Refresh/rescan before undocking.
                      </div>
                    ) : null}
                    {(validation?.stops ?? []).some(
                      (stop) => stop.band !== "green",
                    ) ? (
                      <div
                        className="border border-yellow-400/60 bg-yellow-500/10 rounded-sm p-2 text-xs text-yellow-100"
                        data-testid="route-degraded-warning"
                      >
                        One or more stops are degraded. Review stop cards before
                        executing.
                      </div>
                    ) : null}
                    <div
                      className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]"
                      data-testid="route-validation-summary"
                    >
                      <div className="border border-eve-border rounded-sm p-2">
                        Buy drift: {validation?.total_buy_drift_pct.toFixed(1)}%
                      </div>
                      <div className="border border-eve-border rounded-sm p-2">
                        Sell drift:{" "}
                        {validation?.total_sell_drift_pct.toFixed(1)}%
                      </div>
                      <div className="border border-eve-border rounded-sm p-2">
                        Profit retained:{" "}
                        {validation?.route_profit_retained_pct.toFixed(1)}%
                      </div>
                      <div className="border border-eve-border rounded-sm p-2">
                        Min stop liquidity:{" "}
                        {validation?.min_stop_liquidity_retained_pct.toFixed(1)}
                        %
                      </div>
                    </div>
                    <div
                      className="space-y-2"
                      data-testid="route-validation-stops"
                    >
                      {(validation?.stops ?? []).map((stop) => (
                        <div
                          key={stop.stop_key}
                          data-testid={`route-stop-card-${stop.stop_key}`}
                          className={`border rounded-sm p-2 text-[11px] ${bandClass(stop.band)}`}
                        >
                          <div className="font-semibold">
                            Stop {stop.stop_key} · {stop.band}
                          </div>
                          <div>
                            Buy ceiling: {formatISK(stop.buy_ceiling_isk)} |
                            Sell floor: {formatISK(stop.sell_floor_isk)}
                          </div>
                          <div>
                            Buy drift: {stop.buy_drift_pct.toFixed(1)}% | Sell
                            drift: {stop.sell_drift_pct.toFixed(1)}%
                          </div>
                          <div>
                            Profit retained:{" "}
                            {stop.retained_profit_pct.toFixed(1)}% | Liquidity
                            retained: {stop.liquidity_retained_pct.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-sm border border-yellow-400/70 text-yellow-200 hover:bg-yellow-500/10 transition-colors text-xs font-semibold uppercase tracking-wider mr-2"
                    onClick={() => setValidationRunAt(Date.now())}
                    data-testid="route-validation-rerun"
                  >
                    Re-run Validation
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-sm border border-eve-accent/70 text-eve-accent hover:bg-eve-accent/10 transition-colors text-xs font-semibold uppercase tracking-wider"
                    onClick={() => {
                      void copyManifest();
                    }}
                  >
                    Copy Planner Manifest
                  </button>
                </div>
                <pre className="border border-eve-border rounded-sm bg-eve-dark/60 p-3 text-[11px] whitespace-pre-wrap text-eve-text">
                  {manifestText}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
