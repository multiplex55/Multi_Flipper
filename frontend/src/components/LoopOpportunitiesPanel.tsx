import { useMemo, useState } from "react";
import type { LoopOpportunity } from "@/lib/loopPlanner";
import { routeGroupKey } from "@/lib/batchMetrics";

type LoopOpportunitiesPanelProps = {
  loops: LoopOpportunity[];
  collapsed?: boolean;
  defaultExpanded?: boolean;
  onOpenRouteWorkbench?: (routeKey: string, mode?: "summary" | "execution" | "filler" | "verification") => void;
};

function formatIsk(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ISK`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function LoopOpportunitiesPanel({
  loops,
  collapsed = true,
  defaultExpanded,
  onOpenRouteWorkbench,
}: LoopOpportunitiesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showExpanded, setShowExpanded] = useState<boolean>(
    defaultExpanded ?? !collapsed,
  );
  const compactMode = collapsed && !showExpanded;
  const visibleLoops = useMemo(
    () => (compactMode ? loops.slice(0, 2) : loops.slice(0, 6)),
    [compactMode, loops],
  );

  const summary = useMemo(() => {
    const count = loops.length;
    const bestProfit = loops.reduce(
      (best, loop) => Math.max(best, loop.totalLoopProfit),
      0,
    );
    const averageEfficiency =
      count > 0
        ? loops.reduce((sum, loop) => sum + loop.loopEfficiencyScore, 0) / count
        : 0;
    return { count, bestProfit, averageEfficiency };
  }, [loops]);

  return (
    <section className="shrink-0 border-b border-eve-border/40 bg-eve-panel/30 px-2 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-eve-text">
          Backhaul/return-leg filler opportunities
        </h3>
        {!compactMode && (
          <span className="text-[11px] text-eve-dim">
            Pairwise chaining only (extensible to multi-leg later)
          </span>
        )}
      </div>

      {loops.length === 0 ? (
        <p className="text-xs text-eve-dim">
          No qualifying two-leg loops found for current filters.
        </p>
      ) : (
        <div className="space-y-1.5">
          {compactMode && (
            <div
              data-testid="loop-compact-summary"
              className="rounded border border-eve-border/40 bg-eve-panel/40 px-2 py-1.5 text-[11px]"
            >
              <div className="flex flex-wrap items-center gap-1.5 text-eve-dim">
                <span className="rounded-full border border-eve-border/50 bg-eve-dark/40 px-2 py-0.5">
                  Loops <strong className="text-eve-text">{summary.count}</strong>
                </span>
                <span className="rounded-full border border-eve-border/50 bg-eve-dark/40 px-2 py-0.5">
                  Best <strong className="text-eve-success">{formatIsk(summary.bestProfit)}</strong>
                </span>
                <span className="rounded-full border border-eve-border/50 bg-eve-dark/40 px-2 py-0.5">
                  Avg efficiency <strong className="text-eve-text">{summary.averageEfficiency.toFixed(1)}</strong>
                </span>
              </div>
            </div>
          )}

          {visibleLoops.map((loop) => {
            const isExpanded = expandedId === loop.id;
            return (
              <article
                key={loop.id}
                data-testid="loop-card"
                className="rounded border border-eve-border/40 bg-eve-panel/40 p-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 text-eve-text">
                    <div className="truncate" title={`${loop.outbound.row.BuySystemName} → ${loop.outbound.row.SellSystemName} ↺ ${loop.returnLeg.row.BuySystemName} → ${loop.returnLeg.row.SellSystemName}`}>
                      <span className="font-semibold">{loop.outbound.row.BuySystemName}</span>
                      <span className="text-eve-dim"> → </span>
                      <span className="font-semibold">{loop.outbound.row.SellSystemName}</span>
                      <span className="text-eve-dim"> ↺ </span>
                      <span className="font-semibold">{loop.returnLeg.row.BuySystemName}</span>
                      <span className="text-eve-dim"> → </span>
                      <span className="font-semibold">{loop.returnLeg.row.SellSystemName}</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenRouteWorkbench?.(
                          routeGroupKey(loop.outbound.row),
                          "summary",
                        )
                      }
                      className="rounded border border-eve-accent/50 px-2 py-0.5 text-[11px] text-eve-accent hover:bg-eve-accent/10"
                    >
                      Outbound
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenRouteWorkbench?.(
                          routeGroupKey(loop.returnLeg.row),
                          "summary",
                        )
                      }
                      className="rounded border border-eve-border/60 px-2 py-0.5 text-[11px] text-eve-dim hover:text-eve-text"
                    >
                      Return-leg
                    </button>
                  </div>
                  {!compactMode && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : loop.id)}
                      className="rounded border border-eve-border/50 px-2 py-0.5 text-[11px] text-eve-accent hover:border-eve-accent"
                    >
                      {isExpanded ? "Hide legs" : "View legs"}
                    </button>
                  )}
                </div>

                {compactMode ? (
                  <div
                    data-testid="loop-compact-metrics"
                    className="mt-1 flex flex-wrap gap-1 text-[10px]"
                  >
                    <span className="rounded-full border border-eve-border/50 bg-eve-dark/40 px-1.5 py-0.5 text-eve-dim">
                      Total <strong className="text-eve-success">{formatIsk(loop.totalLoopProfit)}</strong>
                    </span>
                    <span className="rounded-full border border-eve-border/50 bg-eve-dark/40 px-1.5 py-0.5 text-eve-dim">
                      Jumps <strong className="text-eve-text">{loop.totalLoopJumps}</strong>
                    </span>
                    <span className="rounded-full border border-eve-border/50 bg-eve-dark/40 px-1.5 py-0.5 text-eve-dim">
                      Deadhead <strong className="text-eve-text">{formatPercent(loop.deadheadRatio)}</strong>
                    </span>
                    <span className="rounded-full border border-eve-border/50 bg-eve-dark/40 px-1.5 py-0.5 text-eve-dim">
                      Efficiency <strong className="text-eve-text">{loop.loopEfficiencyScore.toFixed(1)}</strong>
                    </span>
                  </div>
                ) : (
                  <div
                    data-testid="loop-full-metrics-grid"
                    className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] md:grid-cols-4"
                  >
                    <span className="text-eve-dim">
                      Total: <strong className="text-eve-success">{formatIsk(loop.totalLoopProfit)}</strong>
                    </span>
                    <span className="text-eve-dim">
                      Jumps: <strong className="text-eve-text">{loop.totalLoopJumps}</strong>
                    </span>
                    <span className="text-eve-dim">
                      Deadhead: <strong className="text-eve-text">{formatPercent(loop.deadheadRatio)}</strong>
                    </span>
                    <span className="text-eve-dim">
                      Efficiency: <strong className="text-eve-text">{loop.loopEfficiencyScore.toFixed(1)}</strong>
                    </span>
                  </div>
                )}

                {!compactMode && isExpanded && (
                  <div className="mt-2 grid grid-cols-1 gap-2 border-t border-eve-border/30 pt-2 text-[11px] md:grid-cols-2">
                    <div>
                      <div className="font-semibold text-eve-text">Outbound leg</div>
                      <div className="text-eve-dim">{loop.outbound.row.TypeName}</div>
                      <div className="text-eve-dim">
                        Profit: <span className="text-eve-success">{formatIsk(loop.outboundProfit)}</span>
                      </div>
                      <div className="text-eve-dim">Cargo: {loop.outbound.cargoM3.toFixed(0)} m³</div>
                    </div>
                    <div>
                      <div className="font-semibold text-eve-text">Backhaul/return-leg</div>
                      <div className="text-eve-dim">{loop.returnLeg.row.TypeName}</div>
                      <div className="text-eve-dim">
                        Profit: <span className="text-eve-success">{formatIsk(loop.returnProfit)}</span>
                      </div>
                      <div className="text-eve-dim">
                        Cargo: {loop.returnLeg.cargoM3.toFixed(0)} m³ · Detour: {loop.detourJumps} · Empty jumps avoided: {loop.emptyJumpsAvoided}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {collapsed && loops.length > 2 && (
            <button
              type="button"
              onClick={() => setShowExpanded((prev) => !prev)}
              className="rounded border border-eve-border/60 px-2 py-0.5 text-[11px] text-eve-accent hover:border-eve-accent"
            >
              {compactMode ? "Show all loop opportunities" : "Show compact loop view"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
