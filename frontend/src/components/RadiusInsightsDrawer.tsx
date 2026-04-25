import type { PropsWithChildren } from "react";
import { ActionButton, ControlGroup, MutedLabel } from "@/components/ui/ControlPrimitives";

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
          <MutedLabel className="uppercase tracking-wider">
            Full insights
          </MutedLabel>
          <ControlGroup zone="analysis">
            <ActionButton size="xs" onClick={onClose}>
              Close
            </ActionButton>
          </ControlGroup>
        </div>
        <div className="pt-1">{children}</div>
      </div>
    </div>
  );
}
