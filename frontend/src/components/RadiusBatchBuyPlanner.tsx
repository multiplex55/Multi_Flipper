import { useMemo, useState } from "react";
import { formatISK } from "@/lib/format";
import type { BuyPlannerMode, RadiusBuyRecommendation } from "@/lib/radiusBuyRecommendation";

type SortKey = "rank" | "action" | "kind" | "stations" | "items" | "profit" | "iskJump" | "cargoUsed" | "remaining" | "capital" | "roi" | "jumps" | "fill" | "risk" | "verification";

type Props = {
  recommendations: RadiusBuyRecommendation[];
  mode: BuyPlannerMode;
  onModeChange: (mode: BuyPlannerMode) => void;
  onOpenBatchBuilder: (recommendation: RadiusBuyRecommendation) => void;
  onCopyManifest: (recommendation: RadiusBuyRecommendation) => void;
  onVerify: (recommendation: RadiusBuyRecommendation) => void;
};

export function RadiusBatchBuyPlanner({ recommendations, mode, onModeChange, onOpenBatchBuilder, onCopyManifest, onVerify }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [dir, setDir] = useState<1 | -1>(1);

  const sorted = useMemo(() => {
    const rows = recommendations.map((recommendation, index) => ({ recommendation, rank: index + 1 }));
    rows.sort((a, b) => {
      const av = getSortValue(a.recommendation, a.rank, sortKey);
      const bv = getSortValue(b.recommendation, b.rank, sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.rank - b.rank;
    });
    return rows;
  }, [dir, recommendations, sortKey]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) setDir((prev) => (prev === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setDir(1);
    }
  };

  return <section className="rounded-sm border border-eve-border/60 bg-eve-dark/25 p-2 text-[11px]" data-testid="radius-batch-buy-planner">
    <div className="mb-2 flex items-center justify-between gap-2">
      <div>
        <h3 className="text-eve-text">Radius Buy Planner</h3>
        <p className="text-[10px] text-eve-dim">Active mode: <span data-testid="planner-mode-summary">{mode}</span></p>
      </div>
      <label className="flex items-center gap-1 text-eve-dim">Mode
        <select aria-label="planner-mode" value={mode} onChange={(event) => onModeChange(event.target.value as BuyPlannerMode)} className="rounded-sm border border-eve-border/60 bg-black/30 px-1 py-0.5">
          <option value="balanced">balanced</option>
          <option value="batch_profit">batch_profit</option>
          <option value="batch_isk_per_jump">batch_isk_per_jump</option>
          <option value="cargo_fill">cargo_fill</option>
          <option value="long_haul_worth">long_haul_worth</option>
          <option value="low_capital">low_capital</option>
        </select>
      </label>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-left">
        <thead className="text-eve-dim">
          <tr>{[
            ["rank", "Rank"], ["action", "Action"], ["kind", "Package"], ["stations", "Stations"], ["items", "Items"], ["profit", "Profit"], ["iskJump", "ISK/jump"], ["cargoUsed", "Cargo use"], ["remaining", "Remaining"], ["capital", "Capital"], ["roi", "ROI"], ["jumps", "Jumps"], ["fill", "Fill"], ["risk", "Risk"], ["verification", "Verification"],
          ].map(([key, label]) => <th key={key} className="px-1 py-1"><button type="button" onClick={() => onSort(key as SortKey)}>{label}</button></th>)}<th className="px-1 py-1">Actions</th></tr>
        </thead>
        <tbody>
          {sorted.map(({ recommendation, rank }) => {
            const first = recommendation.lines[0]?.row;
            const fill = Number(recommendation.packageMetrics?.averageFillConfidencePct ?? 0);
            const risk = Number(recommendation.packageMetrics?.riskCount ?? 0);
            const slippage = Number(recommendation.packageMetrics?.weightedSlippagePct ?? 0);
            const verificationText = formatVerificationState(recommendation.verificationState);
            return <tr key={recommendation.id} className="border-t border-eve-border/30">
              <td className="px-1 py-1">#{rank}</td><td>{recommendation.action}</td><td>{recommendation.kind}</td>
              <td>{first?.BuyStation ?? "?"} → {first?.SellStation ?? "?"}</td>
              <td>{recommendation.lines.length}</td><td>{formatISK(recommendation.packageMetrics.batchProfitIsk)}</td><td>{formatISK(recommendation.packageMetrics.batchIskPerJump)}</td>
              <td>{recommendation.packageMetrics.cargoUsedPercent.toFixed(1)}%</td><td>{recommendation.remainingCargoM3.toLocaleString("en-US")} m3</td><td>{formatISK(recommendation.packageMetrics.batchCapitalIsk)}</td>
              <td>{recommendation.packageMetrics.batchRoiPercent.toFixed(1)}%</td><td>{recommendation.packageMetrics.totalJumps}</td><td>{fill.toFixed(0)}%</td><td>{risk.toFixed(0)} ({slippage.toFixed(1)}%)</td><td title={verificationText}>{verificationText}</td>
              <td className="space-x-1"><button type="button" onClick={() => onOpenBatchBuilder(recommendation)}>Open</button><button type="button" onClick={() => onCopyManifest(recommendation)}>Manifest</button><button type="button" onClick={() => onVerify(recommendation)}>Verify</button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}

function formatVerificationState(state: RadiusBuyRecommendation["verificationState"]): string {
  if (!state || state.status === "not_verified") return "Not verified";
  if (state.status === "stale") return "Stale";
  if (state.status === "failed") {
    const delta = Number(state.profitDeltaIsk ?? state.priceDeltaIsk ?? 0);
    return Number.isFinite(delta) && delta !== 0 ? `Failed: profit delta ${formatISK(delta)}` : "Failed: review needed";
  }
  if (state.status === "verified") {
    if (!state.checkedAt) return "Verified";
    const checkedAtMs = new Date(state.checkedAt).getTime();
    if (!Number.isFinite(checkedAtMs)) return "Verified";
    const minutesAgo = Math.max(0, Math.floor((Date.now() - checkedAtMs) / 60_000));
    if (minutesAgo < 1) return "Verified just now";
    return `Verified ${minutesAgo}m ago`;
  }
  return "Not verified";
}

function getSortValue(recommendation: RadiusBuyRecommendation, rank: number, key: SortKey): number | string {
  const first = recommendation.lines[0]?.row;
  switch (key) {
    case "rank": return rank;
    case "action": return recommendation.action;
    case "kind": return recommendation.kind;
    case "stations": return `${first?.BuyStation ?? ""}-${first?.SellStation ?? ""}`;
    case "items": return recommendation.lines.length;
    case "profit": return recommendation.packageMetrics.batchProfitIsk;
    case "iskJump": return recommendation.packageMetrics.batchIskPerJump;
    case "cargoUsed": return recommendation.packageMetrics.cargoUsedPercent;
    case "remaining": return recommendation.remainingCargoM3;
    case "capital": return recommendation.packageMetrics.batchCapitalIsk;
    case "roi": return recommendation.packageMetrics.batchRoiPercent;
    case "jumps": return recommendation.packageMetrics.totalJumps;
    case "fill": return Number(recommendation.packageMetrics.averageFillConfidencePct ?? 0);
    case "risk": return Number(recommendation.packageMetrics.riskCount ?? 0);
    case "verification": return recommendation.verificationSlots?.length ?? 0;
  }
}
