import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OpportunityExplanation } from "@/lib/opportunityScore";
import { explainOpportunityScore } from "@/lib/opportunityScore";

interface OpportunityScorePopoverProps {
  explanation: OpportunityExplanation;
  label?: string;
  className?: string;
}

const factorLabels: Record<string, string> = {
  profit: "Profit",
  risk: "Risk",
  velocity: "Velocity",
  jumps: "Jumps",
  capital: "Capital",
};

function formatRaw(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 100) return value.toFixed(1);
  return value.toFixed(2);
}

export function OpportunityScoreDetails({ explanation }: { explanation: OpportunityExplanation }) {
  const rationale = useMemo(() => explainOpportunityScore(explanation), [explanation]);
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
              {factorLabels[item.factor]}: +{item.contribution.toFixed(1)}
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
              <td className="py-1 text-right font-mono">{factor.contribution.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-eve-dim">Ranks highly because: {rationale}</div>
    </>
  );
}

export function OpportunityScorePopover({
  explanation,
  label = "Why this score?",
  className = "",
}: OpportunityScorePopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        className="text-[11px] px-1.5 py-0.5 rounded border border-eve-border/70 text-eve-dim hover:text-eve-accent hover:border-eve-accent/60"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {label}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Score explanation"
          className="absolute right-0 top-[calc(100%+6px)] z-[220] w-[360px] max-w-[90vw] rounded-sm border border-eve-border bg-eve-dark shadow-eve-glow-strong p-3 text-xs"
        >
          <OpportunityScoreDetails explanation={explanation} />
        </div>
      )}
    </div>
  );
}
