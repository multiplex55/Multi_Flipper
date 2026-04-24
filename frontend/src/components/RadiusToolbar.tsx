import type { ReactNode } from "react";

type RadiusToolbarProps = {
  primaryControls: ReactNode;
  quickActions: ReactNode;
  utilityToggle: ReactNode;
  pinnedPanel?: ReactNode;
};

export function RadiusToolbar({
  primaryControls,
  quickActions,
  utilityToggle,
  pinnedPanel,
}: RadiusToolbarProps) {
  return (
    <div
      className="sticky top-0 z-20 mt-1 rounded-sm border border-eve-border/60 bg-eve-panel/95 px-2 py-1 backdrop-blur"
      data-testid="radius-toolbar-quick-bar"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <div
          data-testid="radius-toolbar-primary-controls"
          className="flex flex-wrap items-center gap-1"
        >
          {primaryControls}
        </div>
        <div className="flex-1" />
        {pinnedPanel ? (
          <div data-testid="radius-toolbar-pinned-panel-slot">{pinnedPanel}</div>
        ) : null}
        {utilityToggle}
      </div>
      <div
        data-testid="radius-toolbar-secondary-actions"
        className="mt-1 flex flex-wrap items-center gap-1"
      >
        {quickActions}
      </div>
    </div>
  );
}
