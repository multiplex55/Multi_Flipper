import type { RadiusStagingRecommendation } from "@/lib/radiusStagingAdvisor";

type RadiusStagingAdvisorPanelProps = {
  recommendations: RadiusStagingRecommendation[];
};

export function RadiusStagingAdvisorPanel({
  recommendations,
}: RadiusStagingAdvisorPanelProps) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-sm border border-eve-border/60 bg-eve-panel/30 px-2 py-1 text-[11px] text-eve-dim">
        No radius staging recommendations yet.
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="radius-staging-advisor-panel">
      {recommendations.map((recommendation) => (
        <article
          key={`${recommendation.characterId}:${recommendation.recommendedSystemId}:${recommendation.side}`}
          className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-2 py-1"
        >
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <div className="text-eve-text">{recommendation.characterName}</div>
            <div className="text-eve-accent">{Math.round(recommendation.score * 100)}</div>
          </div>
          <div className="text-[10px] text-eve-dim">
            {recommendation.currentSystemName} → {recommendation.recommendedSystemName} ({recommendation.side})
          </div>
          <div className="mt-1 text-[10px] text-eve-dim/90">{recommendation.reason}</div>
        </article>
      ))}
    </div>
  );
}
