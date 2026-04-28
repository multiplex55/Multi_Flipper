import { useEffect, type MouseEvent, type PropsWithChildren } from "react";
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
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = () => {
    onClose();
  };

  const handleContainerClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-eve-dark/60 px-4 pt-24 pb-4"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-6xl rounded-sm border border-eve-border/70 bg-eve-dark/95 shadow-xl"
        data-testid="radius-insights-drawer"
        onClick={handleContainerClick}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-eve-border/50 bg-eve-dark/95 px-2 py-1">
          <MutedLabel className="uppercase tracking-wider">
            Full insights
          </MutedLabel>
          <ControlGroup zone="analysis">
            <ActionButton size="xs" onClick={onClose}>
              Close
            </ActionButton>
          </ControlGroup>
        </div>
        <div
          className="max-h-[70vh] overflow-y-auto pt-1"
          data-testid="radius-insights-drawer-scroll-body"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
