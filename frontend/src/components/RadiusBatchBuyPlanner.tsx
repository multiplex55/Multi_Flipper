import { useMemo, useState } from "react";
import { formatISK } from "@/lib/format";
import type { RadiusBuyRecommendation } from "@/lib/radiusBuyRecommendation";

type SortKey = "rank" | "action" | "kind" | "stations" | "items" | "profit" | "iskJump" | "cargoUsed" | "remaining" | "capital" | "roi" | "jumps" | "fill" | "risk" | "verification";

type Props = {
  recommendations: RadiusBuyRecommendation[];
  mode: string;
  onModeChange: (mode: string) => void;
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
      <h3 className="text-eve-text">Radius Buy Planner</h3>
      <label className="flex items-center gap-1 text-eve-dim">Mode
        <select aria-label="planner-mode" value={mode} onChange={(event) => onModeChange(event.target.value)} className="rounded-sm border border-eve-border/60 bg-black/30 px-1 py-0.5">
          <option value="throughput">Throughput</option>
          <option value="risk_off">Risk-off</option>
          <option value="balanced">Balanced</option>
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
            const verification = recommendation.verificationSlots?.length ?? 0;
            const fill = Number(recommendation.scoreBreakdown?.fillConfidence ?? 0);
            const risk = Number(recommendation.scoreBreakdown?.penalties ?? 0);
            return <tr key={recommendation.id} className="border-t border-eve-border/30">
              <td className="px-1 py-1">#{rank}</td><td>{recommendation.action}</td><td>{recommendation.kind}</td>
              <td>{first?.BuyStation ?? "?"} → {first?.SellStation ?? "?"}</td>
              <td>{recommendation.lines.length}</td><td>{formatISK(recommendation.batchProfitIsk)}</td><td>{formatISK(recommendation.batchIskPerJump)}</td>
              <td>{recommendation.cargoUsedPercent.toFixed(1)}%</td><td>{recommendation.remainingCargoM3.toLocaleString("en-US")} m3</td><td>{formatISK(recommendation.batchCapitalIsk)}</td>
              <td>{recommendation.batchRoiPercent.toFixed(1)}%</td><td>{recommendation.totalJumps}</td><td>{(fill * 100).toFixed(0)}%</td><td>{(risk * 100).toFixed(0)}%</td><td>{verification}</td>
              <td className="space-x-1"><button type="button" onClick={() => onOpenBatchBuilder(recommendation)}>Open</button><button type="button" onClick={() => onCopyManifest(recommendation)}>Manifest</button><button type="button" onClick={() => onVerify(recommendation)}>Verify</button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}

function getSortValue(recommendation: RadiusBuyRecommendation, rank: number, key: SortKey): number | string {
  const first = recommendation.lines[0]?.row;
  switch (key) {
    case "rank": return rank;
    case "action": return recommendation.action;
    case "kind": return recommendation.kind;
    case "stations": return `${first?.BuyStation ?? ""}-${first?.SellStation ?? ""}`;
    case "items": return recommendation.lines.length;
    case "profit": return recommendation.batchProfitIsk;
    case "iskJump": return recommendation.batchIskPerJump;
    case "cargoUsed": return recommendation.cargoUsedPercent;
    case "remaining": return recommendation.remainingCargoM3;
    case "capital": return recommendation.batchCapitalIsk;
    case "roi": return recommendation.batchRoiPercent;
    case "jumps": return recommendation.totalJumps;
    case "fill": return Number(recommendation.scoreBreakdown?.fillConfidence ?? 0);
    case "risk": return Number(recommendation.scoreBreakdown?.penalties ?? 0);
    case "verification": return recommendation.verificationSlots?.length ?? 0;
  }
}
