import { useMemo, useState } from "react";
import { RouteBuilder } from "@/components/RouteBuilder";
import { EmptyState } from "@/components/EmptyState";
import type { RadiusScanSession } from "@/lib/radiusScanSession";
import type { RouteResult, ScanParams } from "@/lib/types";
import { formatISK } from "@/lib/format";

export type RadiusRouteWorkspaceTab = "discover" | "workbench" | "finder" | "validate";

type RadiusRouteWorkspaceProps = {
  params: ScanParams;
  onChange?: (params: ScanParams) => void;
  routeLoadedResults?: RouteResult[] | null;
  isLoggedIn?: boolean;
  radiusScanSession?: RadiusScanSession | null;
  loadingScanSession?: boolean;
  scanSessionError?: string | null;
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
}: RadiusRouteWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<RadiusRouteWorkspaceTab>("discover");

  const tabs: Array<{ id: RadiusRouteWorkspaceTab; label: string; hint: string }> = [
    { id: "discover", label: "Discover", hint: "Grouped routes, top picks, queue, loops" },
    { id: "workbench", label: "Workbench", hint: "Selected route, saved routes, execution state, filler options" },
    { id: "finder", label: "Finder", hint: "Route search flow" },
    { id: "validate", label: "Validate", hint: "Route and batch readiness checks" },
  ];

  const topRouteRows = useMemo(
    () =>
      radiusScanSession?.insights.routeSummaries.slice(0, 8).map((route) => ({
        key: route.routeKey,
        label: route.routeLabel,
        dailyProfit: route.aggregate.dailyProfit,
        dailyIskPerJump: route.aggregate.dailyIskPerJump,
        confidence: route.badge.confidence.score,
      })) ?? [],
    [radiusScanSession],
  );

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
                    <div className="text-eve-text font-semibold">{radiusScanSession.insights.routeSummaries.length}</div>
                  </div>
                  <div className="rounded-sm border border-eve-border/60 bg-eve-panel/50 p-2">
                    <div className="text-eve-dim">Top picks</div>
                    <div className="text-eve-text font-semibold">{Object.values(radiusScanSession.insights.topRoutePicks).filter(Boolean).length}</div>
                  </div>
                  <div className="rounded-sm border border-eve-border/60 bg-eve-panel/50 p-2">
                    <div className="text-eve-dim">Queue</div>
                    <div className="text-eve-text font-semibold">{radiusScanSession.insights.actionQueue.length}</div>
                  </div>
                  <div className="rounded-sm border border-eve-border/60 bg-eve-panel/50 p-2">
                    <div className="text-eve-dim">Loops</div>
                    <div className="text-eve-text font-semibold">{radiusScanSession.loopOpportunities.length}</div>
                  </div>
                </div>
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
                <div className="text-eve-dim">Selected route: {radiusScanSession.insights.routeSummaries[0]?.routeLabel ?? "None"}</div>
                <div className="text-eve-dim">Saved routes: 0 (workspace migration placeholder)</div>
                <div className="text-eve-dim">Execution state: idle</div>
                <div className="text-eve-dim">Filler options: {radiusScanSession.insights.actionQueue.filter((q) => q.action === "filler").length}</div>
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
                  Route checks: {radiusScanSession.insights.routeSummaries.length > 0 ? "ready" : "no route groups"}
                </div>
                <div className="rounded-sm border border-eve-border/60 bg-eve-panel/40 p-2 text-eve-dim">
                  Batch checks: {radiusScanSession.insights.actionQueue.length > 0 ? "queue available" : "empty queue"}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
