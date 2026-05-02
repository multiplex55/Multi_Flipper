import { useMemo, useState } from "react";
import type { RadiusDecisionQueueItem } from "@/lib/radiusDecisionQueue";
import { formatISK } from "@/lib/format";

type LayoutMode = "compact" | "cards" | "table";

type Props = {
  recommendations: RadiusDecisionQueueItem[];
  onOpenBatchBuilder: (recommendation: RadiusDecisionQueueItem) => void;
  onCopyManifest: (recommendation: RadiusDecisionQueueItem) => void;
  onCopyBuyChecklist: (recommendation: RadiusDecisionQueueItem) => void;
  onCopySellChecklist: (recommendation: RadiusDecisionQueueItem) => void;
  onVerify: (recommendation: RadiusDecisionQueueItem) => void;
  onPin: (recommendation: RadiusDecisionQueueItem) => void;
  onMarkQueued?: (recommendation: RadiusDecisionQueueItem) => void;
  onHideSimilar?: (recommendation: RadiusDecisionQueueItem) => void;
  layoutMode?: LayoutMode;
  columns?: 1 | 2;
  pageSize?: number;
  visibleLimit?: number;
};

export function RadiusBuyNowQueuePanel({
  recommendations,
  onOpenBatchBuilder,
  onCopyManifest,
  onCopyBuyChecklist,
  onCopySellChecklist,
  onVerify,
  onPin,
  onMarkQueued,
  onHideSimilar,
  layoutMode = "cards",
  columns = 1,
  pageSize = 6,
  visibleLimit,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<LayoutMode>(layoutMode);

  const cappedRecommendations = useMemo(
    () => (typeof visibleLimit === "number" && visibleLimit > 0 ? recommendations.slice(0, visibleLimit) : recommendations),
    [recommendations, visibleLimit],
  );
  const totalCount = cappedRecommendations.length;
  const effectivePageSize = showAll ? totalCount || pageSize : Math.max(1, pageSize);
  const start = page * effectivePageSize;
  const endExclusive = Math.min(start + effectivePageSize, totalCount);
  const visibleRecommendations = useMemo(
    () => cappedRecommendations.slice(start, endExclusive),
    [cappedRecommendations, endExclusive, start],
  );

  const displayStart = totalCount === 0 ? 0 : start + 1;
  const displayEnd = totalCount === 0 ? 0 : endExclusive;
  const hasPrev = !showAll && page > 0;
  const hasNext = !showAll && endExclusive < totalCount;

  return (
    <div className="rounded-sm border border-eve-border/60 bg-eve-dark/25 p-2 text-[11px]" data-testid="radius-buy-now-queue-panel">
      <div className="mb-1 text-eve-dim">Buy-Now Queue: {recommendations.length}</div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-eve-dim">Showing {displayStart}–{displayEnd} of {totalCount}</div>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setPage((prev) => Math.max(0, prev - 1))} disabled={!hasPrev}>Prev</button>
          <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={!hasNext}>Next</button>
          <button type="button" onClick={() => { setShowAll((prev) => !prev); setPage(0); }}>{showAll ? "Paged" : "Show All"}</button>
          <button type="button" onClick={() => setSelectedLayout("compact")}>Compact</button>
          <button type="button" onClick={() => setSelectedLayout("cards")}>Cards</button>
          <button type="button" onClick={() => setSelectedLayout("table")}>Table</button>
        </div>
      </div>
      <div className={selectedLayout === "cards" && columns === 2 ? "grid gap-2 grid-cols-1 2xl:grid-cols-2" : "grid gap-2"}>
        {visibleRecommendations.map((recommendation, index) => {
          const first = recommendation.lines[0]?.row;
          const buyStation = first?.BuyStation ?? "Unknown buy";
          const sellStation = first?.SellStation ?? "Unknown sell";
          const warningsCount = recommendation.warnings.length + recommendation.blockers.length;
          const rank = start + index + 1;
          return (
            <div key={recommendation.id} className="rounded-sm border border-eve-border/40 bg-black/20 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-eve-dim">#{rank}</span>
                <span className="rounded-sm border border-eve-accent/40 px-1 py-0 text-[10px] text-eve-accent">{recommendation.action}</span>
                <span className="rounded-sm border border-eve-border/40 px-1 py-0 text-[10px] text-eve-dim">{recommendation.kind}</span>
                <span className="rounded-sm border border-sky-500/40 px-1 py-0 text-[10px] text-sky-300">{recommendation.haulWorthiness.label}</span>
                <span className="text-eve-text">{buyStation} → {sellStation}</span>
              </div>

              {selectedLayout === "compact" ? (
                <div className="mt-1 flex flex-wrap gap-2 text-eve-dim" data-testid="compact-row">
                  <span>P {formatISK(recommendation.batchProfitIsk)}</span>
                  <span>C {formatISK(recommendation.batchCapitalIsk)}</span>
                  <span>J {recommendation.totalJumps}</span>
                  <span>ISK/J {formatISK(recommendation.batchIskPerJump)}</span>
                </div>
              ) : null}

              {selectedLayout === "cards" ? (
                <>
                  <div className="mt-1 flex flex-wrap gap-2 text-eve-dim" data-testid="cards-row">
                    <span>Profit {formatISK(recommendation.batchProfitIsk)}</span><span>Capital {formatISK(recommendation.batchCapitalIsk)}</span><span>ROI {recommendation.batchRoiPercent.toFixed(1)}%</span><span>Cargo {recommendation.totalVolumeM3.toLocaleString("en-US")} m3</span><span>ISK/jump {formatISK(recommendation.batchIskPerJump)}</span><span>Jumps {recommendation.totalJumps}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-eve-dim">
                    <span>Execution {(recommendation.scoreBreakdown.positive.executionQuality * 100).toFixed(0)}%</span>
                    <span>Fill {(recommendation.scoreBreakdown.positive.fillConfidence * 100).toFixed(0)}%</span>
                    <span>Risk {(recommendation.scoreBreakdown.totalPenalty * 100).toFixed(0)}%</span>
                    <span>Movement {(recommendation.scoreBreakdown.positive.movement * 100).toFixed(0)}%</span>
                    <span>Warnings {warningsCount}</span>
                  </div>
                </>
              ) : null}

              {selectedLayout === "table" ? (
                <div className="mt-1 overflow-x-auto" data-testid="table-row">
                  <table className="min-w-full text-[10px]"><tbody><tr className="text-eve-dim"><td>Profit</td><td>{formatISK(recommendation.batchProfitIsk)}</td><td>Capital</td><td>{formatISK(recommendation.batchCapitalIsk)}</td><td>Jumps</td><td>{recommendation.totalJumps}</td><td>ISK/jump</td><td>{formatISK(recommendation.batchIskPerJump)}</td></tr></tbody></table>
                </div>
              ) : null}

              <div className="mt-1 flex flex-wrap gap-1">
                <button type="button" className="rounded-sm border border-eve-accent/60 px-1.5 py-0.5 text-eve-accent" onClick={() => onOpenBatchBuilder(recommendation)}>Open Batch Builder</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5" onClick={() => onCopyManifest(recommendation)}>Manifest</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5" onClick={() => onCopyBuyChecklist(recommendation)}>Buy list</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5" onClick={() => onCopySellChecklist(recommendation)}>Sell list</button>
                <button type="button" className="rounded-sm border border-amber-400/60 px-1.5 py-0.5 text-amber-200" onClick={() => onVerify(recommendation)}>Verify</button>
                <button type="button" className="rounded-sm border border-indigo-400/60 px-1.5 py-0.5 text-indigo-200" onClick={() => onPin(recommendation)}>Pin</button>
              </div>
              <div className="mt-1 flex gap-2">
                {onMarkQueued ? <button type="button" className="text-eve-dim hover:text-eve-text" onClick={() => onMarkQueued(recommendation)}>Mark queued</button> : null}
                {onHideSimilar ? <button type="button" className="text-eve-dim hover:text-eve-text" onClick={() => onHideSimilar(recommendation)}>Hide similar</button> : null}
                <button type="button" className="text-eve-dim hover:text-eve-text" onClick={() => setExpandedId((prev) => prev === recommendation.id ? null : recommendation.id)}>{expandedId === recommendation.id ? "Hide details" : "Show details"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
