import { formatISK } from "@/lib/format";
import type { RouteFillPlannerSections, RouteFillPlannerSuggestion } from "@/lib/routeFillPlanner";

interface RouteFillPlannerPanelProps {
  sections: RouteFillPlannerSections;
  onAddToRoutePack: (suggestion: RouteFillPlannerSuggestion) => void;
  onOpenBatchBuilderSelection: (suggestion: RouteFillPlannerSuggestion) => void;
  metrics?: {
    selectedCargoM3: number;
    cargoCapacityM3: number;
    remainingCargoM3: number;
    selectedCapitalIsk: number;
    selectedProfitIsk: number;
  };
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
        <div className="overflow-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-eve-dim">
                <th>title</th>
                <th>incrementalProfitIsk</th>
                <th>addedM3</th>
                <th>addedJumps</th>
                <th>profitPerM3</th>
                <th>profitPerAddedJump</th>
                <th>confidencePercent</th>
                <th>rationale</th>
                <th>sourceLineKeys</th>
                <th>actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((suggestion) => {
                const profitPerM3 = suggestion.addedM3 > 0 ? suggestion.incrementalProfitIsk / suggestion.addedM3 : suggestion.incrementalProfitIsk;
                const profitPerAddedJump = suggestion.addedJumps > 0 ? suggestion.incrementalProfitIsk / suggestion.addedJumps : suggestion.incrementalProfitIsk;
                return (
                  <tr key={suggestion.id} data-testid={`route-fill-suggestion:${suggestion.id}`} className="border-t border-eve-border/30">
                    <td className="pr-1 text-eve-text">{suggestion.title}</td>
                    <td>{formatISK(suggestion.incrementalProfitIsk)}</td>
                    <td>{suggestion.addedM3.toFixed(2)}</td>
                    <td>{suggestion.addedJumps}</td>
                    <td>{formatISK(profitPerM3)}</td>
                    <td>{formatISK(profitPerAddedJump)}</td>
                    <td>{suggestion.confidencePercent.toFixed(0)}%</td>
                    <td className="max-w-[220px] truncate" title={suggestion.rationale}>{suggestion.rationale}</td>
                    <td className="max-w-[180px] truncate" title={suggestion.sourceLineKeys.join(", ")}>{suggestion.sourceLineKeys.join(", ")}</td>
                    <td className="py-1">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => onAddToRoutePack(suggestion)}>Add</button>
                        <button type="button" className="rounded-sm border border-eve-accent/60 px-1 py-0.5 text-eve-accent" onClick={() => onOpenBatchBuilderSelection(suggestion)}>Open</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RouteFillPlannerPanel({
  sections,
  onAddToRoutePack,
  onOpenBatchBuilderSelection,
  metrics,
}: RouteFillPlannerPanelProps) {
  return (
    <div className="space-y-2" data-testid="route-fill-planner-panel">
      {metrics ? (
        <section className="grid grid-cols-2 gap-1 rounded-sm border border-eve-border/40 p-2 text-[11px]" data-testid="route-fill-planner-metrics">
          <div>Selected cargo: <span className="text-eve-text">{metrics.selectedCargoM3.toFixed(2)} / {metrics.cargoCapacityM3.toFixed(2)} m³</span></div>
          <div>Remaining cargo: <span className="text-eve-text">{metrics.remainingCargoM3.toFixed(2)} m³</span></div>
          <div>Selected capital: <span className="text-eve-text">{formatISK(metrics.selectedCapitalIsk)}</span></div>
          <div>Selected profit: <span className="text-eve-text">{formatISK(metrics.selectedProfitIsk)}</span></div>
        </section>
      ) : null}
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
