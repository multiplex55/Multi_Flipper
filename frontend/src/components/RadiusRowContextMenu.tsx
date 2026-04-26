import { useEffect, useMemo, useRef } from "react";
import type { FlipResult } from "@/lib/types";
import {
  buildRadiusContextMenuItems,
  type RadiusContextMenuAction,
  type RadiusContextMenuSection,
} from "@/lib/radiusContextMenuItems";

type RadiusRowContextMenuCallbacks = {
  onAction: (action: RadiusContextMenuAction, row: FlipResult, routeKey?: string) => void;
};

type Props = {
  x: number;
  y: number;
  row: FlipResult;
  isLoggedIn: boolean;
  isTracked: boolean;
  isPinned: boolean;
  hiddenEntryKey?: string;
  hasLegLocks: boolean;
  canQueueRoute: boolean;
  canAssignRoute: boolean;
  canVerifyRoute: boolean;
  onClose: () => void;
  callbacks: RadiusRowContextMenuCallbacks;
};

const SECTION_ORDER: RadiusContextMenuSection[] = [
  "copy",
  "route_workflow",
  "cargo",
  "lens",
  "filtering",
  "verification",
  "external_tools",
  "tracking",
  "hidden",
  "eve_ui",
  "saved_patterns",
  "pinning",
];

export function RadiusRowContextMenu({
  x,
  y,
  row,
  isLoggedIn,
  isTracked,
  isPinned,
  hiddenEntryKey,
  hasLegLocks,
  canQueueRoute,
  canAssignRoute,
  canVerifyRoute,
  onClose,
  callbacks,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const items = useMemo(
    () =>
      buildRadiusContextMenuItems({
        row,
        isLoggedIn,
        isTracked,
        isPinned,
        hiddenEntryKey,
        hasLegLocks,
        canQueueRoute,
        canAssignRoute,
        canVerifyRoute,
      }),
    [
      row,
      isLoggedIn,
      isTracked,
      isPinned,
      hiddenEntryKey,
      hasLegLocks,
      canQueueRoute,
      canAssignRoute,
      canVerifyRoute,
    ],
  );

  useEffect(() => {
    const menu = rootRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const pad = 10;
    let nextX = x;
    let nextY = y;
    if (nextX + rect.width > window.innerWidth - pad) {
      nextX = window.innerWidth - rect.width - pad;
    }
    if (nextY + rect.height > window.innerHeight - pad) {
      nextY = window.innerHeight - rect.height - pad;
    }
    menu.style.left = `${Math.max(pad, nextX)}px`;
    menu.style.top = `${Math.max(pad, nextY)}px`;
  }, [x, y, items]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        ref={rootRef}
        className="fixed z-50 bg-eve-panel border border-eve-border rounded-sm shadow-eve-glow-strong py-1 min-w-[220px]"
        style={{ left: x, top: y }}
      >
        {SECTION_ORDER.map((section, sectionIndex) => {
          const sectionItems = items.filter((item) => item.section === section && item.visible !== false);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section}>
              {sectionIndex > 0 && <div className="h-px bg-eve-border my-1" />}
              {sectionItems.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  disabled={!item.enabled}
                  onClick={() => {
                    if (!item.enabled) return;
                    callbacks.onAction(item.action, row, item.routeKey);
                    onClose();
                  }}
                  className={[
                    "w-full text-left px-4 py-1.5 text-sm transition-colors",
                    item.enabled
                      ? "text-eve-text hover:bg-eve-accent/20 hover:text-eve-accent cursor-pointer"
                      : "text-eve-dim/50 cursor-not-allowed",
                    item.danger ? "hover:text-red-300" : "",
                    item.accent && item.enabled ? "text-eve-accent" : "",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
