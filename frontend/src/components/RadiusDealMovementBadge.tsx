import type { RadiusDealMovement } from "@/lib/radiusDealMovement";

type Props = {
  movement?: RadiusDealMovement | null;
  showDelta?: boolean;
};

const toneByLabel: Record<NonNullable<Props["movement"]>["label"], string> = {
  new: "border-cyan-400/45 bg-cyan-500/10 text-cyan-200",
  improving: "border-emerald-400/45 bg-emerald-500/10 text-emerald-200",
  stable: "border-eve-border/60 bg-eve-panel/30 text-eve-dim",
  worse: "border-amber-400/45 bg-amber-500/10 text-amber-200",
  collapsing: "border-rose-400/55 bg-rose-500/10 text-rose-200",
};

const labelByMovement: Record<NonNullable<Props["movement"]>["label"], string> = {
  new: "New",
  improving: "Improving",
  stable: "Stable",
  worse: "Worse",
  collapsing: "Collapsing",
};

export function RadiusDealMovementBadge({ movement, showDelta = true }: Props) {
  if (!movement) return null;
  const delta = movement.profitDeltaPct;
  const formattedDelta = `${delta >= 0 ? "+" : ""}${Math.round(delta)}%`;

  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1 py-0 text-[9px] uppercase tracking-normal ${toneByLabel[movement.label]}`}
      data-testid="radius-deal-movement-badge"
      title={`Profit ${formattedDelta} • Qty ${Math.round(movement.quantityDeltaPct)}% • Exec ${Math.round(movement.executionDelta)}`}
    >
      {labelByMovement[movement.label]}
      {showDelta && movement.label !== "new" ? ` ${formattedDelta}` : ""}
    </span>
  );
}
