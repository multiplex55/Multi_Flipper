import type { DiffTimelineItem, DiffTimelineMetricSet } from "@/lib/types";

export interface DiffTimelinePointInput {
  timeline_key: string;
  label: string;
  timestamp: string;
  fields: DiffTimelineMetricSet;
}

const toNumber = (value: number | undefined): number | undefined =>
  Number.isFinite(value) ? value : undefined;

const diffNum = (next: number | undefined, prev: number | undefined): number | undefined => {
  if (!Number.isFinite(next) || !Number.isFinite(prev)) return undefined;
  return (next as number) - (prev as number);
};

export function buildDeterministicDiffTimeline(points: DiffTimelinePointInput[]): DiffTimelineItem[] {
  const ordered = [...points].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (ta === tb) return a.timeline_key.localeCompare(b.timeline_key);
    return ta - tb;
  });

  return ordered.map((point, idx) => {
    const prev = idx > 0 ? ordered[idx - 1] : undefined;
    return {
      timeline_key: point.timeline_key,
      label: point.label,
      timestamp: point.timestamp,
      fields: {
        ...point.fields,
        net_profit: toNumber(point.fields.net_profit),
        margin: toNumber(point.fields.margin),
        daily_volume: toNumber(point.fields.daily_volume),
        route_risk: toNumber(point.fields.route_risk),
        confidence_proxy: toNumber(point.fields.confidence_proxy),
      },
      delta: prev
        ? {
            buy_changed: point.fields.buy !== prev.fields.buy,
            sell_changed: point.fields.sell !== prev.fields.sell,
            net_profit: diffNum(point.fields.net_profit, prev.fields.net_profit),
            margin: diffNum(point.fields.margin, prev.fields.margin),
            daily_volume: diffNum(point.fields.daily_volume, prev.fields.daily_volume),
            route_risk: diffNum(point.fields.route_risk, prev.fields.route_risk),
            confidence_proxy: diffNum(point.fields.confidence_proxy, prev.fields.confidence_proxy),
          }
        : {},
    };
  });
}
