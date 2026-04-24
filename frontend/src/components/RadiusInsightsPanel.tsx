import { useMemo, useState } from "react";
import { formatISK } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { ActionQueueItem, TopRoutePicks } from "@/lib/radiusMetrics";
import type { LoopOpportunity } from "@/lib/loopPlanner";
import type { RadiusHubSummary } from "@/lib/radiusHubSummaries";
import type { RadiusMajorHubMetrics } from "@/lib/radiusMajorHubInsights";
import type { HubScopeMode } from "@/lib/radiusHubScope";
import { LoopOpportunitiesPanel } from "./LoopOpportunitiesPanel";
import { ExplanationPopoverShell } from "@/components/decision/ExplanationPopoverShell";
import type { RouteDecisionExplanation } from "@/lib/routeExplanation";

const INSIGHTS_VISIBLE_STORAGE_KEY = "eve-radius-insights-visible:v1";
const INSIGHTS_TAB_STORAGE_KEY = "eve-radius-insights-tab:v1";
const INSIGHTS_SECTION_STORAGE_KEY = "eve-radius-insights-sections:v1";

type InsightsTab = "picks" | "queue" | "loops" | "hubs";

type RadiusInsightsPanelProps = {
  topRoutePicks: TopRoutePicks;
  actionQueue: ActionQueueItem[];
  suppressionSummary?: string;
  loopOpportunities?: LoopOpportunity[];
  openRouteWorkbench: (
    routeKey: string,
    mode?: "summary" | "execution" | "filler" | "verification",
    launchContext?: {
      intentLabel?: string;
      batchEntryMode?: "core" | "filler" | "loop";
    },
  ) => void;
  onOpenInRoute?: (routeKey: string) => void;
  onOpenInRouteWorkbench?: (routeKey: string) => void;
  onOpenBatchBuilderForRoute?: (routeKey: string) => void;
  onOpenRouteFromInsights?: (
    routeKey: string,
    targetMode?: "discover" | "workbench",
  ) => void;
  onSendToRouteQueue?: (routeKey: string) => void;
  activeRouteGroupKey?: string | null;
  routeWorkbenchMode?: "summary" | "execution" | "filler" | "verification";
  activeRouteLabel?: string | null;
  defaultExpanded?: boolean;
  compactDashboard?: boolean;
  compactTeaser?: boolean;
  onToggleCompactDashboard?: () => void;
  buyHubs?: RadiusHubSummary[];
  sellHubs?: RadiusHubSummary[];
  onOpenHubRows?: (hub: RadiusHubSummary, side: "buy" | "sell") => void;
  onSetHubLock?: (hub: RadiusHubSummary, side: "buy" | "sell") => void;
  majorHubInsights?: RadiusMajorHubMetrics[];
  hubScopeMode?: HubScopeMode;
  onHubScopeModeChange?: (mode: HubScopeMode) => void;
  routeExplanationByKey?: Record<string, RouteDecisionExplanation>
  lensDeltaByRouteKey?: Record<string, string>
};

function majorHubActionSummary(
  systemId: number,
  systemName: string,
  rowCount: number,
): RadiusHubSummary {
  return {
    location_id: systemId,
    station_name: systemName,
    system_id: systemId,
    system_name: systemName,
    row_count: rowCount,
    item_count: 0,
    units: 0,
    capital_required: 0,
    period_profit: 0,
    avg_jumps: 0,
  };
}

function actionLabel(action: ActionQueueItem["action"]): string {
  switch (action) {
    case "buy_now":
      return "Buy now";
    case "filler":
      return "Filler";
    case "tracked":
      return "Tracked";
    case "loop_outbound":
      return "Loop outbound";
    case "loop_return":
      return "Loop return";
    case "avoid_hub_race":
      return "Avoid hub race";
    default:
      return action;
  }
}

function loadVisibleState(defaultExpanded: boolean): boolean {
  try {
    const saved = localStorage.getItem(INSIGHTS_VISIBLE_STORAGE_KEY);
    if (saved == null) return defaultExpanded;
    return saved === "1";
  } catch {
    return defaultExpanded;
  }
}

function loadTabState(): InsightsTab {
  try {
    const saved = localStorage.getItem(INSIGHTS_TAB_STORAGE_KEY);
    return saved === "queue" || saved === "loops" || saved === "picks" || saved === "hubs"
      ? saved
      : "picks";
  } catch {
    return "picks";
  }
}

export function RadiusInsightsPanel({
  topRoutePicks,
  actionQueue,
  suppressionSummary,
  loopOpportunities = [],
  openRouteWorkbench,
  onOpenInRoute,
  onOpenInRouteWorkbench,
  onOpenBatchBuilderForRoute,
  onOpenRouteFromInsights,
  onSendToRouteQueue,
  activeRouteGroupKey = null,
  routeWorkbenchMode = "summary",
  activeRouteLabel = null,
  defaultExpanded = false,
  compactDashboard = false,
  compactTeaser = false,
  onToggleCompactDashboard,
  buyHubs = [],
  sellHubs = [],
  onOpenHubRows,
  onSetHubLock,
  majorHubInsights = [],
  hubScopeMode = "visible",
  onHubScopeModeChange,
  routeExplanationByKey = {},
  lensDeltaByRouteKey = {},
}: RadiusInsightsPanelProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<boolean>(() =>
    loadVisibleState(defaultExpanded),
  );
  const [activeTab, setActiveTab] = useState<InsightsTab>(() => loadTabState());
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(INSIGHTS_SECTION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { topBuy: true, topSell: true, major: true };
    } catch {
      return { topBuy: true, topSell: true, major: true };
    }
  });
  const [showAllQueueItems, setShowAllQueueItems] = useState(false);
  const [hubActivityExpanded, setHubActivityExpanded] = useState(false);
  const [majorHubsExpanded, setMajorHubsExpanded] = useState(false);

  const picks = useMemo(
    () =>
      [
        [
          "bestRecommendedRoutePack",
          topRoutePicks.bestRecommendedRoutePack,
          "Primary",
          "core",
        ],
        ["bestQuickSingleRoute", topRoutePicks.bestQuickSingleRoute, "Fast", "core"],
        [
          "bestSafeFillerRoute",
          topRoutePicks.bestSafeFillerRoute,
          "Safe filler",
          "filler",
        ],
      ] as const,
    [topRoutePicks],
  );

  const pickCount = picks.filter(([, pick]) => !!pick).length;

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(INSIGHTS_VISIBLE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const setSection = (key: string) => {
    setSectionExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(INSIGHTS_SECTION_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setTab = (tab: InsightsTab) => {
    setActiveTab(tab);
    if (tab !== "queue") setShowAllQueueItems(false);
    try {
      localStorage.setItem(INSIGHTS_TAB_STORAGE_KEY, tab);
    } catch {
      // ignore storage errors
    }
  };

  const renderHubRows = (hubs: RadiusHubSummary[], side: "buy" | "sell") => (
    <div className="space-y-1">
      {hubs.length === 0 ? (
        <div className="text-[10px] text-eve-dim">No rows yet.</div>
      ) : (
        hubs.slice(0, 5).map((hub) => (
          <div key={`${side}-${hub.location_id}`} className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-2 py-1">
            <div className="text-[11px] text-eve-text truncate">{hub.station_name}</div>
            <div className="text-[10px] text-eve-dim truncate">{hub.system_name} · items {hub.item_count} · {formatISK(hub.period_profit)}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <button type="button" onClick={() => onOpenHubRows?.(hub, side)} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-[10px] text-eve-dim hover:text-eve-text">Open rows</button>
              <button type="button" onClick={() => onSetHubLock?.(hub, side)} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-[10px] text-eve-dim hover:text-eve-text">Set lock</button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (compactTeaser) {
    const openCompactRoute = (
      routeKey: string,
      targetMode: "discover" | "workbench" = "workbench",
    ) => {
      if (!routeKey) return;
      if (onOpenRouteFromInsights) {
        onOpenRouteFromInsights(routeKey, targetMode);
        return;
      }
      if (targetMode === "workbench") {
        if (onOpenInRouteWorkbench) {
          onOpenInRouteWorkbench(routeKey);
          return;
        }
        if (onOpenInRoute) {
          onOpenInRoute(routeKey);
          return;
        }
        openRouteWorkbench(routeKey, "summary");
        return;
      }
      if (onOpenInRoute) {
        onOpenInRoute(routeKey);
        return;
      }
      if (onOpenInRouteWorkbench) {
        onOpenInRouteWorkbench(routeKey);
        return;
      }
      openRouteWorkbench(routeKey, "summary");
    };

    return (
      <div className={`shrink-0 px-2 ${compactDashboard ? "pb-1" : "pb-2"}`}>
        <section className={`border border-eve-border rounded-sm bg-eve-dark/40 ${compactDashboard ? "p-1.5" : "p-2"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] uppercase tracking-wider text-eve-dim">Radius route insights</h3>
            <button
              type="button"
              onClick={() =>
                openCompactRoute(
                  topRoutePicks.bestRecommendedRoutePack?.routeKey ?? "",
                  "workbench",
                )
              }
              disabled={!topRoutePicks.bestRecommendedRoutePack}
              className="px-2 py-0.5 rounded-sm border border-eve-accent/60 text-[11px] text-eve-accent hover:bg-eve-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Open Route Workspace
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
            {picks
              .filter(([, pick]) => !!pick)
              .slice(0, 3)
              .map(([titleKey, pick]) => (
                <div
                  key={titleKey}
                  className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-2 py-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-eve-dim">{t(titleKey)}</span>
                    <span className="truncate text-eve-text">{pick?.routeLabel}</span>
                  </div>
                  {pick && (
                    <button
                      type="button"
                      onClick={() => onOpenBatchBuilderForRoute?.(pick.routeKey)}
                      className="mt-1 rounded-sm border border-eve-border/70 px-1.5 py-0.5 text-[10px] text-eve-accent hover:border-eve-accent/60 hover:bg-eve-accent/10"
                    >
                      Open in Build Batch
                    </button>
                  )}
                </div>
              ))}
            <div className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-2 py-1 text-eve-dim">
              Route queue: <span className="text-eve-text">{actionQueue.length}</span>
            </div>
            <div className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-2 py-1 text-eve-dim">
              Loop candidates: <span className="text-eve-text">{loopOpportunities.length}</span>
            </div>

            <section className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-2 py-1">
              <button
                type="button"
                className="flex w-full items-center justify-between text-[11px] text-eve-accent"
                aria-expanded={hubActivityExpanded}
                onClick={() => setHubActivityExpanded((prev) => !prev)}
              >
                <span>Hub Activity</span>
                <span aria-hidden="true">{hubActivityExpanded ? "▾" : "▸"}</span>
              </button>
              {hubActivityExpanded ? (
                <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-eve-dim">
                      Top Buy Hubs
                    </div>
                    {renderHubRows(buyHubs, "buy")}
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-eve-dim">
                      Top Sell Hubs
                    </div>
                    {renderHubRows(sellHubs, "sell")}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-2 py-1">
              <button
                type="button"
                className="flex w-full items-center justify-between text-[11px] text-eve-accent"
                aria-expanded={majorHubsExpanded}
                onClick={() => setMajorHubsExpanded((prev) => !prev)}
              >
                <span>Major Trade Hubs</span>
                <span aria-hidden="true">{majorHubsExpanded ? "▾" : "▸"}</span>
              </button>
              {majorHubsExpanded ? (
                <>
                  <div className="mt-2 mb-1 flex items-center gap-1 text-[10px]">
                    <span className="text-eve-dim">Scope:</span>
                    <button
                      type="button"
                      onClick={() => onHubScopeModeChange?.("session")}
                      className={`rounded-sm border px-1.5 py-0.5 ${hubScopeMode === "session" ? "border-eve-accent/60 text-eve-accent bg-eve-accent/10" : "border-eve-border/60 text-eve-dim hover:text-eve-text"}`}
                    >
                      Session
                    </button>
                    <button
                      type="button"
                      onClick={() => onHubScopeModeChange?.("visible")}
                      className={`rounded-sm border px-1.5 py-0.5 ${hubScopeMode === "visible" ? "border-eve-accent/60 text-eve-accent bg-eve-accent/10" : "border-eve-border/60 text-eve-dim hover:text-eve-text"}`}
                    >
                      Visible
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                  {majorHubInsights.map((entry) => (
                    <article
                      key={entry.hub.key}
                      className="rounded-sm border border-eve-border/60 bg-eve-dark/40 px-2 py-1 text-[10px]"
                    >
                      <div className="mb-1 font-medium text-eve-text">{entry.hub.label}</div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                        <span className="text-eve-dim">Buy here:</span>
                        <span className="text-right">{entry.buy.rowCount}</span>
                        <span className="text-eve-dim">Sell here:</span>
                        <span className="text-right">{entry.sell.rowCount}</span>
                        <span className="text-eve-dim">Items:</span>
                        <span className="text-right">{entry.buy.distinctItems + entry.sell.distinctItems}</span>
                        <span className="text-eve-dim">Profit:</span>
                        <span className="text-right text-green-300">
                          {formatISK(entry.buy.totalProfit + entry.sell.totalProfit)}
                        </span>
                      </div>
                      {(onOpenHubRows || onSetHubLock) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(() => {
                            const buyHub =
                              entry.buy.rowCount > 0
                                ? majorHubActionSummary(
                                    entry.hub.systemId,
                                    entry.hub.systemName,
                                    entry.buy.rowCount,
                                  )
                                : null;
                            const sellHub =
                              entry.sell.rowCount > 0
                                ? majorHubActionSummary(
                                    entry.hub.systemId,
                                    entry.hub.systemName,
                                    entry.sell.rowCount,
                                  )
                                : null;
                            return (
                              <>
                                {buyHub ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onOpenHubRows?.(buyHub, "buy")}
                                      className="rounded-sm border border-eve-border/60 px-1 py-0.5 text-[10px] text-eve-dim hover:text-eve-text"
                                    >
                                      Open buy rows
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onSetHubLock?.(buyHub, "buy")}
                                      className="rounded-sm border border-eve-border/60 px-1 py-0.5 text-[10px] text-eve-dim hover:text-eve-text"
                                    >
                                      Buy lock
                                    </button>
                                  </>
                                ) : null}
                                {sellHub ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onOpenHubRows?.(sellHub, "sell")}
                                      className="rounded-sm border border-eve-border/60 px-1 py-0.5 text-[10px] text-eve-dim hover:text-eve-text"
                                    >
                                      Open sell rows
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onSetHubLock?.(sellHub, "sell")}
                                      className="rounded-sm border border-eve-border/60 px-1 py-0.5 text-[10px] text-eve-dim hover:text-eve-text"
                                    >
                                      Sell lock
                                    </button>
                                  </>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </article>
                  ))}
                  </div>
                </>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`shrink-0 px-2 ${compactDashboard ? "pb-1" : "pb-2"}`}>
      <section
        className={`border border-eve-border rounded-sm bg-eve-dark/40 ${
          compactDashboard ? "p-1.5" : "p-2"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] uppercase tracking-wider text-eve-dim">Insights</h3>
            <span className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-1.5 py-0.5 text-[10px] text-eve-dim">Picks {pickCount}</span>
            <span className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-1.5 py-0.5 text-[10px] text-eve-dim">Queue {actionQueue.length}</span>
            <span className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-1.5 py-0.5 text-[10px] text-eve-dim">Loops {loopOpportunities.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => topRoutePicks.bestRecommendedRoutePack && openRouteWorkbench(topRoutePicks.bestRecommendedRoutePack.routeKey, "summary")} className="px-2 py-0.5 rounded-sm border border-eve-accent/60 text-[11px] text-eve-accent">Open workspace</button>
            {onToggleCompactDashboard && <button type="button" onClick={onToggleCompactDashboard} className="px-2 py-0.5 rounded-sm border border-eve-border/60 text-[11px] text-eve-dim">Compact</button>}
            <button type="button" onClick={toggleExpanded} aria-expanded={expanded} className="px-2 py-0.5 rounded-sm border border-eve-border/60 text-[11px] text-eve-dim hover:text-eve-text">{expanded ? "Collapse" : "Expand"}</button>
          </div>
        </div>

        {expanded && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {([
                ["picks", "Picks"],
                ["queue", "Queue"],
                ["loops", "Loops"],
                ["hubs", "Hubs"],
              ] as const).map(([tab, label]) => {
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setTab(tab)}
                    className={`px-2 py-0.5 rounded-sm border text-[11px] transition-colors ${
                      active
                        ? "border-eve-accent/60 text-eve-accent bg-eve-accent/10"
                        : "border-eve-border/60 text-eve-dim hover:text-eve-text"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {activeTab === "picks" && (
              <div className="mt-2 space-y-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-eve-dim mb-2">
                    {t("topPicksPanelTitle")}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                    {picks.map(([titleKey, pick, intentLabel, batchEntryMode]) => (
                      <div
                        key={titleKey}
                        className="rounded-sm border border-eve-border/60 bg-eve-panel/50 p-2 text-xs"
                      >
                        <div className="text-eve-dim">{t(titleKey)}</div>
                        {pick ? (
                          <>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <div className="text-eve-text font-medium">{pick.routeLabel}</div>
                              <span className="rounded-sm border border-indigo-400/40 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-indigo-200">
                                {intentLabel}
                              </span>
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                              <span className="text-eve-dim">{t("topPickTotalProfit")}:</span>
                              <span className="text-green-300 text-right">{formatISK(pick.totalProfit)}</span>
                              <span className="text-eve-dim">{t("topPickDailyIskPerJump")}:</span>
                              <span className="text-eve-accent text-right">{formatISK(pick.dailyIskPerJump)}</span>
                              <span className="text-eve-dim">{t("topPickConfidence")}:</span>
                              <span className="text-right">{pick.confidenceScore.toFixed(0)}</span>
                              <span className="text-eve-dim">{t("topPickCargoUse")}:</span>
                              <span className="text-right">{pick.cargoUsePercent.toFixed(1)}%</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenInRoute?.(pick.routeKey)}
                                className="px-2 py-0.5 rounded-sm border border-eve-border/60 text-eve-dim hover:text-eve-text transition-colors text-[11px]"
                              >
                                Open in Route
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenInRouteWorkbench?.(pick.routeKey)}
                                className="px-2 py-0.5 rounded-sm border border-eve-accent/60 text-eve-accent hover:bg-eve-accent/10 transition-colors text-[11px]"
                              >
                                Open in Route Workbench
                              </button>
                              <button
                                type="button"
                                onClick={() => onSendToRouteQueue?.(pick.routeKey)}
                                className="px-2 py-0.5 rounded-sm border border-indigo-400/50 text-indigo-200 hover:bg-indigo-500/10 transition-colors text-[11px]"
                              >
                                Send to Route Queue
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openRouteWorkbench(pick.routeKey, "summary", {
                                    intentLabel,
                                    batchEntryMode,
                                  })
                                }
                                className="px-2 py-0.5 rounded-sm border border-eve-accent/60 text-eve-accent hover:bg-eve-accent/10 transition-colors text-[11px]"
                              >
                                {t("topPickJumpToGroup")}
                              </button>
                              {routeExplanationByKey[pick.routeKey] && (
                                <ExplanationPopoverShell label="Why this route?">
                                  <div className="text-eve-accent font-mono mb-1">Score {routeExplanationByKey[pick.routeKey].totalScore.toFixed(1)}</div>
                                  <div className="text-eve-dim mb-1">{routeExplanationByKey[pick.routeKey].summary}</div>
                                  {lensDeltaByRouteKey[pick.routeKey] && <div className="text-[10px] text-indigo-200">{lensDeltaByRouteKey[pick.routeKey]}</div>}
                                </ExplanationPopoverShell>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="mt-1 text-[11px] text-eve-dim">—</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {suppressionSummary && (
                  <div className="text-[11px] text-eve-dim">{suppressionSummary}</div>
                )}
              </div>
            )}

            {activeTab === "queue" && (
              <div className="mt-2">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-eve-dim">
                  Action Queue
                </div>
                <div className="space-y-1.5">
                  {actionQueue.length === 0 ? (
                    <div className="text-[11px] text-eve-dim">No queue actions available.</div>
                  ) : (
                    (showAllQueueItems ? actionQueue : actionQueue.slice(0, 3)).map((item) => (
                      <div
                        key={`queue-${item.routeKey}`}
                        className="rounded-sm border border-eve-border/60 bg-eve-panel/30 px-2 py-1.5 text-xs"
                      >
                        {showAllQueueItems ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-eve-text truncate">{item.routeLabel}</div>
                              <span className="rounded-sm border border-eve-accent/40 bg-eve-accent/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-eve-accent">
                                {item.action === "loop_return"
                                  ? "Backhaul"
                                  : actionLabel(item.action)}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {routeExplanationByKey[item.routeKey] && (
                                <ExplanationPopoverShell label="Why this route?">
                                  <div className="text-eve-accent font-mono mb-1">
                                    Score {routeExplanationByKey[item.routeKey].totalScore.toFixed(1)}
                                  </div>
                                  <div className="text-eve-dim mb-1">
                                    {routeExplanationByKey[item.routeKey].summary}
                                  </div>
                                </ExplanationPopoverShell>
                              )}
                              {item.reasons.map((reason) => (
                                <span
                                  key={`${item.routeKey}-reason-${reason}`}
                                  title={reason}
                                  className="rounded-sm border border-eve-border/60 bg-eve-dark/50 px-1.5 py-0.5 text-[10px] text-eve-dim"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                openRouteWorkbench(item.routeKey, "summary", {
                                  intentLabel:
                                    item.action === "loop_return"
                                      ? "Backhaul"
                                      : actionLabel(item.action),
                                  batchEntryMode:
                                    item.action === "loop_return"
                                      ? "loop"
                                      : item.action === "filler"
                                        ? "filler"
                                        : "core",
                                })
                              }
                              className="mt-2 rounded-sm border border-eve-accent/60 px-2 py-0.5 text-[11px] text-eve-accent transition-colors hover:bg-eve-accent/10"
                            >
                              {t("topPickJumpToGroup")}
                            </button>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenInRoute?.(item.routeKey)}
                                className="rounded-sm border border-eve-border/60 px-2 py-0.5 text-[10px] text-eve-dim hover:text-eve-text"
                              >
                                Open in Route
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenInRouteWorkbench?.(item.routeKey)}
                                className="rounded-sm border border-eve-accent/60 px-2 py-0.5 text-[10px] text-eve-accent hover:bg-eve-accent/10"
                              >
                                Open in Route Workbench
                              </button>
                              <button
                                type="button"
                                onClick={() => onSendToRouteQueue?.(item.routeKey)}
                                className="rounded-sm border border-indigo-400/50 px-2 py-0.5 text-[10px] text-indigo-200 hover:bg-indigo-500/10"
                              >
                                Send to Route Queue
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1 truncate font-medium text-eve-text" title={item.routeLabel}>
                              {item.routeLabel}
                            </div>
                            <span className="rounded-sm border border-eve-accent/40 bg-eve-accent/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-eve-accent">
                              {item.action === "loop_return"
                                ? "Backhaul"
                                : actionLabel(item.action)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                openRouteWorkbench(item.routeKey, "summary", {
                                  intentLabel:
                                    item.action === "loop_return"
                                      ? "Backhaul"
                                      : actionLabel(item.action),
                                  batchEntryMode:
                                    item.action === "loop_return"
                                      ? "loop"
                                      : item.action === "filler"
                                        ? "filler"
                                        : "core",
                                })
                              }
                              className="rounded-sm border border-eve-accent/50 px-1.5 py-0.5 text-[10px] text-eve-accent hover:bg-eve-accent/10"
                            >
                              {t("topPickJumpToGroup")}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenInRoute?.(item.routeKey)}
                              className="rounded-sm border border-eve-border/50 px-1.5 py-0.5 text-[10px] text-eve-dim hover:text-eve-text"
                            >
                              Open in Route
                            </button>
                            <button
                              type="button"
                              onClick={() => onSendToRouteQueue?.(item.routeKey)}
                              className="rounded-sm border border-indigo-400/50 px-1.5 py-0.5 text-[10px] text-indigo-200 hover:bg-indigo-500/10"
                            >
                              Queue
                            </button>
                            <div className="flex max-w-[45%] flex-wrap justify-end gap-1">
                              {item.reasons.slice(0, 2).map((reason) => (
                                <span
                                  key={`${item.routeKey}-reason-${reason}`}
                                  title={reason}
                                  className="rounded-sm border border-eve-border/60 bg-eve-dark/50 px-1.5 py-0.5 text-[10px] text-eve-dim"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {actionQueue.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllQueueItems((prev) => !prev)}
                    className="mt-2 rounded-sm border border-eve-border/60 px-2 py-0.5 text-[11px] text-eve-accent hover:border-eve-accent"
                  >
                    {showAllQueueItems ? "Show fewer queue items" : "Show all queue items"}
                  </button>
                )}
              </div>
            )}

            {activeTab === "loops" && (
              <div className="mt-2">
                <LoopOpportunitiesPanel
                  loops={loopOpportunities}
                  collapsed
                  defaultExpanded={false}
                  onOpenRouteWorkbench={openRouteWorkbench}
                />
              </div>
            )}



            {activeTab === "hubs" && (
              <div className="mt-2 space-y-2">
                <section className="rounded-sm border border-eve-border/60 bg-eve-panel/30 px-2 py-1">
                  <button type="button" className="flex w-full items-center justify-between text-[11px] text-eve-accent" aria-expanded={!!sectionExpanded.topBuy} onClick={() => setSection("topBuy")}>
                    <span>Top Buy</span><span>{sectionExpanded.topBuy ? "▾" : "▸"}</span>
                  </button>
                  {sectionExpanded.topBuy && <div className="mt-1">{renderHubRows(buyHubs, "buy")}</div>}
                </section>
                <section className="rounded-sm border border-eve-border/60 bg-eve-panel/30 px-2 py-1">
                  <button type="button" className="flex w-full items-center justify-between text-[11px] text-eve-accent" aria-expanded={!!sectionExpanded.topSell} onClick={() => setSection("topSell")}>
                    <span>Top Sell</span><span>{sectionExpanded.topSell ? "▾" : "▸"}</span>
                  </button>
                  {sectionExpanded.topSell && <div className="mt-1">{renderHubRows(sellHubs, "sell")}</div>}
                </section>
                <section className="rounded-sm border border-eve-border/60 bg-eve-panel/30 px-2 py-1">
                  <button type="button" className="flex w-full items-center justify-between text-[11px] text-eve-accent" aria-expanded={!!sectionExpanded.major} onClick={() => setSection("major")}>
                    <span>Major Hub insights</span><span>{sectionExpanded.major ? "▾" : "▸"}</span>
                  </button>
                  {sectionExpanded.major && (
                    <div className="mt-1 grid grid-cols-1 gap-1.5 md:grid-cols-2">
                      {majorHubInsights.map((entry) => (<div key={entry.hub.key} className="rounded-sm border border-eve-border/60 bg-eve-dark/40 px-2 py-1 text-[10px]"><div className="text-eve-text">{entry.hub.label}</div><div className="text-eve-dim">Buy {entry.buy.rowCount} · Sell {entry.sell.rowCount}</div></div>))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeRouteGroupKey && (
              <div className="mt-2 rounded-sm border border-eve-accent/40 bg-eve-accent/5 p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-eve-text">
                    <span className="font-semibold">Route workbench:</span>{" "}
                    {activeRouteLabel ?? activeRouteGroupKey}
                  </div>
                  <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-eve-dim">
                    {routeWorkbenchMode[0].toUpperCase() + routeWorkbenchMode.slice(1)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      openRouteWorkbench(activeRouteGroupKey, "execution")
                    }
                    className="rounded-sm border border-eve-accent/60 px-2 py-0.5 text-[11px] text-eve-accent hover:bg-eve-accent/10"
                  >
Open execution
                  </button>
                  <button
                    type="button"
                    onClick={() => openRouteWorkbench(activeRouteGroupKey, "summary")}
                    className="rounded-sm border border-eve-border/60 px-2 py-0.5 text-[11px] text-eve-dim hover:text-eve-text"
                  >
                    Scroll to table
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export { INSIGHTS_TAB_STORAGE_KEY, INSIGHTS_VISIBLE_STORAGE_KEY };
