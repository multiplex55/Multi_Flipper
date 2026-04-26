import type { RadiusDealFocusCandidate } from "@/lib/radiusDealFocus";
import type { RadiusDealMovement } from "@/lib/radiusDealMovement";
import { RadiusDealMovementBadge } from "@/components/RadiusDealMovementBadge";
import { getRadiusVerificationBadgeMeta } from "@/lib/radiusVerificationStatus";
import {
  formatIskLabel,
  formatIskPerJumpLabel,
  formatM3Label,
  formatRiskLabel,
} from "@/lib/radiusDecisionGuardrails";

type RadiusDealFocusBoardProps = {
  candidates: RadiusDealFocusCandidate[];
  onVerifyRoute?: (routeKey: string) => void;
  onOpenBatchBuilderForRoute?: (routeKey: string) => void;
  onCopyChecklist?: (routeKey: string) => void;
  onCopyManifest?: (routeKey: string) => void;
  onOpenRouteWorkbench: (routeKey: string) => void;
  movementByRouteKey?: Record<string, RadiusDealMovement>;
};

const ACTION_LABEL: Record<RadiusDealFocusCandidate["recommendedAction"], string> = {
  buy: "Buy",
  verify: "Verify",
  trim: "Trim",
  skip: "Skip",
};

export function RadiusDealFocusBoard({
  candidates,
  onVerifyRoute,
  onOpenBatchBuilderForRoute,
  onCopyChecklist,
  onCopyManifest,
  onOpenRouteWorkbench,
  movementByRouteKey = {},
}: RadiusDealFocusBoardProps) {
  if (candidates.length === 0) {
    return (
      <section className="shrink-0 px-2 pb-1" data-testid="radius-deal-focus-board">
        <div className="rounded-sm border border-eve-border bg-eve-dark/40 px-2 py-1.5 text-[11px] text-eve-dim">
          No deal focus candidates.
        </div>
      </section>
    );
  }

  return (
    <section className="shrink-0 px-2 pb-1" data-testid="radius-deal-focus-board">
      <div className="rounded-sm border border-eve-border bg-eve-dark/40 px-2 py-1.5">
        <h3 className="text-[11px] uppercase tracking-wider text-eve-dim">Radius deal focus</h3>
        <div className="mt-1 grid gap-1 text-[11px]">
          {candidates.slice(0, 8).map((candidate) => {
            const verificationBadge = getRadiusVerificationBadgeMeta(candidate.verificationState);
            const movement = movementByRouteKey[candidate.routeKey];
            return (
              <article
                key={`${candidate.kind}:${candidate.routeKey}`}
                className="rounded-sm border border-eve-border/50 bg-eve-panel/20 px-1.5 py-1"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-eve-accent">{candidate.title}</span>
                  <span className="text-eve-text">{candidate.routeLabel}</span>
                  <span className="text-eve-dim">
                    {candidate.buyStation} → {candidate.sellStation}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                  <span className="text-green-300">{formatIskLabel(candidate.expectedProfitIsk)}</span>
                  <span className="text-eve-accent">{formatIskLabel(candidate.capitalIsk)} cap</span>
                  <span className="text-eve-dim">{formatM3Label(candidate.cargoM3)}</span>
                  <span className="text-eve-accent">{formatIskPerJumpLabel(candidate.iskPerJump)}</span>
                  <span className="text-eve-dim">{candidate.itemSummary}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="rounded-sm border border-eve-border/60 px-1 py-0 text-eve-dim">
                    conf {candidate.confidenceScore.toFixed(0)}
                  </span>
                  <span className="rounded-sm border border-eve-border/60 px-1 py-0 text-eve-dim">
                    exec {candidate.executionQuality.toFixed(0)}
                  </span>
                  <span className="rounded-sm border border-eve-border/60 px-1 py-0 text-eve-dim">
                    {formatRiskLabel(candidate.trapRisk)}
                  </span>
                  <span className={`rounded-sm border px-1 py-0 ${verificationBadge.className}`}>
                    {verificationBadge.label}
                  </span>
                  <RadiusDealMovementBadge movement={movement} />
                  <span className="rounded-sm border border-indigo-500/60 bg-indigo-500/10 px-1 py-0 text-indigo-100">
                    {ACTION_LABEL[candidate.recommendedAction]}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                  <button type="button" className="rounded-sm border border-amber-400/60 px-1.5 py-0.5 text-amber-200" onClick={() => onVerifyRoute?.(candidate.routeKey)}>Verify</button>
                  <button type="button" className="rounded-sm border border-eve-border/70 px-1.5 py-0.5 text-eve-accent" onClick={() => onOpenBatchBuilderForRoute?.(candidate.routeKey)}>Open Batch</button>
                  <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim" onClick={() => onCopyChecklist?.(candidate.routeKey)}>Copy checklist</button>
                  <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim" onClick={() => onCopyManifest?.(candidate.routeKey)}>Copy manifest</button>
                  <button type="button" className="rounded-sm border border-blue-400/60 px-1.5 py-0.5 text-blue-200" onClick={() => onOpenRouteWorkbench(candidate.routeKey)}>Open workbench</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
