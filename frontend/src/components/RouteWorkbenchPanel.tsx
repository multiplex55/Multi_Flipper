import { useMemo, useState } from "react";
import { deriveExecutionSummary } from "@/lib/savedRouteExecution";
import { formatISK } from "@/lib/format";
import type { AuthCharacter, SavedRoutePack } from "@/lib/types";
import type { RouteAssignment } from "@/lib/routeAssignments";
import {
  getVerificationFreshness,
  verificationProfiles,
} from "@/lib/verificationProfiles";
import { RoutePilotAssignmentsPanel, type RoutePilotAssignmentEndpoints } from "@/components/RoutePilotAssignmentsPanel";
import {
  getRadiusVerificationBadgeMeta,
  getVerifyActionLabel,
  verificationStateFromSnapshot,
} from "@/lib/radiusVerificationStatus";
import { RouteFillPlannerPanel } from "@/components/RouteFillPlannerPanel";
import type { RouteFillPlannerSections, RouteFillPlannerSuggestion } from "@/lib/routeFillPlanner";

export type RouteWorkbenchMode = "summary" | "execution" | "filler" | "verification";
export type RouteWorkbenchSectionId =
  | "summary"
  | "core"
  | "filler"
  | "verification"
  | "execution"
  | "actions";

interface RouteWorkbenchPanelProps {
  pack: SavedRoutePack;
  mode: RouteWorkbenchMode;
  activeSection?: RouteWorkbenchSectionId;
  isPinned: boolean;
  verificationProfileId: string;
  onVerificationProfileChange: (profileId: string) => void;
  onVerifyNow: () => void;
  onMarkBought: (lineKey: string, qty: number) => void;
  onMarkSold: (lineKey: string, qty: number) => void;
  onMarkSkipped: (lineKey: string, reason: string) => void;
  onResetLine: (lineKey: string) => void;
  onCopySummary: () => void;
  onCopyManifest: () => void;
  onTogglePin: () => void;
  onOpenBatchBuilder: () => void;
  onScrollToTable: () => void;
  routeFillSections?: RouteFillPlannerSections;
  onAddFillSuggestionToPack?: (suggestion: RouteFillPlannerSuggestion) => void;
  onOpenFillSuggestionInBatchBuilder?: (suggestion: RouteFillPlannerSuggestion) => void;
  assignment?: RouteAssignment | null;
  onAssignmentChange?: (assignment: RouteAssignment | null) => void;
  characters?: AuthCharacter[];
  characterLocations?: Record<number, string>;
  routeEndpoints?: RoutePilotAssignmentEndpoints;
  onRecalculateLensFromCharacter?: (characterId: number) => void;
  lineFilterKeys?: string[];
}

export function RouteWorkbenchPanel({
  pack,
  mode,
  activeSection = "summary",
  isPinned,
  verificationProfileId,
  onVerificationProfileChange,
  onVerifyNow,
  onMarkBought,
  onMarkSold,
  onMarkSkipped,
  onResetLine,
  onCopySummary,
  onCopyManifest,
  onTogglePin,
  onOpenBatchBuilder,
  onScrollToTable,
  routeFillSections,
  onAddFillSuggestionToPack,
  onOpenFillSuggestionInBatchBuilder,
  assignment,
  onAssignmentChange,
  characters = [],
  characterLocations = {},
  routeEndpoints,
  onRecalculateLensFromCharacter,
  lineFilterKeys = [],
}: RouteWorkbenchPanelProps) {
  const summary = useMemo(() => deriveExecutionSummary(pack), [pack]);
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const selectedProfile = useMemo(
    () =>
      verificationProfiles.find((profile) => profile.id === verificationProfileId) ??
      verificationProfiles[0],
    [verificationProfileId],
  );
  const freshness = getVerificationFreshness(pack.lastVerifiedAt, selectedProfile);
  const verificationState = verificationStateFromSnapshot({
    snapshot: pack.verificationSnapshot,
    lastVerifiedAt: pack.lastVerifiedAt,
    verificationProfileId,
  });
  const verificationBadge = getRadiusVerificationBadgeMeta(verificationState);

  const lines = Object.values(pack.lines).sort((a, b) => a.typeName.localeCompare(b.typeName));
  const visibleLineSet = new Set(lineFilterKeys);
  const visibleLines =
    visibleLineSet.size > 0
      ? lines.filter((line) => visibleLineSet.has(line.lineKey))
      : lines;
  const selectedCoreCount = pack.selectedLineKeys.length;
  const fillerCount = Math.max(0, lines.length - selectedCoreCount);
  const selectedLineKeys = new Set(pack.selectedLineKeys);
  const selectedCargoM3 = lines
    .filter((line) => selectedLineKeys.has(line.lineKey))
    .reduce((sum, line) => sum + line.plannedVolume, 0);
  const selectedCapitalIsk = lines
    .filter((line) => selectedLineKeys.has(line.lineKey))
    .reduce((sum, line) => sum + line.plannedQty * line.plannedBuyPrice, 0);
  const selectedProfitIsk = lines
    .filter((line) => selectedLineKeys.has(line.lineKey))
    .reduce((sum, line) => sum + line.plannedProfit, 0);
  const cargoCapacityM3 = Math.max(
    lines.reduce((sum, line) => sum + line.plannedVolume, 0),
    selectedCargoM3,
  );
  const remainingCargoM3 = Math.max(0, cargoCapacityM3 - selectedCargoM3);

  return (
    <section
      className="mt-2 rounded-sm border border-eve-border/40 bg-eve-dark/30 p-2"
      data-testid={`route-workbench-panel:${pack.routeKey}`}
      aria-label="Route workbench panel"
    >
      <header
        className="mb-2 flex flex-wrap items-center gap-1 text-[11px]"
        data-testid="route-workbench-header"
      >
        <span className="font-semibold text-eve-text">{pack.routeLabel}</span>
        <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5" data-testid="route-workbench-pin-state">
          {isPinned ? "Pinned" : "Not pinned"}
        </span>
        <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 capitalize" data-testid="route-workbench-status">
          {pack.status}
        </span>
        {assignment && (
          <span className="rounded-sm border border-indigo-400/60 px-1.5 py-0.5" data-testid="route-workbench-assignment">
            {assignment.assignedCharacterName} · {assignment.status}
          </span>
        )}
        <span className={`rounded-sm border px-1.5 py-0.5 ${verificationBadge.className}`} data-testid="route-workbench-freshness">
          Verification: {verificationBadge.label} · {freshness}
        </span>
      </header>

      {(mode === "summary" || activeSection === "summary") && (
        <section className="mb-2" data-testid="route-workbench-section-summary" aria-label="Summary metrics">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-eve-dim">Summary metrics</div>
          <div className="flex flex-wrap gap-1 text-[11px]">
            <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5">{summary.completedCount + summary.skippedCount} / {summary.totalLines} complete</span>
            <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5">{Math.round(summary.boughtPlannedRatio * 100)}% capital deployed</span>
            <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5">{Math.round((1 - (summary.remainingExpectedProfit / Math.max(1, pack.summarySnapshot.routeTotalProfit))) * 100)}% expected profit captured</span>
            <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5">Realized {formatISK(summary.realizedProfit)}</span>
          </div>
        </section>
      )}

      {(mode === "summary" || mode === "execution" || activeSection === "core") && (
        <section className="mb-2" data-testid="route-workbench-section-core" aria-label="Core batch block">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-eve-dim">Core batch block</div>
          <div className="text-[11px] text-eve-dim">
            Core lines: <span className="text-eve-text">{selectedCoreCount}</span> · Planned profit{" "}
            <span className="text-eve-text">{formatISK(pack.summarySnapshot.routeTotalProfit)}</span>
          </div>
        </section>
      )}

      {(mode === "filler" || activeSection === "filler") && (
        <section className="mb-2" data-testid="route-workbench-section-filler" aria-label="Route fill planner">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-eve-dim">Route fill planner</div>
          <div className="mb-2 text-[11px] text-eve-dim">
            Candidate fill opportunities from saved pack scope: <span className="text-eve-text">{fillerCount}</span>
          </div>
          {routeFillSections && onAddFillSuggestionToPack && onOpenFillSuggestionInBatchBuilder ? (
            <RouteFillPlannerPanel
              sections={routeFillSections}
              onAddToRoutePack={onAddFillSuggestionToPack}
              onOpenBatchBuilderSelection={onOpenFillSuggestionInBatchBuilder}
              metrics={{
                selectedCargoM3,
                cargoCapacityM3,
                remainingCargoM3,
                selectedCapitalIsk,
                selectedProfitIsk,
              }}
            />
          ) : null}
        </section>
      )}

      {(mode === "verification" || activeSection === "verification") && (
        <section className="mb-2" data-testid="route-workbench-section-verification" aria-label="Verification block">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-eve-dim">Verification block</div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
            <label className="inline-flex items-center gap-1">
              <span className="text-eve-dim">Verification profile</span>
              <select
                aria-label="Verification profile"
                className="rounded-sm border border-eve-border/60 bg-eve-dark px-1 py-0.5 text-[11px]"
                value={verificationProfileId}
                onChange={(event) => onVerificationProfileChange(event.target.value)}
              >
                {verificationProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-eve-dim">
              Last verified: {pack.lastVerifiedAt ? new Date(pack.lastVerifiedAt).toLocaleString() : "never"}
            </span>
            <button
              type="button"
              onClick={onVerifyNow}
              className="rounded-sm border border-eve-border/60 px-1 py-0.5"
              data-testid="route-workbench-verify-now"
            >
              {getVerifyActionLabel(verificationState)}
            </button>
          </div>
        </section>
      )}

      {(mode === "execution" || activeSection === "execution") && (
        <section className="mb-2" data-testid="route-workbench-section-execution" aria-label="Execution block">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-eve-dim">Execution block</div>
          <div className="space-y-1">
            {visibleLines.map((line) => {
              const qty = Math.max(0, Number(qtyByLine[line.lineKey] ?? 1) || 0);
              return (
                <div key={line.lineKey} className="flex flex-wrap items-center gap-1 rounded-sm border border-eve-border/40 px-1.5 py-1 text-[11px]">
                  <span className="min-w-[140px] text-eve-text">{line.typeName}</span>
                  <span className="text-eve-dim">{line.status}</span>
                  <span className="text-eve-dim">{line.soldQty}/{line.plannedQty} sold</span>
                  <span className="text-eve-dim">remain {line.remainingQty}</span>
                  <input
                    aria-label={`qty-${line.lineKey}`}
                    data-testid={`route-workbench-qty:${line.lineKey}`}
                    type="number"
                    min={0}
                    step={1}
                    className="w-16 rounded-sm border border-eve-border/60 bg-eve-dark px-1 py-0.5"
                    value={qtyByLine[line.lineKey] ?? "1"}
                    onChange={(event) =>
                      setQtyByLine((prev) => ({
                        ...prev,
                        [line.lineKey]: event.target.value,
                      }))
                    }
                  />
                  <button type="button" onClick={() => onMarkBought(line.lineKey, qty)} className="rounded-sm border border-eve-border/60 px-1 py-0.5">Bought</button>
                  <button type="button" onClick={() => onMarkSold(line.lineKey, qty)} className="rounded-sm border border-eve-border/60 px-1 py-0.5">Sold</button>
                  <button type="button" onClick={() => onMarkSkipped(line.lineKey, "manual skip")} className="rounded-sm border border-eve-border/60 px-1 py-0.5">Skip</button>
                  <button type="button" onClick={() => onResetLine(line.lineKey)} className="rounded-sm border border-eve-border/60 px-1 py-0.5">Reset</button>
                  <span className="ml-auto font-mono text-eve-dim">{formatISK(line.soldTotal - line.boughtTotal)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-wrap gap-1 border-t border-eve-border/40 pt-2" data-testid="route-workbench-actions" aria-label="Action row">
        <button type="button" onClick={onCopySummary} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-[11px]" data-testid="route-workbench-action-copy-summary">
          Copy summary
        </button>
        <button type="button" onClick={onCopyManifest} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-[11px]" data-testid="route-workbench-action-copy-manifest">
          Copy manifest
        </button>
        <button type="button" onClick={onTogglePin} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-[11px]" data-testid="route-workbench-action-pin" aria-pressed={isPinned}>
          {isPinned ? "Unpin" : "Pin"}
        </button>
        <button type="button" onClick={onOpenBatchBuilder} className="rounded-sm border border-eve-accent/60 px-1.5 py-0.5 text-[11px] text-eve-accent" data-testid="route-workbench-action-open-batch">
          Open batch builder
        </button>
        <button type="button" onClick={onScrollToTable} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-[11px]" data-testid="route-workbench-action-scroll">
          Scroll to table
        </button>
      </section>
      <div className="mt-2">
        <RoutePilotAssignmentsPanel
          routeKey={pack.routeKey}
          routeLabel={pack.routeLabel}
          characters={characters}
          characterLocations={characterLocations}
          routeEndpoints={routeEndpoints}
          onAssignmentChange={onAssignmentChange}
          onRecalculateLensFromCharacter={onRecalculateLensFromCharacter}
        />
      </div>
    </section>
  );
}
