import type { PropsWithChildren } from "react";

type RadiusInsightsDrawerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
}>;

export function RadiusInsightsDrawer({
  open,
  onClose,
  children,
}: RadiusInsightsDrawerProps) {
  if (!open) return null;

  return (
    <div className="shrink-0 px-2 pb-1" data-testid="radius-insights-drawer">
      <div className="rounded-sm border border-eve-border/70 bg-eve-dark/30">
        <div className="flex items-center justify-between border-b border-eve-border/50 px-2 py-1">
          <span className="text-[11px] uppercase tracking-wider text-eve-dim">
            Full insights
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-eve-border/60 px-2 py-0.5 text-[10px] text-eve-dim hover:text-eve-text"
          >
            Close
          </button>
        </div>
        <div className="pt-1">{children}</div>
      </div>
    </div>
  );
}
