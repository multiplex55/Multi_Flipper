import { formatISK } from "@/lib/format";
import { ExplanationPopoverShell } from "@/components/decision/ExplanationPopoverShell";
import { RadiusDealExplanationPanel } from "@/components/RadiusDealExplanationPanel";
import type { RadiusBestDealCard } from "@/lib/radiusBestDealCards";
import type { RouteQueueEntry } from "@/lib/routeQueue";
import type { RouteAssignment } from "@/lib/routeAssignments";
import { getRadiusRouteExecutionBadge } from "@/lib/radiusRouteStatus";
import { classifyVerificationPriority } from "@/lib/radiusVerificationPriority";
import {
  getRadiusVerificationBadgeMeta,
  getVerifyActionLabel,
  type RadiusVerificationState,
  verificationStateFromPriority,
  dedupeVerificationTargets,
} from "@/lib/radiusVerificationStatus";
import { RouteAssignmentQuickActions } from "@/components/RouteAssignmentQuickActions";
import type { AuthCharacter } from "@/lib/types";

type RadiusBestDealStripProps = {
  bestDealCards: RadiusBestDealCard[];
  onOpenBatchBuilderForRoute?: (routeKey: string) => void;
  onOpenRouteWorkbench: (
    routeKey: string,
    mode?: "summary" | "execution" | "filler" | "verification",
  ) => void;
  onOpenInsights: () => void;
  insightsOpen: boolean;
  routeQueueEntries?: RouteQueueEntry[];
  assignmentByRouteKey?: Record<string, RouteAssignment>;
  verificationStateByRouteKey?: Record<string, RadiusVerificationState>;
  onVerifyRoute?: (routeKey: string) => void;
  characters?: AuthCharacter[];
  onAssignActive?: (routeKey: string) => void;
  onAssignBest?: (routeKey: string) => void;
  onAssignSpecificPilot?: (routeKey: string, characterId: number) => void;
  onSetStagedSystem?: (routeKey: string, stagedSystem: string) => void;
  showAssignmentActions?: boolean;
};

export function RadiusBestDealStrip({
  bestDealCards,
  onOpenBatchBuilderForRoute,
  onOpenRouteWorkbench,
  onOpenInsights,
  insightsOpen,
  routeQueueEntries = [],
  assignmentByRouteKey = {},
  verificationStateByRouteKey = {},
  onVerifyRoute,
  characters = [],
  onAssignActive,
  onAssignBest,
  onAssignSpecificPilot,
  onSetStagedSystem,
  showAssignmentActions = false,
}: RadiusBestDealStripProps) {
  const maxCards = 3;
  const visibleCards = bestDealCards.slice(0, maxCards);
  const verificationSignals = bestDealCards.slice(0, 3).map((card) => {
    const priority = classifyVerificationPriority({
      expectedProfitIsk: card.expectedProfitIsk,
      totalJumps: card.totalJumps,
      scanAgeMinutes: card.scanAgeMinutes,
      lensJumpDelta: card.lensJumpDelta,
      urgencyBand: card.urgencyBand ?? "stable",
    });
    const state = verificationStateByRouteKey[card.routeKey] ?? verificationStateFromPriority(priority.priority);
    return {
      key: `${card.kind}:${card.routeKey}`,
      routeKey: card.routeKey,
      routeLabel: card.routeLabel,
      reason: priority.reason,
      state,
      badge: getRadiusVerificationBadgeMeta(state),
    };
  });


  const verifyTopRoutes = () => {
    if (!onVerifyRoute) return;
    const targets = dedupeVerificationTargets(visibleCards.map((card) => ({ routeKey: card.routeKey })));
    for (const target of targets) onVerifyRoute(target.routeKey);
  };

  return (
    <section className="shrink-0 px-2 pb-1" data-testid="radius-best-deal-strip">
      <div className="rounded-sm border border-eve-border bg-eve-dark/40 px-2 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[11px] uppercase tracking-wider text-eve-dim">
              Radius route insights
            </h3>
            {visibleCards.length > 0 ? (
              <div className="mt-0.5 grid gap-1 text-[11px]">
                {visibleCards.map((card) => {
                  const routeBadge = getRadiusRouteExecutionBadge(card.routeKey, routeQueueEntries, assignmentByRouteKey);
                  const verificationPriority = classifyVerificationPriority({
                    expectedProfitIsk: card.expectedProfitIsk,
                    totalJumps: card.totalJumps,
                    scanAgeMinutes: card.scanAgeMinutes,
                    lensJumpDelta: card.lensJumpDelta,
                    urgencyBand: card.urgencyBand ?? "stable",
                  });
                  const verificationState = verificationStateByRouteKey[card.routeKey] ?? verificationStateFromPriority(verificationPriority.priority);
                  const verificationBadge = getRadiusVerificationBadgeMeta(verificationState);
                  const iskPerJump =
                    card.totalJumps > 0 ? card.expectedProfitIsk / card.totalJumps : card.expectedProfitIsk;
                  return (
                    <div
                      key={`${card.kind}:${card.routeKey}`}
                      className="rounded-sm border border-eve-border/50 bg-eve-panel/20 px-1.5 py-1"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-eve-accent">{card.title}</span>
                        <span className="truncate text-eve-text" title={card.routeLabel}>
                          {card.routeLabel}
                        </span>
                        <span className="text-green-300">{formatISK(card.expectedProfitIsk)}</span>
                        <span className="text-eve-accent">{formatISK(iskPerJump)}/jump</span>
                        <span className="text-eve-dim">{card.metricLabel}</span>
                        <span className={`rounded-sm border px-1 py-0 text-[10px] ${routeBadge.tone}`}>{routeBadge.label}</span>
                        <span
                          className={`rounded-sm border px-1 py-0 text-[10px] ${verificationBadge.className}`}
                          title={verificationPriority.reason}
                        >
                          {verificationBadge.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => onOpenBatchBuilderForRoute?.(card.routeKey)}
                          className="rounded-sm border border-eve-border/70 px-1.5 py-0.5 text-eve-accent hover:border-eve-accent/60 hover:bg-eve-accent/10"
                        >
                          Open Batch
                        </button>
                        {card.hasFillerCandidates ? (
                          <button
                            type="button"
                            onClick={() => onOpenRouteWorkbench(card.routeKey, "filler")}
                            className="rounded-sm border border-indigo-400/60 px-1.5 py-0.5 text-indigo-200 hover:bg-indigo-500/10"
                          >
                            Fill Cargo
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onVerifyRoute?.(card.routeKey)}
                          className="rounded-sm border border-amber-400/60 px-1.5 py-0.5 text-amber-200 hover:bg-amber-500/10"
                        >
                          {getVerifyActionLabel(verificationState)}
                        </button>
                        {card.whySummary ? (
                          <ExplanationPopoverShell label="Why?">
                            <RadiusDealExplanationPanel
                              routeKey={card.routeKey}
                              routeLabel={card.routeLabel}
                              explanation={card.explanation}
                              queueStatus={routeBadge.label}
                              assignment={assignmentByRouteKey[card.routeKey]?.assignedCharacterName ?? null}
                              lensDelta={card.lensDelta}
                            />
                          </ExplanationPopoverShell>
                        ) : null}
                      </div>
                      {showAssignmentActions ? (
                        <div className="mt-1">
                          <RouteAssignmentQuickActions
                            compact
                            context={{
                              routeKey: card.routeKey,
                              routeLabel: card.routeLabel,
                              expectedProfitIsk: card.expectedProfitIsk,
                              expectedJumps: card.totalJumps,
                              verificationStatusAtAssignment:
                                verificationState === "fresh"
                                  ? "Good"
                                  : verificationState === "reduced_edge"
                                    ? "Reduced edge"
                                    : verificationState === "abort"
                                      ? "Abort"
                                      : undefined,
                            }}
                            characters={characters}
                            onAssignActive={(ctx) => onAssignActive?.(ctx.routeKey)}
                            onAssignBest={(ctx) => onAssignBest?.(ctx.routeKey)}
                            onAssignSpecificPilot={(ctx, characterId) =>
                              onAssignSpecificPilot?.(ctx.routeKey, characterId)
                            }
                            onSetStagedSystem={(ctx, stagedSystem) =>
                              onSetStagedSystem?.(ctx.routeKey, stagedSystem)
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-0.5 text-[11px] text-eve-dim">No best route yet.</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <button
              type="button"
              onClick={onOpenInsights}
              className="rounded-sm border border-eve-accent/60 px-1.5 py-0.5 text-eve-accent hover:bg-eve-accent/10"
            >
              {insightsOpen ? "Close Insights" : "Open Insights"}
            </button>
            <button
              type="button"
              onClick={verifyTopRoutes}
              className="rounded-sm border border-amber-400/60 px-1.5 py-0.5 text-amber-200 hover:bg-amber-500/10"
            >
              Verify top
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
                className={`rounded-sm border px-1.5 py-0.5 text-[10px] ${signal.badge.className}`}
              >
                {signal.routeLabel} · {signal.badge.label}
              </span>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
