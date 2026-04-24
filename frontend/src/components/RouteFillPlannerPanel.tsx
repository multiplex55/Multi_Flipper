import { formatISK } from "@/lib/format";
import type { RouteFillPlannerSections, RouteFillPlannerSuggestion } from "@/lib/routeFillPlanner";

interface RouteFillPlannerPanelProps {
  sections: RouteFillPlannerSections;
  onAddToRoutePack: (suggestion: RouteFillPlannerSuggestion) => void;
  onOpenBatchBuilderSelection: (suggestion: RouteFillPlannerSuggestion) => void;
}

function SuggestionSection({
  title,
  rows,
  onAddToRoutePack,
  onOpenBatchBuilderSelection,
  testId,
}: {
  title: string;
  rows: RouteFillPlannerSuggestion[];
  onAddToRoutePack: (suggestion: RouteFillPlannerSuggestion) => void;
  onOpenBatchBuilderSelection: (suggestion: RouteFillPlannerSuggestion) => void;
  testId: string;
}) {
  return (
    <section className="rounded-sm border border-eve-border/40 p-2" data-testid={testId}>
      <h4 className="mb-1 text-[11px] font-semibold text-eve-text">{title}</h4>
      {rows.length === 0 ? (
        <div className="text-[11px] text-eve-dim">No suggestions.</div>
      ) : (
        <div className="space-y-1">
          {rows.map((suggestion) => (
            <div
              key={suggestion.id}
              className="rounded-sm border border-eve-border/40 bg-eve-dark/30 px-1.5 py-1 text-[11px]"
              data-testid={`route-fill-suggestion:${suggestion.id}`}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-eve-text">{suggestion.title}</span>
                <span className="font-mono text-eve-accent">+{formatISK(suggestion.incrementalProfitIsk)}</span>
              </div>
              <div className="mt-0.5 text-eve-dim">
                +{suggestion.addedJumps} jumps · +{suggestion.addedM3.toFixed(0)} m³ · quality {suggestion.confidencePercent.toFixed(0)}%
              </div>
              <div className="mt-0.5 text-eve-dim/90">{suggestion.rationale}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                <button
                  type="button"
                  className="rounded-sm border border-eve-border/60 px-1 py-0.5"
                  onClick={() => onAddToRoutePack(suggestion)}
                >
                  Add to route pack
                </button>
                <button
                  type="button"
                  className="rounded-sm border border-eve-accent/60 px-1 py-0.5 text-eve-accent"
                  onClick={() => onOpenBatchBuilderSelection(suggestion)}
                >
                  Open in batch builder
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RouteFillPlannerPanel({
  sections,
  onAddToRoutePack,
  onOpenBatchBuilderSelection,
}: RouteFillPlannerPanelProps) {
  return (
    <div className="space-y-2" data-testid="route-fill-planner-panel">
      <SuggestionSection
        title="Same endpoint filler"
        rows={sections.sameEndpointFiller}
        onAddToRoutePack={onAddToRoutePack}
        onOpenBatchBuilderSelection={onOpenBatchBuilderSelection}
        testId="route-fill-section-same-endpoint"
      />
      <SuggestionSection
        title="Along-the-way detour filler"
        rows={sections.alongTheWayDetourFiller}
        onAddToRoutePack={onAddToRoutePack}
        onOpenBatchBuilderSelection={onOpenBatchBuilderSelection}
        testId="route-fill-section-detour"
      />
      <SuggestionSection
        title="Backhaul/return-leg filler"
        rows={sections.backhaulReturnLegFiller}
        onAddToRoutePack={onAddToRoutePack}
        onOpenBatchBuilderSelection={onOpenBatchBuilderSelection}
        testId="route-fill-section-backhaul"
      />
    </div>
  );
}
