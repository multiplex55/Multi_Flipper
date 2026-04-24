import { formatISK } from "@/lib/format";
import type { FlipResult } from "@/lib/types";
import type { FillerCandidate } from "@/lib/fillerCandidates";
import type { OneLegSuggestion } from "@/features/oneLegMode/oneLegMode";
import type { RouteVerificationResult } from "@/lib/routeManifestVerification";

export function OneLegModePanel(props: {
  enabled: boolean;
  anchor: FlipResult | null;
  batchRows: FlipResult[];
  sameEndpoint: OneLegSuggestion[];
  nextBest: OneLegSuggestion[];
  fillers: { remainingCapacityM3: number; candidates: FillerCandidate[] };
  verificationResult: RouteVerificationResult | null;
  onVerifySelection: () => void;
}) {
  const {
    enabled,
    anchor,
    batchRows,
    sameEndpoint,
    nextBest,
    fillers,
    verificationResult,
    onVerifySelection,
  } = props;

  if (!enabled || !anchor) return null;

  return (
    <div className="mt-2 rounded-sm border border-eve-border/60 bg-eve-dark/40 p-2 text-xs" data-testid="one-leg-panel">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="text-eve-accent font-semibold">One-leg mode</div>
        <div className="text-eve-dim">
          {anchor.BuySystemName} → {anchor.SellSystemName} · {batchRows.length} selected
        </div>
        <button
          type="button"
          className="ml-auto rounded-sm border border-eve-accent/50 px-2 py-0.5 text-eve-accent hover:bg-eve-accent/10"
          onClick={onVerifySelection}
        >
          Quick verify selected leg
        </button>
        {verificationResult && (
          <span
            className={`rounded-sm border px-1.5 py-0.5 ${
              verificationResult.status === "Good"
                ? "border-green-500/50 text-green-300"
                : verificationResult.status === "Reduced edge"
                  ? "border-amber-500/50 text-amber-300"
                  : "border-red-500/50 text-red-300"
            }`}
            data-testid="one-leg-verification-status"
          >
            {verificationResult.status}
          </span>
        )}
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <PanelList
          title="Same endpoint filler"
          rows={sameEndpoint}
          dataTestId="one-leg-same-endpoint"
        />
        <PanelList
          title="Along-the-way detour filler"
          rows={nextBest}
          dataTestId="one-leg-next-best"
        />
        <div className="rounded-sm border border-eve-border/50 p-2" data-testid="one-leg-fillers">
          <div className="mb-1 text-eve-dim">Backhaul/return-leg filler</div>
          <div className="mb-1 text-[11px] text-eve-dim/80">
            Remaining {fillers.remainingCapacityM3.toLocaleString(undefined, { maximumFractionDigits: 1 })}m³
          </div>
          {fillers.candidates.slice(0, 4).map((candidate) => (
            <div key={candidate.lineKey} className="flex items-center justify-between gap-2 py-0.5">
              <span className="truncate">{candidate.typeName}</span>
              <span className="text-eve-accent font-mono">+{formatISK(candidate.incrementalProfitIsk)}</span>
            </div>
          ))}
          {fillers.candidates.length === 0 && <div className="text-eve-dim">No backhaul/return-leg fillers.</div>}
        </div>
      </div>
    </div>
  );
}

function PanelList({
  title,
  rows,
  dataTestId,
}: {
  title: string;
  rows: OneLegSuggestion[];
  dataTestId: string;
}) {
  return (
    <div className="rounded-sm border border-eve-border/50 p-2" data-testid={dataTestId}>
      <div className="mb-1 text-eve-dim">{title}</div>
      {rows.slice(0, 4).map((entry) => (
        <div key={entry.lineKey} className="flex items-center justify-between gap-2 py-0.5">
          <span className="truncate">{entry.row.TypeName}</span>
          <span className="text-eve-accent font-mono">{(entry.score * 100).toFixed(1)}</span>
        </div>
      ))}
      {rows.length === 0 && <div className="text-eve-dim">No candidates.</div>}
    </div>
  );
}
