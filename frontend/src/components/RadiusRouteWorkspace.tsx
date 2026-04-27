import { useEffect, useMemo, useState } from "react";
import { RouteBuilder } from "@/components/RouteBuilder";
import { EmptyState } from "@/components/EmptyState";
import { RouteWorkbenchPanel } from "@/components/RouteWorkbenchPanel";
import type {
  RouteHandoffContext,
  RouteHandoffLegContext,
} from "@/lib/routeHandoff";
import type { RadiusScanSession } from "@/lib/radiusScanSession";
import type { AuthCharacter, FlipResult, RouteResult, ScanParams, SavedRoutePack } from "@/lib/types";
import { formatISK } from "@/lib/format";
import type { RouteExecutionWorkspace } from "@/lib/useRouteExecutionWorkspace";
import { buildSavedRoutePack } from "@/lib/routePackBuilder";
import { routeGroupKey, routeLineKey, safeNumber } from "@/lib/batchMetrics";
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
import { computeRouteVerificationDiff, normalizeVerificationRecommendation } from "@/lib/routeManifestVerification";
import { buildRouteFillPlannerSections, type RouteFillPlannerSuggestion } from "@/lib/routeFillPlanner";
import { removeOffendersAndRefill } from "@/lib/routeVerificationRefill";
import { classifyVerificationPriority, verificationPriorityChipClass } from "@/lib/radiusVerificationPriority";
import type { RouteWorkbenchMode } from "@/components/RouteWorkbenchPanel";
import { RouteQueuePanel } from "@/components/RouteQueuePanel";
import { getNextQueuedRoute, type RouteQueueEntry } from "@/lib/routeQueue";
import type { RouteAssignment } from "@/lib/routeAssignments";
import { RadiusRouteGroupsPanel } from "@/components/RadiusRouteGroupsPanel";
import type { RouteExecutionFilterState } from "@/components/RadiusRouteGroupsPanel";
import { RadiusRouteComparePanel } from "@/components/RadiusRouteComparePanel";
import type { RadiusRouteCompareRow } from "@/components/RadiusRouteCompareDrawer";
import { getRadiusRouteExecutionBadge } from "@/lib/radiusRouteStatus";

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
  routeQueue?: RouteQueueEntry[];
  onRouteQueueChange?: (entries: RouteQueueEntry[]) => void;
  routeAssignmentsByKey?: Record<string, RouteAssignment>;
  onQueueRoute?: (routeKey: string, routeLabel: string) => void;
  onAssignActivePilot?: (routeKey: string, characterId: number) => void;
  onAssignBestPilot?: (routeKey: string, characterId: number) => void;
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
  characters?: AuthCharacter[];
  characterLocations?: Record<number, string>;
  onRecalculateLensFromCharacter?: (characterId: number) => void;
  workbenchOffenderLineFilter?: string[];
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
  routeQueue = [],
  onRouteQueueChange,
  routeAssignmentsByKey = {},
  onQueueRoute,
  onAssignActivePilot,
  onAssignBestPilot,
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
  characters = [],
  characterLocations = {},
  onRecalculateLensFromCharacter,
  workbenchOffenderLineFilter = [],
}: RadiusRouteWorkspaceProps) {
  const hasActiveRouteContext = Boolean(routeWorkspace?.activeRouteKey ?? activeRouteKey);
  const hasSavedPack = Boolean(routeWorkspace && routeWorkspace.savedRoutePacks.length > 0);
  const persistedMode = useMemo(() => loadPersistedRouteWorkspaceMode(), []);
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<RadiusRouteWorkspaceTab>(() => {
    if (radiusScanSession?.hasScan) return "discover";
    return resolveRouteWorkspaceMode({
      explicitIntent: handoffIntent,
      openedFromRadiusOrSavedRoute: workspaceSource === "radius" && hasActiveRouteContext,
      hasActiveRoute: hasActiveRouteContext,
      hasSelectedOrSavedPack: hasActiveRouteContext || hasSavedPack,
      persistedMode,
    });
  });
  const activeTab = workspaceMode ?? uncontrolledActiveTab;
  const setActiveTab = (next: RadiusRouteWorkspaceTab) => {
    onWorkspaceModeChange?.(next);
    if (!workspaceMode) setUncontrolledActiveTab(next);
    if (next === "workbench" || next === "finder" || next === "validate") {
      routeWorkspace?.setMode(next);
    }
  };
  useEffect(() => {
    if (!workspaceMode && radiusScanSession?.hasScan && uncontrolledActiveTab === "finder") {
      setUncontrolledActiveTab("discover");
    }
  }, [radiusScanSession?.hasScan, uncontrolledActiveTab, workspaceMode]);

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
    { id: "discover", label: "Grouped Routes", hint: "Grouped routes, top picks, queue, loops" },
    { id: "workbench", label: "Workbench", hint: "Selected route, saved routes, execution state, filler options" },
    { id: "finder", label: "Route Finder", hint: "Route search flow" },
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
  const [compareRouteKeys, setCompareRouteKeys] = useState<string[]>([]);
  const [routeExecutionFilters, setRouteExecutionFilters] = useState<RouteExecutionFilterState>({
    hideQueued: false,
    unassignedOnly: false,
    needsVerify: false,
    executableNow: false,
    activePilotOnly: false,
    staleVerifyOnly: false,
  });
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
  const queueRouteKey = getNextQueuedRoute(routeQueue)?.routeKey ?? null;
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
  const verificationAgeMinutes = typeof verification?.checkedAt === "string"
    ? Math.max(0, (Date.now() - new Date(verification.checkedAt).getTime()) / 60_000)
    : 0;
  const selectedRowsForTarget = validateTarget.pack
    ? (routeRowsByKey.get(validateTarget.pack.routeKey) ?? []).filter((row) => validateTarget.pack?.selectedLineKeys.includes(routeLineKey(row)))
    : [];
  const dominantUrgencyBand = selectedRowsForTarget.some((row) => row.urgency_band === "fragile")
    ? "fragile"
    : selectedRowsForTarget.some((row) => row.urgency_band === "aging")
      ? "aging"
      : "stable";
  const priority = classifyVerificationPriority({
    expectedProfitIsk: Math.max(verification?.currentProfitIsk ?? 0, validateTarget.pack?.summarySnapshot.routeTotalProfit ?? 0),
    totalJumps: selectedRowsForTarget.reduce((max, row) => Math.max(max, safeNumber(row.TotalJumps)), 0),
    stopCount: validateTarget.pack?.summarySnapshot.routeItemCount ?? 0,
    urgencyBand: dominantUrgencyBand,
    scanAgeMinutes: verificationAgeMinutes,
    lensJumpDelta: selectedRowsForTarget.reduce((max, row) => {
      const base = safeNumber(row.DistanceLensBaseTotalJumps);
      if (!(base > 0)) return max;
      return Math.max(max, safeNumber(row.TotalJumps) - base);
    }, 0),
  });
  const verificationDiff = validateTarget.pack
    ? computeRouteVerificationDiff({
      before: {
        profitabilityIsk: validateTarget.pack.summarySnapshot.routeTotalProfit,
        capitalIsk: validateTarget.pack.summarySnapshot.routeTotalCapital,
        volumeM3: selectedRowsForTarget.reduce((sum, row) => sum + Math.max(0, safeNumber(row.Volume) * safeNumber(row.UnitsToBuy)), 0),
        selectedLineKeys: validateTarget.pack.selectedLineKeys,
      },
      after: {
        profitabilityIsk: verification?.currentProfitIsk ?? validateTarget.pack.summarySnapshot.routeTotalProfit,
        capitalIsk: validateTarget.pack.summarySnapshot.routeTotalCapital,
        volumeM3: selectedRowsForTarget.reduce((sum, row) => sum + Math.max(0, safeNumber(row.Volume) * safeNumber(row.UnitsToBuy)), 0),
        selectedLineKeys: validateTarget.pack.selectedLineKeys,
        offenderLineKeys: verification?.offenderLines ?? [],
        offenderReasonsByLine: verification
          ? Object.fromEntries((verification.offenderLines ?? []).map((key) => [key, ["verification offender"]]))
          : {},
      },
    })
    : null;

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

  const openBatchBuilderForRoute = (routeKey: string) => {
    if (routeWorkspace) {
      routeWorkspace.openBatchBuilder(routeKey);
      return;
    }
    onOpenBatchBuilderForRoute?.(routeKey);
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
    openBatchBuilderForRoute(activePack.routeKey);
  };

  const handleKeepBatch = () => {
    if (!validateTarget.pack) return;
    routeWorkspace?.selectPack(validateTarget.pack.routeKey);
    openBatchBuilderForRoute(validateTarget.pack.routeKey);
    setActiveTab("workbench");
  };

  const handleRemoveBadRows = () => {
    if (!validateTarget.pack || !routeWorkspace) return;
    const offenderSet = new Set(verification?.offenderLines ?? []);
    if (offenderSet.size === 0) return;
    const selectedLineKeys = validateTarget.pack.selectedLineKeys.filter((key) => !offenderSet.has(key));
    routeWorkspace.upsertPack({
      ...validateTarget.pack,
      selectedLineKeys,
      updatedAt: new Date().toISOString(),
      launchIntent: "radius-validate-remove-bad-rows",
    });
  };

  const handleRefillCargo = () => {
    if (!validateTarget.pack || !routeWorkspace) return;
    const routeRows = routeRowsByKey.get(validateTarget.pack.routeKey) ?? [];
    const refill = removeOffendersAndRefill({
      rows: routeRows,
      selectedLineKeys: validateTarget.pack.selectedLineKeys,
      offenderLineKeys: verification?.offenderLines ?? [],
      cargoCapacityM3: params.cargo_capacity ?? 0,
      maxCapitalIsk: params.max_investment,
      minConfidencePercent: 50,
      minExecutionQuality: 50,
      maxNewLines: 4,
    });
    buildRouteFillPlannerSections({
      rows: routeRows,
      pack: { ...validateTarget.pack, selectedLineKeys: refill.selectedLineKeys },
      loops: (radiusScanSession?.loopOpportunities ?? []).filter((loop) => routeGroupKey(loop.outbound.row) === validateTarget.pack?.routeKey || routeGroupKey(loop.returnLeg.row) === validateTarget.pack?.routeKey),
      cargoCapacityM3: params.cargo_capacity ?? 0,
      limitPerSection: 4,
    });
    routeWorkspace.upsertPack({
      ...validateTarget.pack,
      selectedLineKeys: refill.selectedLineKeys,
      updatedAt: new Date().toISOString(),
      launchIntent: "radius-validate-remove-refill",
    });
    openBatchBuilderForRoute(validateTarget.pack.routeKey);
    setActiveTab("workbench");
  };

  const handleSkipRoute = () => {
    if (!validateTarget.pack || !routeWorkspace) return;
    routeWorkspace.removePack(validateTarget.pack.routeKey);
  };
  const compareRows = useMemo<RadiusRouteCompareRow[]>(
    () =>
      compareRouteKeys.map((routeKey) => {
        const route = routeInsights?.routeSummaries.find((entry) => entry.routeKey === routeKey) ?? null;
        const routeRows = routeRowsByKey.get(routeKey) ?? [];
        const jumps = routeRows.reduce((max, row) => Math.max(max, safeNumber(row.TotalJumps)), 0);
        const totalVolume = routeRows.reduce((sum, row) => sum + Math.max(0, safeNumber(row.Volume) * safeNumber(row.UnitsToBuy)), 0);
        const queueStatus = getRadiusRouteExecutionBadge(routeKey, routeQueue, routeAssignmentsByKey);
        return {
          routeKey,
          routeLabel: route?.routeLabel ?? routeKey,
          profit: route?.aggregate.routeTotalProfit ?? 0,
          capital: route?.aggregate.routeTotalCapital ?? 0,
          roi: route?.aggregate.dailyProfitOverCapital ?? null,
          cargoUsedPercent: params.cargo_capacity ? (totalVolume / params.cargo_capacity) * 100 : null,
          jumps,
          iskPerJump: route?.aggregate.fastestIskPerJump ?? 0,
          executionQuality: route?.aggregate.weakestExecutionQuality ?? 0,
          verification: route?.verificationStatus ?? "unknown",
          queueStatus: queueStatus.status,
          assignedPilot: routeAssignmentsByKey[routeKey]?.assignedCharacterName ?? "",
        };
      }),
    [compareRouteKeys, params.cargo_capacity, routeAssignmentsByKey, routeInsights?.routeSummaries, routeQueue, routeRowsByKey],
  );

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
                <RouteQueuePanel
                  entries={routeQueue}
                  onChange={(entries) => onRouteQueueChange?.(entries)}
                  onOpenWorkbench={(routeKey) => {
                    routeWorkspace?.openRoute(routeKey, "workbench");
                    setActiveTab("workbench");
                  }}
                  onOpenBatchBuilder={(routeKey) => {
                    openBatchBuilderForRoute(routeKey);
                  }}
                />
                <RadiusRouteGroupsPanel
                  results={radiusScanSession.results}
                  routeInsightsSnapshot={radiusScanSession.routeInsightsSnapshot}
                  routeWorkspace={routeWorkspace}
                  routeQueueEntries={routeQueue}
                  routeAssignmentsByKey={routeAssignmentsByKey}
                  cargoCapacityM3={params.cargo_capacity ?? 0}
                  characters={characters}
                  characterLocations={characterLocations}
                  routeExecutionFilters={routeExecutionFilters}
                  onRouteExecutionFiltersChange={setRouteExecutionFilters}
                  onQueueRoute={onQueueRoute}
                  onValidateRoute={(routeKey) => {
                    routeWorkspace?.openRoute(routeKey, "validate");
                    setActiveTab("validate");
                  }}
                  onAssignActivePilot={onAssignActivePilot}
                  onAssignBestPilot={onAssignBestPilot}
                  onCompareRoute={(routeKey) =>
                    setCompareRouteKeys((prev) => (prev.includes(routeKey) ? prev : [...prev, routeKey].slice(0, 4)))
                  }
                  onOpenBatchBuilderForRoute={onOpenBatchBuilderForRoute}
                />
                <RadiusRouteComparePanel
                  rows={compareRows}
                  onRemove={(routeKey) =>
                    setCompareRouteKeys((prev) => prev.filter((entry) => entry !== routeKey))
                  }
                  onClear={() => setCompareRouteKeys([])}
                />
                {topRouteRows.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-xs uppercase tracking-wide text-eve-dim">Top grouped routes</h3>
                    {topRouteRows.map((route) => (
                      <div key={route.key} className="grid grid-cols-1 lg:grid-cols-4 gap-1 rounded-sm border border-eve-border/50 px-2 py-1 text-xs">
                        <div className="text-eve-text">{route.label}</div>
                        <div className="text-eve-dim">Daily {formatISK(route.dailyProfit)}</div>
                        <div className="text-eve-dim">ISK/jump {formatISK(route.dailyIskPerJump)}</div>
                        <div className="text-eve-dim">Confidence {route.confidence.toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                )}
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
                      openBatchBuilderForRoute(activePack.routeKey);
                    }}
                    onScrollToTable={() => undefined}
                    routeFillSections={routeFillSections}
                    onAddFillSuggestionToPack={handleAddSuggestionToPack}
                    onOpenFillSuggestionInBatchBuilder={handleOpenSuggestionInBatchBuilder}
                    characters={characters}
                    characterLocations={characterLocations}
                    onRecalculateLensFromCharacter={onRecalculateLensFromCharacter}
                    lineFilterKeys={workbenchOffenderLineFilter}
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
                    <div>
                      Verification priority:{" "}
                      <span className={`rounded-sm border px-1 py-0.5 text-[10px] ${verificationPriorityChipClass(priority.priority)}`} title={priority.reason}>
                        {priority.label}
                      </span>
                    </div>
                  </div>
                  {verificationDiff && (
                    <div className="rounded-sm border border-eve-border/50 bg-eve-dark/40 p-2 space-y-1" data-testid="validate-diff-block">
                      <div className="text-eve-text">Before/after verification diff</div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-1 text-[11px]">
                        <div>Profit: {formatISK(verificationDiff.before.profitabilityIsk)} → {formatISK(verificationDiff.after.profitabilityIsk)}</div>
                        <div>Capital: {formatISK(verificationDiff.before.capitalIsk)} → {formatISK(verificationDiff.after.capitalIsk)}</div>
                        <div>Volume: {verificationDiff.before.volumeM3.toFixed(1)} → {verificationDiff.after.volumeM3.toFixed(1)} m³</div>
                        <div>Retained lines: {verificationDiff.retainedLinePct.toFixed(1)}%</div>
                        <div>Removed: {verificationDiff.removedLineKeys.length}</div>
                        <div>Degraded: {verificationDiff.degradedLineKeys.length}</div>
                      </div>
                      <div className="text-eve-dim">
                        Changed lines: -{verificationDiff.removedLineKeys.join(", ") || "none"} · !{verificationDiff.degradedLineKeys.join(", ") || "none"}
                      </div>
                    </div>
                  )}
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
                    <button type="button" className="rounded-sm border border-emerald-500/50 px-1 py-0.5 text-emerald-200" onClick={handleKeepBatch}>
                      Keep Batch
                    </button>
                    <button type="button" className="rounded-sm border border-amber-500/50 px-1 py-0.5 text-amber-200" onClick={handleRemoveBadRows}>
                      Remove Bad Rows
                    </button>
                    <button type="button" className="rounded-sm border border-indigo-500/50 px-1 py-0.5 text-indigo-200" onClick={handleRefillCargo}>
                      Refill Cargo
                    </button>
                    <button type="button" className="rounded-sm border border-rose-500/50 px-1 py-0.5 text-rose-200" onClick={handleSkipRoute}>
                      Skip Route
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
