import { useMemo, useState } from "react";
import { deriveExecutionSummary } from "@/lib/savedRouteExecution";
import { formatISK } from "@/lib/format";
import type { SavedRoutePack } from "@/lib/types";
import {
  getVerificationFreshness,
  verificationProfiles,
} from "@/lib/verificationProfiles";

interface RouteWorkbenchPanelProps {
  pack: SavedRoutePack;
  verificationProfileId: string;
  onVerificationProfileChange: (profileId: string) => void;
  onVerifyNow: () => void;
  onMarkBought: (lineKey: string, qty: number) => void;
  onMarkSold: (lineKey: string, qty: number) => void;
  onMarkSkipped: (lineKey: string, reason: string) => void;
  onResetLine: (lineKey: string) => void;
}

export function RouteWorkbenchPanel({
  pack,
  verificationProfileId,
  onVerificationProfileChange,
  onVerifyNow,
  onMarkBought,
  onMarkSold,
  onMarkSkipped,
  onResetLine,
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

  const lines = Object.values(pack.lines).sort((a, b) => a.typeName.localeCompare(b.typeName));

  return (
    <div className="mt-2 rounded-sm border border-eve-border/40 bg-eve-dark/30 p-2" data-testid={`workbench-${pack.routeKey}`}>
      <div className="mb-2 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5">{summary.completedCount + summary.skippedCount} / {summary.totalLines} complete</span>
        <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5">{Math.round(summary.boughtPlannedRatio * 100)}% capital deployed</span>
        <span className="rounded-sm border border-eve-border/60 px-1.5 py-0.5">{Math.round((1 - (summary.remainingExpectedProfit / Math.max(1, pack.summarySnapshot.routeTotalProfit))) * 100)}% expected profit captured</span>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <label className="inline-flex items-center gap-1">
          <span className="text-eve-dim">Verification profile</span>
          <select
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
        <span
          className={`rounded-sm border px-1.5 py-0.5 ${
            freshness === "fresh"
              ? "border-emerald-500/60 text-emerald-300"
              : freshness === "aging"
                ? "border-amber-500/60 text-amber-300"
                : "border-rose-500/60 text-rose-300"
          }`}
        >
          {freshness}
        </span>
        <button
          type="button"
          onClick={onVerifyNow}
          className="rounded-sm border border-eve-border/60 px-1 py-0.5"
        >
          Verify now
        </button>
      </div>

      <div className="space-y-1">
        {lines.map((line) => {
          const qty = Math.max(0, Number(qtyByLine[line.lineKey] ?? 1) || 0);
          return (
            <div key={line.lineKey} className="flex flex-wrap items-center gap-1 rounded-sm border border-eve-border/40 px-1.5 py-1 text-[11px]">
              <span className="min-w-[140px] text-eve-text">{line.typeName}</span>
              <span className="text-eve-dim">{line.status}</span>
              <span className="text-eve-dim">{line.soldQty}/{line.plannedQty} sold</span>
              <span className="text-eve-dim">remain {line.remainingQty}</span>
              <input
                aria-label={`qty-${line.lineKey}`}
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
    </div>
  );
}
