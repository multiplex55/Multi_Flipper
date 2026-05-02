import type { RadiusDecisionQueueItem } from "@/lib/radiusDecisionQueue";

type Props = {
  rows: RadiusDecisionQueueItem[];
};

export function RadiusBatchBuyPlanner({ rows }: Props) {
  return (
    <div data-testid="radius-batch-buy-planner" className="space-y-1 text-[11px]">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2 rounded-sm border border-eve-border/40 px-2 py-1">
          <span className="font-mono text-eve-dim">{row.id}</span>
          <span className="rounded-sm border border-eve-border/40 px-1 py-0 text-eve-dim">{row.haulWorthiness.label}</span>
          <span className="text-eve-dim">{row.haulWorthiness.reason}</span>
        </div>
      ))}
    </div>
  );
}
