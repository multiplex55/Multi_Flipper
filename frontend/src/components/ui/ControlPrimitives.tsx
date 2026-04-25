import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ControlTone = "neutral" | "accent" | "indigo";
type ControlSize = "xs" | "sm";

type ControlGroupZone = "execution" | "analysis" | "status";

type ControlGroupProps = HTMLAttributes<HTMLDivElement> & {
  zone?: ControlGroupZone;
  inline?: boolean;
};

const zoneSpacingClass: Record<ControlGroupZone, string> = {
  execution: "gap-1.5",
  analysis: "gap-1",
  status: "gap-1",
};

export function ControlGroup({
  zone = "analysis",
  inline = true,
  className,
  ...props
}: ControlGroupProps) {
  return (
    <div
      className={cn(
        inline ? "flex flex-wrap items-center" : "grid",
        zoneSpacingClass[zone],
        className,
      )}
      data-control-zone={zone}
      {...props}
    />
  );
}

type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> & {
  tone?: ControlTone;
  size?: ControlSize;
  selected?: boolean;
};

const toneClass: Record<ControlTone, { base: string; selected: string }> = {
  neutral: {
    base: "border-eve-border/60 bg-eve-dark/40 text-eve-dim hover:border-eve-accent/50 hover:text-eve-accent",
    selected: "border-eve-accent/60 bg-eve-accent/10 text-eve-accent",
  },
  accent: {
    base: "border-eve-accent/50 text-eve-accent hover:bg-eve-accent/10",
    selected: "border-eve-accent/60 bg-eve-accent/10 text-eve-accent",
  },
  indigo: {
    base: "border-indigo-400/50 text-indigo-200 hover:bg-indigo-500/10",
    selected: "border-indigo-300/70 bg-indigo-500/20 text-indigo-100",
  },
};

const sizeClass: Record<ControlSize, string> = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-0.5 text-[11px]",
};

export function ActionButton({
  tone = "neutral",
  size = "sm",
  selected = false,
  className,
  disabled,
  type = "button",
  ...props
}: ActionButtonProps) {
  const stateClass = selected ? toneClass[tone].selected : toneClass[tone].base;

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-eve-accent/70",
        sizeClass[size],
        stateClass,
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...props}
    />
  );
}

type ToggleButtonProps = Omit<ActionButtonProps, "selected"> & {
  pressed: boolean;
};

export function ToggleButton({ pressed, ...props }: ToggleButtonProps) {
  return <ActionButton aria-pressed={pressed} selected={pressed} {...props} />;
}

type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "indigo";
  children: ReactNode;
};

export function StatusChip({ tone = "neutral", className, children, ...props }: StatusChipProps) {
  const toneStyles: Record<NonNullable<StatusChipProps["tone"]>, string> = {
    neutral: "border-eve-border/60 bg-eve-panel/40 text-eve-dim",
    accent: "border-eve-accent/40 bg-eve-accent/10 text-eve-accent",
    indigo: "border-indigo-400/40 bg-indigo-500/10 text-indigo-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px]",
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

type MutedLabelProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
};

export function MutedLabel({ className, children, ...props }: MutedLabelProps) {
  return (
    <span className={cn("text-[11px] text-eve-dim", className)} {...props}>
      {children}
    </span>
  );
}
