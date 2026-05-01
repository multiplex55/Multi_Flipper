import { useMemo, useState } from "react";
import type { RadiusDecisionQueueItem } from "@/lib/radiusDecisionQueue";
import { formatISK } from "@/lib/format";

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
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const topRecommendations = useMemo(() => recommendations.slice(0, 6), [recommendations]);
  return (
    <div className="rounded-sm border border-eve-border/60 bg-eve-dark/25 p-2 text-[11px]" data-testid="radius-buy-now-queue-panel">
      <div className="mb-1 text-eve-dim">Buy-Now Queue: {recommendations.length}</div>
      <div className="grid gap-2">
        {topRecommendations.map((recommendation, index) => {
          const first = recommendation.lines[0]?.row;
          const buyStation = first?.BuyStation ?? "Unknown buy";
          const sellStation = first?.SellStation ?? "Unknown sell";
          const capital = recommendation.lines.reduce((sum, line) => sum + line.buyTotalIsk, 0);
          const profit = recommendation.lines.reduce((sum, line) => sum + line.profitTotalIsk, 0);
          const volume = recommendation.lines.reduce((sum, line) => sum + line.volumeM3, 0);
          const totalJumps = recommendation.lines.reduce((sum, line) => sum + Math.max(0, Number(line.row?.TotalJumps ?? 0)), 0);
          const roi = capital > 0 ? (profit / capital) * 100 : 0;
          const warningsCount = recommendation.warnings.length + recommendation.blockers.length;
          return (
            <div key={recommendation.id} className="rounded-sm border border-eve-border/40 bg-black/20 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-eve-dim">#{index + 1}</span>
                <span className="rounded-sm border border-eve-accent/40 px-1 py-0 text-[10px] text-eve-accent">{recommendation.action}</span>
                <span className="rounded-sm border border-eve-border/40 px-1 py-0 text-[10px] text-eve-dim">{recommendation.kind}</span>
                <span className="text-eve-text">{buyStation} → {sellStation}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-eve-dim">
                <span>Profit {formatISK(profit)}</span><span>Capital {formatISK(capital)}</span><span>ROI {roi.toFixed(1)}%</span><span>Cargo {volume.toLocaleString("en-US")} m3</span><span>ISK/jump {formatISK(totalJumps > 0 ? profit / totalJumps : 0)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-eve-dim">
                <span>Execution {(recommendation.scoreBreakdown.executionQuality * 100).toFixed(0)}%</span>
                <span>Fill {(recommendation.scoreBreakdown.fillConfidence * 100).toFixed(0)}%</span>
                <span>Risk {(recommendation.scoreBreakdown.penalties * 100).toFixed(0)}%</span>
                <span>Movement {(recommendation.scoreBreakdown.movement * 100).toFixed(0)}%</span>
                <span>Warnings {warningsCount}</span>
              </div>
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
              {expandedId === recommendation.id ? (
                <div className="mt-2">
                  <div className="text-eve-dim">Reasons: {recommendation.reasons.join(" • ") || "—"}</div>
                  <div className="text-amber-200">Warnings: {recommendation.warnings.join(" • ") || "—"}</div>
                  <div className="text-rose-300">Blockers: {recommendation.blockers.join(" • ") || "—"}</div>
                  <div className="mt-1 overflow-x-auto">
                    <table className="min-w-full text-[10px]">
                      <thead><tr className="text-eve-dim"><th className="px-1 py-0.5 text-left">Item</th><th className="px-1 py-0.5 text-right">Qty</th><th className="px-1 py-0.5 text-right">Buy</th><th className="px-1 py-0.5 text-right">Sell</th><th className="px-1 py-0.5 text-right">Profit</th></tr></thead>
                      <tbody>
                        {recommendation.lines.map((line) => (
                          <tr key={`${recommendation.id}:${line.typeId}:${line.qty}`} className="border-t border-eve-border/30"><td className="px-1 py-0.5">{line.typeName}</td><td className="px-1 py-0.5 text-right">{line.qty.toLocaleString("en-US")}</td><td className="px-1 py-0.5 text-right">{formatISK(line.buyTotalIsk)}</td><td className="px-1 py-0.5 text-right">{formatISK(line.sellTotalIsk)}</td><td className="px-1 py-0.5 text-right text-eve-accent">{formatISK(line.profitTotalIsk)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
