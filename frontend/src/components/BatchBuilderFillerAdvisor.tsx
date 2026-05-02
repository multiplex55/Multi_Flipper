import { formatISK } from "@/lib/format";
import type { PlannedFillerSuggestion } from "@/lib/batchFillerAdvisor";

interface Props {
  remainingCargoM3: number;
  suggestions: PlannedFillerSuggestion[];
  onAddOne: (lineKey: string) => void;
  onAddAllSafe: () => void;
  onReplaceWeakLine?: (lineKey: string) => void;
}

export function BatchBuilderFillerAdvisor({ remainingCargoM3, suggestions, onAddOne, onAddAllSafe, onReplaceWeakLine }: Props) {
  return (
    <div className="border border-eve-border rounded-sm p-3 bg-eve-panel/40" data-testid="batch-filler-advisor">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-eve-text">Filler Advisor</div>
        <div className="text-xs text-eve-dim">Remaining m³: {remainingCargoM3.toFixed(1)}</div>
      </div>
      {suggestions.length === 0 ? (
        <div className="mt-2 text-xs text-eve-dim">No safe suggestions.</div>
      ) : (
        <div className="mt-2 space-y-1">
          {suggestions.slice(0, 6).map((s) => (
            <div key={s.lineKey} className="rounded-sm border border-eve-border/50 px-2 py-1 text-xs flex items-center justify-between gap-2">
              <div>
                <div className="text-eve-text">{s.type_name}</div>
                <div className="text-eve-dim">+{formatISK(s.added_profit_isk)} · {s.iskPerM3.toFixed(1)} ISK/m³ · {(s.fill_confidence * 100).toFixed(0)}%</div>
              </div>
              <div className="flex gap-1">
                <button type="button" className="px-1.5 py-0.5 border border-blue-400/60 text-blue-300 rounded-sm" onClick={() => onAddOne(s.lineKey)}>Add one</button>
                {onReplaceWeakLine && <button type="button" className="px-1.5 py-0.5 border border-amber-400/60 text-amber-300 rounded-sm" onClick={() => onReplaceWeakLine(s.lineKey)}>Replace weak</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2">
        <button type="button" className="px-2 py-1 rounded-sm border border-emerald-400/60 text-emerald-300 text-xs" onClick={onAddAllSafe}>Add all safe</button>
      </div>
    </div>
  );
}
