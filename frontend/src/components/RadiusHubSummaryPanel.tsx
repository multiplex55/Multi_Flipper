import { useState } from "react";
import { formatISK } from "@/lib/format";
import type { RadiusHubSummary } from "@/lib/radiusHubSummaries";

interface Props {
  buyHubs: RadiusHubSummary[];
  sellHubs: RadiusHubSummary[];
  onOpenHubRows?: (hub: RadiusHubSummary, side: "buy" | "sell") => void;
  onSetHubLock?: (hub: RadiusHubSummary, side: "buy" | "sell") => void;
}

export function RadiusHubSummaryPanel({
  buyHubs,
  sellHubs,
  onOpenHubRows,
  onSetHubLock,
}: Props) {
  const [isBuyExpanded, setIsBuyExpanded] = useState(true);
  const [isSellExpanded, setIsSellExpanded] = useState(true);

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
    <div className="shrink-0 border-b border-eve-border/20 px-2 py-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
      <section>
        <button
          type="button"
          className="mb-1 flex w-full items-center justify-between text-xs uppercase tracking-wide text-eve-accent"
          aria-expanded={isBuyExpanded}
          aria-controls="radius-buy-hubs"
          onClick={() => setIsBuyExpanded((prev) => !prev)}
        >
          <span>Top buy hubs</span>
          <span aria-hidden="true">{isBuyExpanded ? "▾" : "▸"}</span>
        </button>
        {isBuyExpanded ? <div id="radius-buy-hubs">{renderRows(topBuyHubs, "buy")}</div> : null}
      </section>
      <section>
        <button
          type="button"
          className="mb-1 flex w-full items-center justify-between text-xs uppercase tracking-wide text-eve-accent"
          aria-expanded={isSellExpanded}
          aria-controls="radius-sell-hubs"
          onClick={() => setIsSellExpanded((prev) => !prev)}
        >
          <span>Top sell hubs</span>
          <span aria-hidden="true">{isSellExpanded ? "▾" : "▸"}</span>
        </button>
        {isSellExpanded ? <div id="radius-sell-hubs">{renderRows(topSellHubs, "sell")}</div> : null}
      </section>
    </div>
  );
}
