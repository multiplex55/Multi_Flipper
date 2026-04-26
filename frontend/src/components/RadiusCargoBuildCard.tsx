import { useState } from "react";
import { formatISK } from "@/lib/format";
import type { RadiusCargoBuild } from "@/lib/radiusCargoBuilds";
import type { RouteQueueEntry } from "@/lib/routeQueue";
import type { RouteAssignment } from "@/lib/routeAssignments";
import { getRadiusRouteExecutionBadge } from "@/lib/radiusRouteStatus";
import {
  getRadiusVerificationBadgeMeta,
  getVerifyActionLabel,
  type RadiusVerificationState,
} from "@/lib/radiusVerificationStatus";
import { RouteAssignmentQuickActions } from "@/components/RouteAssignmentQuickActions";
import { RadiusDealExplanationPanel } from "@/components/RadiusDealExplanationPanel";
import { ExplanationPopoverShell } from "@/components/decision/ExplanationPopoverShell";
import type { AuthCharacter } from "@/lib/types";
import type { RadiusDealMovement } from "@/lib/radiusDealMovement";
import { RadiusDealMovementBadge } from "@/components/RadiusDealMovementBadge";

type RadiusCargoBuildCardProps = {
  build: RadiusCargoBuild;
  onCopyManifest: (build: RadiusCargoBuild) => void;
  onCopyBuyChecklist: (build: RadiusCargoBuild) => void;
  onCopySellChecklist: (build: RadiusCargoBuild) => void;
  onVerify: (routeKey: string) => void;
  onQueue: (routeKey: string) => void;
  onOpenWorkbench: (routeKey: string) => void;
  onOpenBatch: (routeKey: string) => void;
  routeQueueEntries?: RouteQueueEntry[];
  assignmentByRouteKey?: Record<string, RouteAssignment>;
  verificationState?: RadiusVerificationState;
  characters?: AuthCharacter[];
  onAssignActive?: (routeKey: string) => void;
  onAssignBest?: (routeKey: string) => void;
  onAssignSpecificPilot?: (routeKey: string, characterId: number) => void;
  onSetStagedSystem?: (routeKey: string, stagedSystem: string) => void;
  movement?: RadiusDealMovement | null;
  showAssignmentActions?: boolean;
};

const badgeTone = {
  good: "text-emerald-300 border-emerald-400/40",
  warn: "text-amber-200 border-amber-300/40",
  bad: "text-rose-300 border-rose-400/40",
};

export function RadiusCargoBuildCard(props: RadiusCargoBuildCardProps) {
  const {
    build,
    routeQueueEntries = [],
    assignmentByRouteKey = {},
    showAssignmentActions = false,
  } = props;
  const routeBadge = getRadiusRouteExecutionBadge(build.routeKey, routeQueueEntries, assignmentByRouteKey);
  const verificationBadge = getRadiusVerificationBadgeMeta(props.verificationState ?? "unverified");
  const [expanded, setExpanded] = useState(false);
  const buildExplanation = {
    summary: `Cargo build ranks ${build.finalScore.toFixed(1)} with ${build.cargoFillPercent.toFixed(1)}% fill and ${formatISK(build.iskPerJump)}/jump.`,
    positives: [
      `Profit potential ${formatISK(build.totalProfitIsk)} with ${build.rowCount} rows`,
      `Cargo utilization ${build.cargoFillPercent.toFixed(1)}%`,
    ],
    warnings: [
      ...(build.executionCue !== "smooth" ? [`Execution cue is ${build.executionCue}`] : []),
      ...(build.riskCue !== "low" ? [`Risk cue is ${build.riskCue}`] : []),
    ],
    recommendedActions: [
      ...(build.executionCue !== "smooth" ? ["Sequence fills by depth and verify top lines before buy."] : []),
      ...(build.riskCue !== "low" ? ["Keep capital split and stage exits at safer hubs."] : []),
    ],
  };

  return (
    <div className="rounded-sm border border-eve-border/60 bg-eve-dark/30 p-2" data-testid="radius-cargo-build-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-eve-text">{build.routeLabel}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-eve-dim"><span>{build.routeKey}</span><span className={`rounded-sm border px-1 py-0 text-[10px] ${routeBadge.tone}`}>{routeBadge.label}</span><span className={`rounded-sm border px-1 py-0 text-[10px] ${verificationBadge.className}`}>{verificationBadge.label}</span><RadiusDealMovementBadge movement={props.movement} /></div>
        </div>
        <div className="text-eve-accent font-mono">Score {build.finalScore.toFixed(1)}</div>
      </div>

      <div className="mt-1 flex flex-wrap gap-3 text-eve-dim">
        <span>Profit {formatISK(build.totalProfitIsk)}</span>
        <span>Capital {formatISK(build.totalCapitalIsk)}</span>
        <span>Gross sell {formatISK(build.totalGrossSellIsk)}</span>
        <span>Cargo used {build.cargoFillPercent.toFixed(1)}%</span>
        <span>ISK/jump {formatISK(build.iskPerJump)}</span>
      </div>

      <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
        <span className={`rounded-sm border px-1 py-0.5 ${build.confidencePercent >= 70 ? badgeTone.good : build.confidencePercent >= 50 ? badgeTone.warn : badgeTone.bad}`}>
          Confidence {build.confidencePercent.toFixed(0)}%
        </span>
        <span className={`rounded-sm border px-1 py-0.5 ${build.executionCue === "smooth" ? badgeTone.good : build.executionCue === "watch" ? badgeTone.warn : badgeTone.bad}`}>
          Execution {build.executionCue}
        </span>
        <span className={`rounded-sm border px-1 py-0.5 ${build.riskCue === "low" ? badgeTone.good : build.riskCue === "moderate" ? badgeTone.warn : badgeTone.bad}`}>
          Risk {build.riskCue}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
        <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text" onClick={() => props.onCopyManifest(build)}>Copy manifest</button>
        <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text" onClick={() => props.onCopyBuyChecklist(build)}>Buy checklist</button>
        <button type="button" className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text" onClick={() => props.onCopySellChecklist(build)}>Sell checklist</button>
        <button type="button" className="rounded-sm border border-amber-400/60 px-1.5 py-0.5 text-amber-200" onClick={() => props.onVerify(build.routeKey)}>{getVerifyActionLabel(props.verificationState ?? "unverified")}</button>
        <button type="button" className="rounded-sm border border-indigo-400/60 px-1.5 py-0.5 text-indigo-200" onClick={() => props.onQueue(build.routeKey)}>Queue</button>
        <button type="button" className="rounded-sm border border-blue-500/60 px-1.5 py-0.5 text-blue-200" onClick={() => props.onOpenWorkbench(build.routeKey)}>Open workbench</button>
        <button type="button" className="rounded-sm border border-eve-accent/60 px-1.5 py-0.5 text-eve-accent" onClick={() => props.onOpenBatch(build.routeKey)}>Open batch</button>
        <ExplanationPopoverShell label="Why this build?">
          <RadiusDealExplanationPanel
            routeKey={build.routeKey}
            routeLabel={build.routeLabel}
            explanation={buildExplanation}
            executionQuality={build.executionQuality}
            queueStatus={routeBadge.label}
            assignment={assignmentByRouteKey[build.routeKey]?.assignedCharacterName ?? null}
          />
        </ExplanationPopoverShell>
      </div>
      {showAssignmentActions ? (
        <div className="mt-1">
          <RouteAssignmentQuickActions
            compact
            context={{
              routeKey: build.routeKey,
              routeLabel: build.routeLabel,
              expectedProfitIsk: build.totalProfitIsk,
              expectedCapitalIsk: build.totalCapitalIsk,
              expectedCargoM3: build.totalCargoM3,
              expectedJumps: build.jumps,
            }}
            characters={props.characters}
            onAssignActive={(ctx) => props.onAssignActive?.(ctx.routeKey)}
            onAssignBest={(ctx) => props.onAssignBest?.(ctx.routeKey)}
            onAssignSpecificPilot={(ctx, characterId) =>
              props.onAssignSpecificPilot?.(ctx.routeKey, characterId)
            }
            onSetStagedSystem={(ctx, stagedSystem) =>
              props.onSetStagedSystem?.(ctx.routeKey, stagedSystem)
            }
          />
        </div>
      ) : null}

      <div className="mt-2">
        <button type="button" className="text-[11px] text-eve-dim hover:text-eve-text" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Hide lines" : `Show lines (${build.lines.length})`}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-[10px]">
            <thead>
              <tr className="text-eve-dim">
                <th className="px-1 py-0.5 text-left">Item</th>
                <th className="px-1 py-0.5 text-right">Qty</th>
                <th className="px-1 py-0.5 text-right">Buy total</th>
                <th className="px-1 py-0.5 text-right">Sell total</th>
                <th className="px-1 py-0.5 text-right">Profit</th>
                <th className="px-1 py-0.5 text-right">m3</th>
                <th className="px-1 py-0.5 text-center">Partial</th>
                <th className="px-1 py-0.5 text-center">Exec cue</th>
              </tr>
            </thead>
            <tbody>
              {build.lines.map((line) => (
                <tr key={`${build.id}:${line.row.TypeID}:${line.units}`} className="border-t border-eve-border/40">
                  <td className="px-1 py-0.5 text-eve-text">{line.row.TypeName}</td>
                  <td className="px-1 py-0.5 text-right text-eve-dim">{line.units.toLocaleString()}</td>
                  <td className="px-1 py-0.5 text-right text-eve-dim">{formatISK(line.capitalIsk)}</td>
                  <td className="px-1 py-0.5 text-right text-eve-dim">{formatISK(line.grossSellIsk)}</td>
                  <td className="px-1 py-0.5 text-right text-eve-accent">{formatISK(line.profitIsk)}</td>
                  <td className="px-1 py-0.5 text-right text-eve-dim">{line.volumeM3.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-1 py-0.5 text-center text-eve-dim">{line.partial ? "Yes" : "No"}</td>
                  <td className="px-1 py-0.5 text-center text-eve-dim">{build.executionCue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
