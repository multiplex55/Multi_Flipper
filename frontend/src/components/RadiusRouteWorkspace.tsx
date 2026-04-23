import { useMemo, useState } from "react";
import { RouteBuilder } from "@/components/RouteBuilder";
import { EmptyState } from "@/components/EmptyState";
import { RouteWorkbenchPanel } from "@/components/RouteWorkbenchPanel";
import type {
  RouteHandoffContext,
  RouteHandoffLegContext,
} from "@/lib/routeHandoff";
import type { RadiusScanSession } from "@/lib/radiusScanSession";
import type { FlipResult, RouteResult, ScanParams, SavedRoutePack } from "@/lib/types";
import { formatISK } from "@/lib/format";
import type { RouteExecutionWorkspace } from "@/lib/useRouteExecutionWorkspace";
import { buildSavedRoutePack } from "@/lib/routePackBuilder";
import { routeGroupKey } from "@/lib/batchMetrics";

export type RadiusRouteWorkspaceTab = "discover" | "workbench" | "finder" | "validate";

type RadiusRouteWorkspaceProps = {
  params: ScanParams;
  onChange?: (params: ScanParams) => void;
  routeLoadedResults?: RouteResult[] | null;
  isLoggedIn?: boolean;
  radiusScanSession?: RadiusScanSession | null;
  loadingScanSession?: boolean;
  scanSessionError?: string | null;
  activeRouteKey?: string | null;
  workspaceMode?: RadiusRouteWorkspaceTab;
  onWorkspaceModeChange?: (mode: RadiusRouteWorkspaceTab) => void;
  workspaceSource?: "radius" | "finder";
  routeQueueKeys?: string[];
  pendingRouteContext?: RouteHandoffContext | null;
  pendingRadiusManifest?: string;
  pendingSelectedLeg?: RouteHandoffLegContext | null;
  routeWorkspace?: RouteExecutionWorkspace;
  onOpenBatchBuilderForRoute?: (routeKey: string) => void;
};

function EmptySessionState({
  loadingScanSession,
  scanSessionError,
}: {
  loadingScanSession?: boolean;
  scanSessionError?: string | null;
}) {
  if (loadingScanSession) {
    return <EmptyState reason="loading" />;
  }
  if (scanSessionError) {
    return (
      <div className="rounded-sm border border-eve-error/50 bg-eve-error/10 p-3 text-xs text-eve-error">
        Failed to load radius scan session: {scanSessionError}
      </div>
    );
  }
  return <EmptyState reason="no_scan_yet" />;
}

export function RadiusRouteWorkspace({
  params,
  onChange,
  routeLoadedResults,
  isLoggedIn = false,
  radiusScanSession,
  loadingScanSession = false,
  scanSessionError = null,
  activeRouteKey = null,
  workspaceMode,
  onWorkspaceModeChange,
  workspaceSource = "radius",
  routeQueueKeys = [],
  pendingRouteContext = null,
  pendingRadiusManifest = "",
  pendingSelectedLeg = null,
  routeWorkspace,
  onOpenBatchBuilderForRoute,
}: RadiusRouteWorkspaceProps) {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] =
    useState<RadiusRouteWorkspaceTab>("discover");
  const activeTab = workspaceMode ?? uncontrolledActiveTab;
  const setActiveTab = (next: RadiusRouteWorkspaceTab) => {
    onWorkspaceModeChange?.(next);
    if (!workspaceMode) setUncontrolledActiveTab(next);
    if (next === "workbench" || next === "finder" || next === "validate") {
      routeWorkspace?.setMode(next);
    }
  };

  const tabs: Array<{ id: RadiusRouteWorkspaceTab; label: string; hint: string }> = [
    { id: "discover", label: "Discover", hint: "Grouped routes, top picks, queue, loops" },
    { id: "workbench", label: "Workbench", hint: "Selected route, saved routes, execution state, filler options" },
    { id: "finder", label: "Finder", hint: "Route search flow" },
    { id: "validate", label: "Validate", hint: "Route and batch readiness checks" },
  ];
  const routeInsights = radiusScanSession?.routeInsightsSnapshot;

  const topRouteRows = useMemo(
    () =>
      routeInsights?.routeSummaries.slice(0, 8).map((route) => ({
        key: route.routeKey,
        label: route.routeLabel,
        dailyProfit: route.aggregate.dailyProfit,
        dailyIskPerJump: route.aggregate.dailyIskPerJump,
        confidence: route.badge.confidence.score,
      })) ?? [],
    [routeInsights],
  );
  const routeSummaryByKey = useMemo(
    () =>
      new Map(
        (routeInsights?.routeSummaries ?? []).map((summary) => [
          summary.routeKey,
          summary,
        ]),
      ),
    [routeInsights],
  );
  const effectiveActiveRouteKey = routeWorkspace?.activeRouteKey ?? activeRouteKey;
  const resolvedActiveRoute = effectiveActiveRouteKey
    ? routeSummaryByKey.get(effectiveActiveRouteKey) ?? null
    : null;
  const routeRowsByKey = useMemo(() => {
    const out = new Map<string, FlipResult[]>();
    for (const row of radiusScanSession?.results ?? []) {
      const key = routeGroupKey(row);
      const entries = out.get(key) ?? [];
      entries.push(row);
      out.set(key, entries);
    }
    return out;
  }, [radiusScanSession?.results]);
  const activePack: SavedRoutePack | null = useMemo(() => {
    const routeKey = routeWorkspace?.activeRouteKey ?? effectiveActiveRouteKey;
    if (!routeKey) return null;
    const savedPack = routeWorkspace?.getPackByRouteKey(routeKey) ?? null;
    if (savedPack) return savedPack;
    const rows = routeRowsByKey.get(routeKey);
    const anchor = rows?.[0];
    if (!rows || !anchor) return null;
    return buildSavedRoutePack({
      routeKey,
      routeLabel: resolvedActiveRoute?.routeLabel ?? routeKey,
      anchorRow: anchor,
      routeRows: rows,
      selectedRows: rows,
      entryMode: "core",
      launchIntent: "radius-workspace",
      summary: null,
      routeSafetyRank: null,
      verificationProfileId:
        routeWorkspace?.getVerificationProfileId(routeKey) ?? "standard",
    });
  }, [effectiveActiveRouteKey, resolvedActiveRoute?.routeLabel, routeRowsByKey, routeWorkspace]);
  const showMissingRouteNotice =
    !!effectiveActiveRouteKey && !resolvedActiveRoute && !!radiusScanSession?.hasScan;

  const renderSessionState = () => (
    <EmptySessionState
      loadingScanSession={loadingScanSession}
      scanSessionError={scanSessionError}
    />
  );

  return (
    <section className="flex-1 min-h-0 flex flex-col gap-2" aria-label="radius-route-workspace">
      <div className="shrink-0 rounded-sm border border-eve-border bg-eve-panel/50 p-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Route workspace sections">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1 rounded-sm border text-xs transition-colors ${
                  active
                    ? "border-eve-accent/60 text-eve-accent bg-eve-accent/10"
                    : "border-eve-border/60 text-eve-dim hover:text-eve-text"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="mt-1 text-[11px] text-eve-dim">{tabs.find((tab) => tab.id === activeTab)?.hint}</div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-sm border border-eve-border bg-eve-dark/30 p-3">
        {activeTab === "discover" && (
          <div data-testid="route-workspace-discover" className="space-y-3">
            {!radiusScanSession?.hasScan ? (
              renderSessionState()
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-sm border border-eve-border/60 bg-eve-panel/50 p-2">
                    <div className="text-eve-dim">Grouped routes</div>
                    <div className="text-eve-text font-semibold">{routeInsights?.routeSummaries.length ?? 0}</div>
                  </div>
                  <div className="rounded-sm border border-eve-border/60 bg-eve-panel/50 p-2">
                    <div className="text-eve-dim">Top picks</div>
                    <div className="text-eve-text font-semibold">{Object.values(routeInsights?.topRoutePicks ?? {}).filter(Boolean).length}</div>
                  </div>
                  <div className="rounded-sm border border-eve-border/60 bg-eve-panel/50 p-2">
                    <div className="text-eve-dim">Queue</div>
                    <div className="text-eve-text font-semibold">{routeInsights?.actionQueue.length ?? 0}</div>
                  </div>
                  <div className="rounded-sm border border-eve-border/60 bg-eve-panel/50 p-2">
                    <div className="text-eve-dim">Loops</div>
                    <div className="text-eve-text font-semibold">{radiusScanSession.loopOpportunities.length}</div>
                  </div>
                </div>
                {routeQueueKeys.length > 0 && (
                  <div className="rounded-sm border border-indigo-400/40 bg-indigo-500/5 p-2 text-xs">
                    <div className="text-indigo-200">Route queue ({routeQueueKeys.length})</div>
                    <div className="mt-1 text-eve-dim">
                      {routeQueueKeys.slice(0, 4).join(", ")}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <h3 className="text-xs uppercase tracking-wide text-eve-dim">Top grouped routes</h3>
                  {topRouteRows.length === 0 ? (
                    <div className="text-xs text-eve-dim">No route summaries in current session.</div>
                  ) : (
                    topRouteRows.map((route) => (
                      <div key={route.key} className="grid grid-cols-1 lg:grid-cols-4 gap-1 rounded-sm border border-eve-border/50 px-2 py-1 text-xs">
                        <div className="text-eve-text">{route.label}</div>
                        <div className="text-eve-dim">Daily {formatISK(route.dailyProfit)}</div>
                        <div className="text-eve-dim">ISK/jump {formatISK(route.dailyIskPerJump)}</div>
                        <div className="text-eve-dim">Confidence {route.confidence.toFixed(0)}</div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "workbench" && (
          <div data-testid="route-workspace-workbench" className="space-y-2 text-xs">
            {!radiusScanSession?.hasScan ? (
              renderSessionState()
            ) : (
              <>
                {activePack ? (
                  <RouteWorkbenchPanel
                    pack={activePack}
                    mode="summary"
                    activeSection="summary"
                    isPinned={Boolean(routeWorkspace?.getPackByRouteKey(activePack.routeKey))}
                    verificationProfileId={routeWorkspace?.getVerificationProfileId(activePack.routeKey) ?? "standard"}
                    onVerificationProfileChange={() => undefined}
                    onVerifyNow={() => routeWorkspace?.setMode("validate")}
                    onMarkBought={(lineKey, qty) => {
                      const line = activePack.lines[lineKey];
                      if (!line) return;
                      routeWorkspace?.markBought(activePack.routeKey, lineKey, qty, qty * line.plannedBuyPrice);
                    }}
                    onMarkSold={(lineKey, qty) => {
                      const line = activePack.lines[lineKey];
                      if (!line) return;
                      routeWorkspace?.markSold(activePack.routeKey, lineKey, qty, qty * line.plannedSellPrice);
                    }}
                    onMarkSkipped={(lineKey, reason) => routeWorkspace?.markSkipped(activePack.routeKey, lineKey, reason)}
                    onResetLine={(lineKey) => routeWorkspace?.resetExecution(activePack.routeKey, lineKey)}
                    onCopySummary={() => routeWorkspace?.copySummary(activePack.routeKey)}
                    onCopyManifest={() => routeWorkspace?.copyManifest(activePack.routeKey)}
                    onTogglePin={() => {
                      if (routeWorkspace?.getPackByRouteKey(activePack.routeKey)) {
                        routeWorkspace.removePack(activePack.routeKey);
                        return;
                      }
                      routeWorkspace?.upsertPack(activePack);
                    }}
                    onOpenBatchBuilder={() => {
                      routeWorkspace?.openBatchBuilder(activePack.routeKey);
                      onOpenBatchBuilderForRoute?.(activePack.routeKey);
                    }}
                    onScrollToTable={() => undefined}
                  />
                ) : (
                  <div className="text-eve-dim" data-testid="route-workspace-workbench-fallback">
                    {showMissingRouteNotice
                      ? "Selected route key is missing from the current scan map."
                      : "No active route selected."}
                  </div>
                )}
                <div className="text-eve-dim">Source: {workspaceSource}</div>
              </>
            )}
          </div>
        )}

        {activeTab === "finder" && (
          <div data-testid="route-workspace-finder" className="h-full min-h-0">
            <RouteBuilder
              params={params}
              onChange={onChange}
              loadedResults={routeLoadedResults}
              isLoggedIn={isLoggedIn}
              pendingRouteContext={pendingRouteContext}
              pendingRadiusManifest={pendingRadiusManifest}
              pendingSelectedLeg={pendingSelectedLeg}
            />
          </div>
        )}

        {activeTab === "validate" && (
          <div data-testid="route-workspace-validate" className="space-y-2 text-xs">
            {!radiusScanSession?.hasScan ? (
              renderSessionState()
            ) : (
              <>
                <div className="rounded-sm border border-eve-border/60 bg-eve-panel/40 p-2 text-eve-dim">
                  Route checks: {(routeInsights?.routeSummaries.length ?? 0) > 0 ? "ready" : "no route groups"}
                </div>
                <div className="rounded-sm border border-eve-border/60 bg-eve-panel/40 p-2 text-eve-dim">
                  Batch checks: {(routeInsights?.actionQueue.length ?? 0) > 0 ? "queue available" : "empty queue"}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
