import { useMemo, useState } from "react";
import type { LoopOpportunity } from "@/lib/loopPlanner";

type LoopOpportunitiesPanelProps = {
  loops: LoopOpportunity[];
};

function formatIsk(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ISK`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function LoopOpportunitiesPanel({ loops }: LoopOpportunitiesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const topLoops = useMemo(() => loops.slice(0, 6), [loops]);

  return (
    <section className="shrink-0 border-b border-eve-border/40 bg-eve-panel/30 px-2 py-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-eve-text">
          Loop Opportunities
        </h3>
        <span className="text-[11px] text-eve-dim">
          Pairwise chaining only (extensible to multi-leg later)
        </span>
      </div>

      {topLoops.length === 0 ? (
        <p className="text-xs text-eve-dim">
          No qualifying two-leg loops found for current filters.
        </p>
      ) : (
        <div className="space-y-1.5">
          {topLoops.map((loop) => {
            const isExpanded = expandedId === loop.id;
            return (
              <article
                key={loop.id}
                className="rounded border border-eve-border/40 bg-eve-panel/40 p-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-eve-text">
                    <span className="font-semibold">{loop.outbound.row.BuySystemName}</span>
                    <span className="text-eve-dim"> → </span>
                    <span className="font-semibold">{loop.outbound.row.SellSystemName}</span>
                    <span className="text-eve-dim"> ↺ </span>
                    <span className="font-semibold">{loop.returnLeg.row.BuySystemName}</span>
                    <span className="text-eve-dim"> → </span>
                    <span className="font-semibold">{loop.returnLeg.row.SellSystemName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : loop.id)}
                    className="text-[11px] px-2 py-0.5 rounded border border-eve-border/50 text-eve-accent hover:border-eve-accent"
                  >
                    {isExpanded ? "Hide legs" : "View legs"}
                  </button>
                </div>

                <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-eve-dim">Total: <strong className="text-eve-success">{formatIsk(loop.totalLoopProfit)}</strong></span>
                  <span className="text-eve-dim">Jumps: <strong className="text-eve-text">{loop.totalLoopJumps}</strong></span>
                  <span className="text-eve-dim">Deadhead: <strong className="text-eve-text">{formatPercent(loop.deadheadRatio)}</strong></span>
                  <span className="text-eve-dim">Efficiency: <strong className="text-eve-text">{loop.loopEfficiencyScore.toFixed(1)}</strong></span>
                </div>

                {isExpanded && (
                  <div className="mt-2 border-t border-eve-border/30 pt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="font-semibold text-eve-text">Outbound leg</div>
                      <div className="text-eve-dim">{loop.outbound.row.TypeName}</div>
                      <div className="text-eve-dim">Profit: <span className="text-eve-success">{formatIsk(loop.outboundProfit)}</span></div>
                      <div className="text-eve-dim">Cargo: {loop.outbound.cargoM3.toFixed(0)} m³</div>
                    </div>
                    <div>
                      <div className="font-semibold text-eve-text">Return leg</div>
                      <div className="text-eve-dim">{loop.returnLeg.row.TypeName}</div>
                      <div className="text-eve-dim">Profit: <span className="text-eve-success">{formatIsk(loop.returnProfit)}</span></div>
                      <div className="text-eve-dim">Cargo: {loop.returnLeg.cargoM3.toFixed(0)} m³ · Detour: {loop.detourJumps} · Empty jumps avoided: {loop.emptyJumpsAvoided}</div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
