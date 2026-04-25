import { formatISK } from "@/lib/format";
import { ExplanationPopoverShell } from "@/components/decision/ExplanationPopoverShell";
import type { RadiusBestDealCard } from "@/lib/radiusBestDealCards";
import {
  classifyVerificationPriority,
  verificationPriorityChipClass,
} from "@/lib/radiusVerificationPriority";

type RadiusBestDealStripProps = {
  bestDealCards: RadiusBestDealCard[];
  onOpenBatchBuilderForRoute?: (routeKey: string) => void;
  onOpenRouteWorkbench: (
    routeKey: string,
    mode?: "summary" | "execution" | "filler" | "verification",
  ) => void;
  onOpenInsights: () => void;
  insightsOpen: boolean;
};

export function RadiusBestDealStrip({
  bestDealCards,
  onOpenBatchBuilderForRoute,
  onOpenRouteWorkbench,
  onOpenInsights,
  insightsOpen,
}: RadiusBestDealStripProps) {
  const bestDeal = bestDealCards[0] ?? null;
  const verificationSignals = bestDealCards.slice(0, 3).map((card) => {
    const priority = classifyVerificationPriority({
      expectedProfitIsk: card.expectedProfitIsk,
      totalJumps: card.totalJumps,
      scanAgeMinutes: card.scanAgeMinutes,
      lensJumpDelta: card.lensJumpDelta,
      urgencyBand: card.urgencyBand ?? "stable",
    });
    return {
      key: `${card.kind}:${card.routeKey}`,
      routeLabel: card.routeLabel,
      label: priority.label,
      reason: priority.reason,
      priority: priority.priority,
    };
  });

  return (
    <section className="shrink-0 px-2 pb-1" data-testid="radius-best-deal-strip">
      <div className="rounded-sm border border-eve-border bg-eve-dark/40 px-2 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[11px] uppercase tracking-wider text-eve-dim">
              Radius route insights
            </h3>
            {bestDeal ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                <span className="truncate text-eve-text" title={bestDeal.routeLabel}>
                  {bestDeal.routeLabel}
                </span>
                <span className="text-green-300">{formatISK(bestDeal.expectedProfitIsk)}</span>
                <span className="text-eve-accent">
                  {bestDeal.totalJumps > 0
                    ? formatISK(bestDeal.expectedProfitIsk / bestDeal.totalJumps)
                    : formatISK(bestDeal.expectedProfitIsk)}
                  /jump
                </span>
              </div>
            ) : (
              <div className="mt-0.5 text-[11px] text-eve-dim">No best route yet.</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <button
              type="button"
              disabled={!bestDeal}
              onClick={() => bestDeal && onOpenBatchBuilderForRoute?.(bestDeal.routeKey)}
              className="rounded-sm border border-eve-border/70 px-1.5 py-0.5 text-eve-accent hover:border-eve-accent/60 hover:bg-eve-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Open Batch
            </button>
            <button
              type="button"
              disabled={!bestDeal?.hasFillerCandidates}
              onClick={() => bestDeal && onOpenRouteWorkbench(bestDeal.routeKey, "filler")}
              className="rounded-sm border border-indigo-400/60 px-1.5 py-0.5 text-indigo-200 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Fill Cargo
            </button>
            {bestDeal?.whySummary ? (
              <ExplanationPopoverShell label="Why?">
                <div className="text-eve-dim mb-1">{bestDeal.whySummary}</div>
                {bestDeal.lensDelta ? (
                  <div className="text-[10px] text-indigo-200">{bestDeal.lensDelta}</div>
                ) : null}
              </ExplanationPopoverShell>
            ) : null}
            <button
              type="button"
              onClick={onOpenInsights}
              className="rounded-sm border border-eve-accent/60 px-1.5 py-0.5 text-eve-accent hover:bg-eve-accent/10"
            >
              {insightsOpen ? "Close Insights" : "Open Insights"}
            </button>
          </div>
        </div>
        <div
          className="mt-1.5 flex flex-wrap items-center gap-1"
          data-testid="radius-stale-unverified-indicators"
        >
          {verificationSignals.length === 0 ? (
            <span className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-1.5 py-0.5 text-[10px] text-eve-dim">
              Verification pending
            </span>
          ) : (
            verificationSignals.map((signal) => (
              <span
                key={signal.key}
                title={`${signal.routeLabel}: ${signal.reason}`}
                className={`rounded-sm border px-1.5 py-0.5 text-[10px] ${verificationPriorityChipClass(signal.priority)}`}
              >
                {signal.routeLabel} · {signal.label}
              </span>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
