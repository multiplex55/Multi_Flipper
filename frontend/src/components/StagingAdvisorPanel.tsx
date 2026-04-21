import type { CharacterStagingRecommendation } from "@/lib/types";

interface StagingAdvisorPanelProps {
  recommendations: CharacterStagingRecommendation[];
  loading?: boolean;
  onOpenHub: (recommendation: CharacterStagingRecommendation) => void;
  onSetSourceLock: (recommendation: CharacterStagingRecommendation) => void;
  onOpenRouteContext: (recommendation: CharacterStagingRecommendation) => void;
}

export function StagingAdvisorPanel({
  recommendations,
  loading = false,
  onOpenHub,
  onSetSourceLock,
  onOpenRouteContext,
}: StagingAdvisorPanelProps) {
  if (loading) {
    return <div className="p-3 text-xs text-eve-dim">Loading staging recommendations…</div>;
  }

  if (recommendations.length === 0) {
    return <div className="p-3 text-xs text-eve-dim">No staging recommendations yet. Run a regional scan with authenticated characters.</div>;
  }

  return (
    <div className="p-2 space-y-2 overflow-auto" data-testid="staging-advisor-panel">
      {recommendations.map((rec) => (
        <article
          key={`${rec.character_id}:${rec.recommended_system_id}`}
          className="border border-eve-border rounded-md bg-eve-panel p-3"
        >
          <header className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm text-eve-text">{rec.character_name}</h3>
              <p className="text-xs text-eve-dim">
                {rec.current_system_name} → {rec.recommended_system_name}
              </p>
            </div>
            <div className="text-right text-xs">
              <div className="text-eve-accent">{rec.recommended_role}</div>
              <div className="text-eve-dim">{rec.jumps} jumps</div>
            </div>
          </header>

          <p className="mt-2 text-xs text-eve-dim">{rec.reason_summary}</p>

          <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
            <div>
              <dt className="text-eve-dim">Staging score</dt>
              <dd className="text-eve-text">{rec.staging_score.toFixed(1)}</dd>
            </div>
            <div>
              <dt className="text-eve-dim">Role fit</dt>
              <dd className="text-eve-text">{(rec.role_fit_score * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt className="text-eve-dim">Corridors</dt>
              <dd className="text-eve-text">{rec.top_metrics.corridor_count}</dd>
            </div>
            <div>
              <dt className="text-eve-dim">Destinations</dt>
              <dd className="text-eve-text">{rec.top_metrics.destinations_count}</dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="px-2 py-1 text-xs rounded border border-eve-border" onClick={() => onOpenHub(rec)}>
              Open hub
            </button>
            <button className="px-2 py-1 text-xs rounded border border-eve-border" onClick={() => onSetSourceLock(rec)}>
              Set source lock
            </button>
            <button className="px-2 py-1 text-xs rounded border border-eve-border" onClick={() => onOpenRouteContext(rec)}>
              Open corridor/route
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
