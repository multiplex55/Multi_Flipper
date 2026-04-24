import { useEffect, useMemo, useState } from "react";
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
import {
  clearPersistedRouteWorkspaceMode,
  loadPersistedRouteWorkspaceMode,
  persistRouteWorkspaceMode,
  resolveRouteWorkspaceMode,
  canUseModeInCurrentContext,
} from "@/lib/routeWorkspaceModeResolver";
import type { RouteWorkspaceIntent } from "@/lib/routeHandoff";
import { verificationProfiles } from "@/lib/verificationProfiles";
import type { VerificationRecommendation } from "@/lib/verificationProfiles";
import { normalizeVerificationRecommendation } from "@/lib/routeManifestVerification";
import { buildRouteFillPlannerSections, type RouteFillPlannerSuggestion } from "@/lib/routeFillPlanner";
import type { RouteWorkbenchMode } from "@/components/RouteWorkbenchPanel";

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
  handoffIntent?: RouteWorkspaceIntent | null;
  pendingRadiusManifest?: string;
  pendingSelectedLeg?: RouteHandoffLegContext | null;
  routeWorkspace?: RouteExecutionWorkspace;
  onOpenBatchBuilderForRoute?: (routeKey: string) => void;
  onValidateVerifyNow?: (input: { scope: "active_route" | "saved_pack" | "queue"; routeKey: string | null }) => void;
  onValidateProfileSwitch?: (input: { scope: "active_route" | "saved_pack" | "queue"; routeKey: string | null; profileId: string }) => void;
  onValidateRebuildFromLiveRows?: (input: { scope: "active_route" | "saved_pack" | "queue"; routeKey: string | null }) => void;
  onValidateOpenOffenders?: (input: { scope: "active_route" | "saved_pack" | "queue"; routeKey: string | null; offenderLines: string[] }) => void;
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
  handoffIntent = null,
  pendingRadiusManifest = "",
  pendingSelectedLeg = null,
  routeWorkspace,
  onOpenBatchBuilderForRoute,
  onValidateVerifyNow,
  onValidateProfileSwitch,
  onValidateRebuildFromLiveRows,
  onValidateOpenOffenders,
}: RadiusRouteWorkspaceProps) {
  const hasActiveRouteContext = Boolean(routeWorkspace?.activeRouteKey ?? activeRouteKey);
  const hasSavedPack = Boolean(routeWorkspace && routeWorkspace.savedRoutePacks.length > 0);
  const persistedMode = useMemo(() => loadPersistedRouteWorkspaceMode(), []);
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<RadiusRouteWorkspaceTab>(() =>
    resolveRouteWorkspaceMode({
      explicitIntent: handoffIntent,
      openedFromRadiusOrSavedRoute: workspaceSource === "radius" && hasActiveRouteContext,
      hasActiveRoute: hasActiveRouteContext,
      hasSelectedOrSavedPack: hasActiveRouteContext || hasSavedPack,
      persistedMode,
    }),
  );
  const activeTab = workspaceMode ?? uncontrolledActiveTab;
  const setActiveTab = (next: RadiusRouteWorkspaceTab) => {
    onWorkspaceModeChange?.(next);
    if (!workspaceMode) setUncontrolledActiveTab(next);
    if (next === "workbench" || next === "finder" || next === "validate") {
      routeWorkspace?.setMode(next);
    }
  };
  useEffect(() => {
    if (activeTab === "discover") return;
    if (canUseModeInCurrentContext(activeTab, hasActiveRouteContext)) return;
    setActiveTab("finder");
  }, [activeTab, hasActiveRouteContext]);

  useEffect(() => {
    if (activeTab === "discover") return;
    if (!canUseModeInCurrentContext(activeTab, hasActiveRouteContext)) {
      clearPersistedRouteWorkspaceMode();
      return;
    }
    persistRouteWorkspaceMode({
      mode: activeTab,
      hadActiveRouteAtPersistTime: hasActiveRouteContext,
    });
  }, [activeTab, hasActiveRouteContext]);

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
  const [validateScope, setValidateScope] = useState<"active_route" | "saved_pack" | "queue">("active_route");
  const [profileSelectionByRoute, setProfileSelectionByRoute] = useState<Record<string, string>>({});
  const [activeWorkbenchSection, setActiveWorkbenchSection] = useState<"summary" | "filler" | "verification" | "execution">("summary");
  const activeRouteRows = activePack ? routeRowsByKey.get(activePack.routeKey) ?? [] : [];
  const routeFillSections = useMemo(() => {
    if (!activePack || activeRouteRows.length === 0) {
      return {
        sameEndpointFiller: [],
        alongTheWayDetourFiller: [],
        backhaulReturnLegFiller: [],
      };
    }
    const loopsForRoute = (radiusScanSession?.loopOpportunities ?? []).filter((loop) => {
      const outboundRoute = routeGroupKey(loop.outbound.row);
      const returnRoute = routeGroupKey(loop.returnLeg.row);
      return outboundRoute === activePack.routeKey || returnRoute === activePack.routeKey;
    });
    return buildRouteFillPlannerSections({
      rows: activeRouteRows,
      pack: activePack,
      loops: loopsForRoute,
      cargoCapacityM3: params.cargo_capacity ?? 0,
      limitPerSection: 4,
    });
  }, [activePack, activeRouteRows, radiusScanSession?.loopOpportunities, params.cargo_capacity]);

  const savedPack = routeWorkspace?.selectedPack ?? routeWorkspace?.savedRoutePacks[0] ?? null;
  const queueRouteKey = routeQueueKeys[0] ?? null;
  const queuePack = queueRouteKey ? routeWorkspace?.getPackByRouteKey(queueRouteKey) ?? null : null;
  const validateTarget = validateScope === "active_route"
    ? { routeKey: effectiveActiveRouteKey ?? null, pack: activePack }
    : validateScope === "saved_pack"
      ? { routeKey: savedPack?.routeKey ?? null, pack: savedPack }
      : { routeKey: queueRouteKey, pack: queuePack };
  const verification = validateTarget.pack?.verificationSnapshot ?? null;
  const selectedProfileId = (validateTarget.routeKey && profileSelectionByRoute[validateTarget.routeKey])
    ?? (validateTarget.routeKey ? routeWorkspace?.getVerificationProfileId(validateTarget.routeKey) : undefined)
    ?? validateTarget.pack?.verificationProfileId
    ?? "standard";
  const recommendationLabelById: Record<VerificationRecommendation, string> = {
    proceed: "Proceed",
    proceed_reduced: "Proceed reduced",
    reprice_rebuild: "Reprice + rebuild",
    abort: "Abort",
  };

  const handleAddSuggestionToPack = (suggestion: RouteFillPlannerSuggestion) => {
    if (!activePack || !routeWorkspace) return;
    const lineKeySet = new Set(activePack.selectedLineKeys);
    for (const lineKey of suggestion.sourceLineKeys) {
      lineKeySet.add(lineKey);
    }
    routeWorkspace.upsertPack({
      ...activePack,
      selectedLineKeys: Array.from(lineKeySet).sort((a, b) => a.localeCompare(b)),
    });
  };

  const handleOpenSuggestionInBatchBuilder = (suggestion: RouteFillPlannerSuggestion) => {
    if (!activePack || !routeWorkspace) return;
    const lineKeySet = new Set([...activePack.selectedLineKeys, ...suggestion.sourceLineKeys]);
    const entryMode = suggestion.type === "loop_backhaul" ? "loop" : "filler";
    routeWorkspace.upsertPack({
      ...activePack,
      selectedLineKeys: Array.from(lineKeySet).sort((a, b) => a.localeCompare(b)),
      entryMode,
      launchIntent: "radius-fill-planner",
    });
    routeWorkspace?.openBatchBuilder(activePack.routeKey);
    onOpenBatchBuilderForRoute?.(activePack.routeKey);
  };

  useEffect(() => {
    if (activeTab !== "workbench") return;
    const preferred = pendingRouteContext?.preferredSection;
    if (preferred) {
      setActiveWorkbenchSection(preferred);
      return;
    }
    setActiveWorkbenchSection("summary");
  }, [activeTab, pendingRouteContext?.preferredSection, pendingRouteContext?.routeKey]);

  const workbenchModeBySection: Record<typeof activeWorkbenchSection, RouteWorkbenchMode> = {
    summary: "summary",
    filler: "filler",
    verification: "verification",
    execution: "execution",
  };

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
                  <>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {(["summary", "filler", "verification", "execution"] as const).map((section) => (
                        <button
                          key={section}
                          type="button"
                          onClick={() => setActiveWorkbenchSection(section)}
                          className={`rounded-sm border px-1.5 py-0.5 text-[11px] capitalize ${
                            activeWorkbenchSection === section
                              ? "border-eve-accent/60 text-eve-accent bg-eve-accent/10"
                              : "border-eve-border/60 text-eve-dim"
                          }`}
                        >
                          {section}
                        </button>
                      ))}
                    </div>
                    <RouteWorkbenchPanel
                    pack={activePack}
                    mode={workbenchModeBySection[activeWorkbenchSection]}
                    activeSection={activeWorkbenchSection}
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
                    routeFillSections={routeFillSections}
                    onAddFillSuggestionToPack={handleAddSuggestionToPack}
                    onOpenFillSuggestionInBatchBuilder={handleOpenSuggestionInBatchBuilder}
                    />
                  </>
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
                <div className="rounded-sm border border-eve-border/60 bg-eve-panel/40 p-2 text-eve-dim space-y-2" data-testid="validate-panel-container">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-eve-text">Validation scope</span>
                    <select
                      aria-label="Validation scope"
                      value={validateScope}
                      onChange={(event) => setValidateScope(event.target.value as "active_route" | "saved_pack" | "queue")}
                      className="rounded-sm border border-eve-border/60 bg-eve-dark px-1 py-0.5"
                    >
                      <option value="active_route">Active route</option>
                      <option value="saved_pack">Saved pack</option>
                      <option value="queue">Queue</option>
                    </select>
                    <span data-testid="validate-scope-route-key">{validateTarget.routeKey ?? "no route selected"}</span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="validate-metrics">
                    <div>Status: <span className="text-eve-text">{verification?.status ?? "Unverified"}</span></div>
                    <div>Age: <span className="text-eve-text">{typeof verification?.checkedAt === "string" ? `${Math.max(0, (Date.now() - new Date(verification.checkedAt).getTime()) / 60_000).toFixed(1)}m` : "n/a"}</span></div>
                    <div>Profit retained: <span className="text-eve-text">{verification?.profitRetentionPct?.toFixed(1) ?? "0.0"}%</span></div>
                    <div>Liquidity retained: <span className="text-eve-text">{verification ? Math.max(0, 100 - verification.sellDriftPct).toFixed(1) : "0.0"}%</span></div>
                    <div>Buy drift: <span className="text-eve-text">{verification?.buyDriftPct?.toFixed(1) ?? "0.0"}%</span></div>
                    <div>Sell drift: <span className="text-eve-text">{verification?.sellDriftPct?.toFixed(1) ?? "0.0"}%</span></div>
                    <div>Offender lines: <span className="text-eve-text">{verification?.offenderLines.length ?? 0}</span></div>
                    <div>Recommendation: <span className="text-eve-text">{recommendationLabelById[normalizeVerificationRecommendation({ recommendation: verification?.recommendation, status: verification?.status, summary: verification?.summary })]}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2" data-testid="validate-quick-actions">
                    <button
                      type="button"
                      className="rounded-sm border border-eve-border/60 px-1 py-0.5"
                      onClick={() => onValidateVerifyNow?.({ scope: validateScope, routeKey: validateTarget.routeKey })}
                    >
                      Verify now
                    </button>
                    <label className="inline-flex items-center gap-1">
                      <span>Profile</span>
                      <select
                        aria-label="Validate profile"
                        value={selectedProfileId}
                        className="rounded-sm border border-eve-border/60 bg-eve-dark px-1 py-0.5"
                        onChange={(event) => {
                          const next = event.target.value;
                          if (validateTarget.routeKey) {
                            setProfileSelectionByRoute((prev) => ({ ...prev, [validateTarget.routeKey!]: next }));
                          }
                          onValidateProfileSwitch?.({
                            scope: validateScope,
                            routeKey: validateTarget.routeKey,
                            profileId: next,
                          });
                        }}
                      >
                        {verificationProfiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>{profile.name}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="rounded-sm border border-eve-border/60 px-1 py-0.5"
                      onClick={() => onValidateRebuildFromLiveRows?.({ scope: validateScope, routeKey: validateTarget.routeKey })}
                    >
                      Rebuild from live rows
                    </button>
                    <button
                      type="button"
                      className="rounded-sm border border-eve-border/60 px-1 py-0.5"
                      onClick={() => {
                        const offenderLines = verification?.offenderLines ?? [];
                        if (validateTarget.routeKey) {
                          routeWorkspace?.selectPack(validateTarget.routeKey);
                        }
                        setActiveTab("workbench");
                        onValidateOpenOffenders?.({
                          scope: validateScope,
                          routeKey: validateTarget.routeKey,
                          offenderLines,
                        });
                      }}
                    >
                      Open offender lines
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
