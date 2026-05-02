import { formatISK } from "@/lib/format";
import type { RadiusDecisionQueueItem } from "@/lib/radiusDecisionQueue";

type Props = { recommendation: RadiusDecisionQueueItem };

export function RadiusBuyRecommendationDetails({ recommendation }: Props) {
  return <div className="mt-2 space-y-2 text-[10px]" data-testid="recommendation-details">
    <section><h4>Reasons</h4><ul>{recommendation.reasons.length ? recommendation.reasons.map((reason) => <li key={reason}>• {reason}</li>) : <li>• none</li>}</ul></section>
    <section><h4>Warnings</h4><ul>{recommendation.warnings.length ? recommendation.warnings.map((warning) => <li key={warning}>• {warning}</li>) : <li>• none</li>}</ul></section>
    <section><h4>Blockers</h4><ul>{recommendation.blockers.length ? recommendation.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>) : <li>• none</li>}</ul></section>
    <section><h4>Score breakdown</h4><div>Profit {Number(recommendation.scoreBreakdown.positive.profit ?? 0).toFixed(2)} | ISK/jump {Number(recommendation.scoreBreakdown.positive.iskPerJump ?? 0).toFixed(2)} | Fill {Number(recommendation.scoreBreakdown.positive.fillConfidence ?? 0).toFixed(2)} | Penalty {Number(recommendation.scoreBreakdown.totalPenalty ?? 0).toFixed(2)}</div></section>
    <section><h4>Package metrics</h4><div>Profit {formatISK(recommendation.packageMetrics.batchProfitIsk)} | Capital {formatISK(recommendation.packageMetrics.batchCapitalIsk)} | ROI {recommendation.packageMetrics.batchRoiPercent.toFixed(1)}% | Jumps {recommendation.packageMetrics.totalJumps}</div></section>
    <section>
      <h4>Item lines</h4>
      <div className="overflow-x-auto"><table className="min-w-full"><thead><tr><th>Item</th><th>Qty</th><th>Buy</th><th>Sell</th><th>Profit</th></tr></thead><tbody>{recommendation.lines.map((line) => <tr key={`${recommendation.id}-${line.typeId}`}><td>{line.typeName}</td><td>{line.qty}</td><td>{formatISK(line.buyTotalIsk)}</td><td>{formatISK(line.sellTotalIsk)}</td><td>{formatISK(line.profitTotalIsk)}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
