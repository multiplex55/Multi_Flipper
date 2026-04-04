import { formatISK, formatMargin, formatNumber } from "@/lib/format";

type TrendMetric = "isk" | "margin" | "number";

export function TrendIndicator({
  delta,
  percentDelta,
  metric,
}: {
  delta: number | null;
  percentDelta?: number | null;
  metric: TrendMetric;
}) {
  if (delta == null || !Number.isFinite(delta)) {
    return (
      <span className="text-eve-dim" aria-label="No baseline data available">
        —
      </span>
    );
  }

  const sign = delta > 0 ? "up" : delta < 0 ? "down" : "neutral";
  const color = sign === "up" ? "text-eve-profit" : sign === "down" ? "text-eve-error" : "text-eve-dim";
  const icon = sign === "up" ? "▲" : sign === "down" ? "▼" : "•";
  const absolute =
    metric === "isk"
      ? formatISK(delta)
      : metric === "margin"
        ? formatMargin(delta)
        : formatNumber(delta);
  const percentText = percentDelta != null && Number.isFinite(percentDelta) ? ` (${formatMargin(percentDelta)})` : "";
  const directionText = sign === "up" ? "Increase" : sign === "down" ? "Decrease" : "No change";

  return (
    <span className={`font-mono ${color}`} aria-label={`${directionText}: ${absolute}${percentText}`}>
      {icon} {absolute}
      {percentText}
    </span>
  );
}
