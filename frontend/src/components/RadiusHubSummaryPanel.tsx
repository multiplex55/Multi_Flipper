import { useState } from "react";
import { formatISK } from "@/lib/format";
import type { RadiusHubSummary } from "@/lib/radiusHubSummaries";
import type { RadiusMajorHubMetrics } from "@/lib/radiusMajorHubInsights";

interface Props {
  buyHubs: RadiusHubSummary[];
  sellHubs: RadiusHubSummary[];
  majorHubInsights?: RadiusMajorHubMetrics[];
  onOpenHubRows?: (hub: RadiusHubSummary, side: "buy" | "sell") => void;
  onSetHubLock?: (hub: RadiusHubSummary, side: "buy" | "sell") => void;
}

export function RadiusHubSummaryPanel({
  buyHubs,
  sellHubs,
  majorHubInsights = [],
  onOpenHubRows,
  onSetHubLock,
}: Props) {
  const [isBuyExpanded, setIsBuyExpanded] = useState(true);
  const [isSellExpanded, setIsSellExpanded] = useState(true);
  const [isMajorExpanded, setIsMajorExpanded] = useState(true);

  const topBuyHubs = buyHubs.slice(0, 5);
  const topSellHubs = sellHubs.slice(0, 5);

  const renderRows = (hubs: RadiusHubSummary[], side: "buy" | "sell") => (
    <div className="space-y-1">
      {hubs.length === 0 ? (
        <div className="text-[11px] text-eve-dim">No rows yet.</div>
      ) : (
        hubs.map((hub) => (
          <div key={`${side}-${hub.location_id}`} className="flex items-center gap-2 text-[11px] border border-eve-border/30 rounded px-2 py-1">
            <div className="min-w-0 flex-1">
              <div className="truncate text-eve-text">{hub.station_name}</div>
              <div className="truncate text-eve-dim">{hub.system_name} · items {hub.item_count} · {formatISK(hub.period_profit)}</div>
            </div>
            <button type="button" className="px-1 rounded border border-eve-border/50" onClick={() => onOpenHubRows?.(hub, side)}>
              Open rows
            </button>
            <button type="button" className="px-1 rounded border border-eve-border/50" onClick={() => onSetHubLock?.(hub, side)}>
              Set lock
            </button>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="shrink-0 border-b border-eve-border/20 px-2 py-2 space-y-2">
      <section>
        <button type="button" className="mb-1 flex w-full items-center justify-between text-xs uppercase tracking-wide text-eve-accent" aria-expanded={isBuyExpanded} aria-controls="radius-buy-hubs" onClick={() => setIsBuyExpanded((prev) => !prev)}>
          <span>Top buy hubs</span>
          <span aria-hidden="true">{isBuyExpanded ? "▾" : "▸"}</span>
        </button>
        {isBuyExpanded ? <div id="radius-buy-hubs">{renderRows(topBuyHubs, "buy")}</div> : null}
      </section>
      <section>
        <button type="button" className="mb-1 flex w-full items-center justify-between text-xs uppercase tracking-wide text-eve-accent" aria-expanded={isSellExpanded} aria-controls="radius-sell-hubs" onClick={() => setIsSellExpanded((prev) => !prev)}>
          <span>Top sell hubs</span>
          <span aria-hidden="true">{isSellExpanded ? "▾" : "▸"}</span>
        </button>
        {isSellExpanded ? <div id="radius-sell-hubs">{renderRows(topSellHubs, "sell")}</div> : null}
      </section>
      <section>
        <button type="button" className="mb-1 flex w-full items-center justify-between text-xs uppercase tracking-wide text-eve-accent" aria-expanded={isMajorExpanded} aria-controls="radius-major-hubs" onClick={() => setIsMajorExpanded((prev) => !prev)}>
          <span>Major hub insights</span>
          <span aria-hidden="true">{isMajorExpanded ? "▾" : "▸"}</span>
        </button>
        {isMajorExpanded ? (
          <div id="radius-major-hubs" className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {majorHubInsights.length === 0 ? (
              <div className="text-[11px] text-eve-dim">No major hub insights yet.</div>
            ) : (
              majorHubInsights.map((entry) => (
                <article key={entry.hub.key} className="rounded-sm border border-eve-border/60 bg-eve-dark/40 px-2 py-1 text-[10px]">
                  <div className="mb-1 font-medium text-eve-text">{entry.hub.label}</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <span className="text-eve-dim">Buy here:</span>
                    <span className="text-right">{entry.buy.rowCount}</span>
                    <span className="text-eve-dim">Sell here:</span>
                    <span className="text-right">{entry.sell.rowCount}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
