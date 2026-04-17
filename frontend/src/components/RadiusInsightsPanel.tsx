import { useMemo, useState } from "react";
import { formatISK } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { ActionQueueItem, TopRoutePicks } from "@/lib/radiusMetrics";
import type { LoopOpportunity } from "@/lib/loopPlanner";
import { LoopOpportunitiesPanel } from "./LoopOpportunitiesPanel";

const INSIGHTS_VISIBLE_STORAGE_KEY = "eve-radius-insights-visible:v1";
const INSIGHTS_TAB_STORAGE_KEY = "eve-radius-insights-tab:v1";

type InsightsTab = "summary" | "queue" | "loops";

type RadiusInsightsPanelProps = {
  topRoutePicks: TopRoutePicks;
  actionQueue: ActionQueueItem[];
  suppressionSummary?: string;
  loopOpportunities?: LoopOpportunity[];
  jumpToRouteGroup: (routeKey: string) => void;
};

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

function loadVisibleState(): boolean {
  try {
    return localStorage.getItem(INSIGHTS_VISIBLE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function loadTabState(): InsightsTab {
  try {
    const saved = localStorage.getItem(INSIGHTS_TAB_STORAGE_KEY);
    return saved === "queue" || saved === "loops" || saved === "summary"
      ? saved
      : "summary";
  } catch {
    return "summary";
  }
}

export function RadiusInsightsPanel({
  topRoutePicks,
  actionQueue,
  suppressionSummary,
  loopOpportunities = [],
  jumpToRouteGroup,
}: RadiusInsightsPanelProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<boolean>(() => loadVisibleState());
  const [activeTab, setActiveTab] = useState<InsightsTab>(() => loadTabState());
  const [showAllQueueItems, setShowAllQueueItems] = useState(false);

  const picks = useMemo(
    () =>
      [
        ["bestRecommendedRoutePack", topRoutePicks.bestRecommendedRoutePack],
        ["bestQuickSingleRoute", topRoutePicks.bestQuickSingleRoute],
        ["bestSafeFillerRoute", topRoutePicks.bestSafeFillerRoute],
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

  const setTab = (tab: InsightsTab) => {
    setActiveTab(tab);
    if (tab !== "queue") setShowAllQueueItems(false);
    try {
      localStorage.setItem(INSIGHTS_TAB_STORAGE_KEY, tab);
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="shrink-0 px-2 pb-2">
      <section className="border border-eve-border rounded-sm bg-eve-dark/40 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] uppercase tracking-wider text-eve-dim">Insights</h3>
            <span className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-1.5 py-0.5 text-[10px] text-eve-dim">
              Picks {pickCount}
            </span>
            <span className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-1.5 py-0.5 text-[10px] text-eve-dim">
              Queue {actionQueue.length}
            </span>
            <span className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-1.5 py-0.5 text-[10px] text-eve-dim">
              Loops {loopOpportunities.length}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            className="px-2 py-0.5 rounded-sm border border-eve-border/60 text-[11px] text-eve-dim hover:text-eve-text"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>

        {expanded && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {([
                ["summary", "Summary"],
                ["queue", "Queue"],
                ["loops", "Loops"],
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

            {activeTab === "summary" && (
              <div className="mt-2 space-y-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-eve-dim mb-2">
                    {t("topPicksPanelTitle")}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                    {picks.map(([titleKey, pick]) => (
                      <div
                        key={titleKey}
                        className="rounded-sm border border-eve-border/60 bg-eve-panel/50 p-2 text-xs"
                      >
                        <div className="text-eve-dim">{t(titleKey)}</div>
                        {pick ? (
                          <>
                            <div className="mt-1 text-eve-text font-medium">{pick.routeLabel}</div>
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
                            <button
                              type="button"
                              onClick={() => jumpToRouteGroup(pick.routeKey)}
                              className="mt-2 px-2 py-0.5 rounded-sm border border-eve-accent/60 text-eve-accent hover:bg-eve-accent/10 transition-colors text-[11px]"
                            >
                              {t("topPickJumpToGroup")}
                            </button>
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
                                {actionLabel(item.action)}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
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
                              onClick={() => jumpToRouteGroup(item.routeKey)}
                              className="mt-2 rounded-sm border border-eve-accent/60 px-2 py-0.5 text-[11px] text-eve-accent transition-colors hover:bg-eve-accent/10"
                            >
                              {t("topPickJumpToGroup")}
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1 truncate font-medium text-eve-text" title={item.routeLabel}>
                              {item.routeLabel}
                            </div>
                            <span className="rounded-sm border border-eve-accent/40 bg-eve-accent/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-eve-accent">
                              {actionLabel(item.action)}
                            </span>
                            <button
                              type="button"
                              onClick={() => jumpToRouteGroup(item.routeKey)}
                              className="rounded-sm border border-eve-accent/50 px-1.5 py-0.5 text-[10px] text-eve-accent hover:bg-eve-accent/10"
                            >
                              {t("topPickJumpToGroup")}
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
                <LoopOpportunitiesPanel loops={loopOpportunities} collapsed defaultExpanded={false} />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export { INSIGHTS_TAB_STORAGE_KEY, INSIGHTS_VISIBLE_STORAGE_KEY };
