import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function ExplanationPopoverShell({
  label = "Why?",
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        className="text-[11px] px-1.5 py-0.5 rounded border border-eve-border/70 text-eve-dim hover:text-eve-accent hover:border-eve-accent/60"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {label}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          className="absolute right-0 top-[calc(100%+6px)] z-[220] w-[360px] max-w-[90vw] rounded-sm border border-eve-border bg-eve-dark shadow-eve-glow-strong p-3 text-xs"
        >
          {children}
        </div>
      )}
    </div>
  );
}
