import { useMemo } from "react";
import type { OpportunityExplanation } from "@/lib/opportunityScore";
import { explainOpportunityScore } from "@/lib/opportunityScore";
import type { ExecutionQualityBreakdown } from "@/lib/executionQuality";
import { ExplanationPopoverShell } from "@/components/decision/ExplanationPopoverShell";
import { RadiusDealExplanationPanel } from "@/components/RadiusDealExplanationPanel";
import type { RouteDecisionExplanation } from "@/lib/routeExplanation";

interface OpportunityScorePopoverProps {
  explanation: OpportunityExplanation;
  label?: string;
  className?: string;
  routeExplanation?: RouteDecisionExplanation;
  routeLabel?: string;
  queueStatus?: string;
  assignment?: string;
}

const factorLabels: Record<string, string> = {
  expectedProfit: "Expected profit",
  dailyRealizableProfit: "Daily realizable",
  executionQuality: "Execution quality",
  jumpBurden: "Jump burden",
  capitalEfficiency: "Capital efficiency",
  cargoEfficiency: "Cargo efficiency",
  marketStability: "Market stability",
};

function formatRaw(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 100) return value.toFixed(1);
  return value.toFixed(2);
}

export function OpportunityScoreDetails({
  explanation,
  executionQuality,
}: {
  explanation: OpportunityExplanation;
  executionQuality?: ExecutionQualityBreakdown;
}) {
  const rationale = useMemo(() => explainOpportunityScore(explanation), [explanation]);
  return (
    <OpportunityScoreDetailsBody explanation={explanation} rationale={rationale} executionQuality={executionQuality} />
  );
}

function executionFactorLabel(factor: ExecutionQualityBreakdown["factors"][number]["factor"]): string {
  switch (factor) {
    case "fillRatio":
      return "Fill ratio";
    case "slippage":
      return "Slippage burden";
    case "depthCoverage":
      return "Top-of-book depth";
    case "history":
      return "History coverage";
    case "spike":
      return "Destination spike";
    case "stability":
      return "Price stability";
    default:
      return factor;
  }
}

function OpportunityScoreDetailsBody({
  explanation,
  rationale,
  executionQuality,
}: {
  explanation: OpportunityExplanation;
  rationale: string;
  executionQuality?: ExecutionQualityBreakdown;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-eve-dim uppercase tracking-wider">Final score</span>
        <span className="font-mono text-eve-accent">{explanation.finalScore.toFixed(1)}</span>
      </div>
      <div className="mb-2 text-eve-dim">{rationale}</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="text-[10px] text-green-300 uppercase mb-1">Top positives</div>
          {explanation.topPositives.map((item) => (
            <div key={`p-${item.factor}`} className="text-green-200/90">
              {factorLabels[item.factor]}: +{Math.abs(item.contribution).toFixed(1)}
            </div>
          ))}
        </div>
        <div>
          <div className="text-[10px] text-red-300 uppercase mb-1">Main penalties</div>
          {explanation.topPenalties.map((item) => (
            <div key={`n-${item.factor}`} className="text-red-200/90">
              {factorLabels[item.factor]}: {item.contribution.toFixed(1)}
            </div>
          ))}
        </div>
      </div>
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="text-eve-dim border-b border-eve-border/60">
            <th className="text-left py-1">Factor</th>
            <th className="text-right py-1">Raw</th>
            <th className="text-right py-1">Norm</th>
            <th className="text-right py-1">Weight</th>
            <th className="text-right py-1">Contrib</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(explanation.factors).map((factor) => (
            <tr key={factor.factor} className="border-b border-eve-border/20">
              <td className="py-1">{factorLabels[factor.factor]}</td>
              <td className="py-1 text-right font-mono">{formatRaw(factor.rawMetric)}</td>
              <td className="py-1 text-right font-mono">{factor.normalized.toFixed(1)}</td>
              <td className="py-1 text-right font-mono">{(factor.weight * 100).toFixed(0)}%</td>
              <td className="py-1 text-right font-mono">{factor.contribution > 0 ? `+${factor.contribution.toFixed(1)}` : factor.contribution.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {executionQuality && (
        <div className="mt-3 border-t border-eve-border/40 pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-eve-dim uppercase tracking-wider">Execution quality</span>
            <span className="font-mono text-eve-accent">{executionQuality.score.toFixed(1)}</span>
          </div>
          <div className="text-[10px] text-eve-dim mb-1">
            Dominant drivers: +{executionFactorLabel(executionQuality.topPositives[0].factor)}; penalty from{" "}
            {executionFactorLabel(executionQuality.topPenalties[0].factor)}.
          </div>
        </div>
      )}
      <div className="mt-2 text-eve-dim">Ranks highly because: {rationale}</div>
    </>
  );
}

export function OpportunityScorePopover({
  explanation,
  label = "Why this score?",
  className = "",
  routeExplanation,
  routeLabel = "Route context",
  queueStatus,
  assignment,
}: OpportunityScorePopoverProps) {
  const executionFactor = routeExplanation?.factors.find((item) => item.key === "execution_quality");
  return (
    <ExplanationPopoverShell label={label} className={className}>
      <OpportunityScoreDetails explanation={explanation} />
      {routeExplanation ? (
        <div className="mt-3 border-t border-eve-border/40 pt-2">
          <RadiusDealExplanationPanel
            routeKey={routeExplanation.routeKey}
            routeLabel={routeLabel}
            explanation={routeExplanation}
            executionQuality={executionFactor ? executionFactor.normalized * 100 : null}
            queueStatus={queueStatus}
            assignment={assignment}
          />
        </div>
      ) : null}
    </ExplanationPopoverShell>
  );
}
