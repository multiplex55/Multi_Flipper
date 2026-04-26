import type { RouteDecisionExplanation } from "@/lib/routeExplanation";

type RadiusDealExplanationPanelProps = {
  routeKey?: string;
  routeLabel: string;
  explanation?: Pick<RouteDecisionExplanation, "summary" | "positives" | "warnings" | "recommendedActions">;
  executionQuality?: number | null;
  queueStatus?: string | null;
  assignment?: string | null;
  lensDelta?: string;
};

function statLabel(label: string, value?: string | null) {
  if (!value) return null;
  return (
    <span className="rounded-sm border border-eve-border/60 px-1 py-0.5 text-[10px] text-eve-dim">
      {label}: <span className="text-eve-text">{value}</span>
    </span>
  );
}

export function RadiusDealExplanationPanel({
  routeKey,
  routeLabel,
  explanation,
  executionQuality,
  queueStatus,
  assignment,
  lensDelta,
}: RadiusDealExplanationPanelProps) {
  const positives = explanation?.positives ?? [];
  const warnings = explanation?.warnings ?? [];
  const recommendedActions = explanation?.recommendedActions ?? [];
  const summary = explanation?.summary ?? "Route shows mixed signals across score factors.";

  return (
    <div className="space-y-2 text-[11px]">
      <div className="border-b border-eve-border/40 pb-1">
        <div className="text-eve-accent font-medium">{routeLabel}</div>
        <div className="text-[10px] text-eve-dim">
          Route context {routeKey ? `· ${routeKey}` : ""}
        </div>
      </div>
      <div className="text-eve-dim">{summary}</div>
      <div className="flex flex-wrap items-center gap-1">
        {statLabel(
          "Exec",
          executionQuality != null && Number.isFinite(executionQuality)
            ? `${executionQuality.toFixed(1)}`
            : undefined,
        )}
        {statLabel("Queue", queueStatus ?? undefined)}
        {statLabel("Assignment", assignment ?? undefined)}
      </div>
      {lensDelta ? <div className="text-[10px] text-indigo-200">{lensDelta}</div> : null}
      <section>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-green-300">Positives</div>
        {positives.length === 0 ? <div className="text-eve-dim">No standout positive factor yet.</div> : positives.map((item) => <div key={item} className="text-green-200/90">• {item}</div>)}
      </section>
      <section>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-amber-300">Warnings</div>
        {warnings.length === 0 ? <div className="text-eve-dim">No active warnings.</div> : warnings.map((item) => <div key={item} className="text-amber-200">• {item}</div>)}
      </section>
      <section>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-sky-300">Recommended actions</div>
        {recommendedActions.length === 0 ? <div className="text-eve-dim">Continue with current execution plan.</div> : recommendedActions.map((item) => <div key={item} className="text-sky-200">• {item}</div>)}
      </section>
    </div>
  );
}
