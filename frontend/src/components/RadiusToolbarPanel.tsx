import type { ReactNode } from "react";

type RadiusToolbarPanelProps = {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function RadiusToolbarPanel({
  open,
  onToggle,
  children,
}: RadiusToolbarPanelProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="px-2 py-0.5 rounded-sm border border-eve-border/60 bg-eve-dark/40 text-[11px] hover:border-eve-accent/50 hover:text-eve-accent transition-colors"
        aria-expanded={open}
        aria-controls="scan-results-advanced-toolbar"
        title="Toggle advanced controls"
      >
        Utilities {open ? "▾" : "▸"}
      </button>
      {open ? (
        <div
          id="scan-results-advanced-toolbar"
          data-testid="radius-toolbar-utilities-panel"
          className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
