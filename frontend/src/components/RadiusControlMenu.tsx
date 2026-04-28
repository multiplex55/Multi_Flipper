import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export type RadiusControlMenuGroup = {
  id: string;
  label: string;
  content: ReactNode;
};

type RadiusControlMenuProps = {
  menuId: string;
  groups: RadiusControlMenuGroup[];
  activeGroupId: string | null;
};

export function RadiusControlMenu({ menuId, groups, activeGroupId }: RadiusControlMenuProps) {
  const activeGroupRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!activeGroupId) return;
    const node = activeGroupRef.current;
    if (!node) return;
    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    node.focus();
  }, [activeGroupId]);

  return (
    <div id={menuId} role="dialog" aria-label="Radius control menu" className="mt-1.5 space-y-1.5 text-[11px]">
      {groups.map((group) => (
        <section
          key={group.id}
          ref={activeGroupId === group.id ? activeGroupRef : undefined}
          tabIndex={activeGroupId === group.id ? -1 : undefined}
          data-testid={`radius-control-menu-group:${group.id}`}
          className={`rounded-sm border px-2 py-1 ${
            activeGroupId === group.id
              ? "border-eve-accent/70 bg-eve-accent/10"
              : "border-eve-border/50 bg-eve-dark/20"
          }`}
        >
          <h4 className="mb-1 text-[10px] uppercase tracking-wide text-eve-dim">{group.label}</h4>
          {group.content}
        </section>
      ))}
    </div>
  );
}
