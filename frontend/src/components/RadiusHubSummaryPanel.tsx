import type { RadiusHubSummary } from "@/lib/radiusHubSummaries";
import type { RadiusMajorHubMetrics } from "@/lib/radiusMajorHubInsights";

interface Props {
  buyHubs: RadiusHubSummary[];
  sellHubs: RadiusHubSummary[];
  majorHubInsights?: RadiusMajorHubMetrics[];
  onOpenHubRows?: (hub: RadiusHubSummary, side: "buy" | "sell") => void;
  onSetHubLock?: (hub: RadiusHubSummary, side: "buy" | "sell") => void;
}

/**
 * Deprecated: hub summary is consolidated into RadiusInsightsPanel.
 * Retained as a no-op shim for backwards-compatible imports in tests.
 */
export function RadiusHubSummaryPanel(_props: Props) {
  return null;
}
