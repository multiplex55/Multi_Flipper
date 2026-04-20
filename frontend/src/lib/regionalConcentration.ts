import type {
  RegionalBuyHubSummary,
  RegionalDayTradeHub,
  RegionalSellSinkSummary,
} from "@/lib/types";

function safeUnits(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function buildBuyHubSummaries(
  hubs: RegionalDayTradeHub[],
): RegionalBuyHubSummary[] {
  const summaries = new Map<number, RegionalBuyHubSummary>();

  for (const hub of hubs) {
    const existing = summaries.get(hub.source_system_id);
    if (!existing) {
      summaries.set(hub.source_system_id, {
        source_system_id: hub.source_system_id,
        source_system_name: hub.source_system_name,
        source_region_id: hub.source_region_id,
        source_region_name: hub.source_region_name,
        item_count: 0,
        route_count: 0,
        purchase_units: 0,
        capital_required: 0,
        target_period_profit: 0,
        avg_jumps: 0,
        top_destinations: [],
      });
    }

    const summary = summaries.get(hub.source_system_id);
    if (!summary) continue;
    summary.purchase_units += hub.purchase_units;
    summary.capital_required += hub.capital_required;
    summary.target_period_profit += hub.target_period_profit;

    const destinationMap = new Map<number, RegionalBuyHubSummary["top_destinations"][number]>();
    for (const prev of summary.top_destinations) {
      destinationMap.set(prev.target_system_id, { ...prev });
    }

    let totalJumpUnits = 0;
    let totalUnits = 0;
    const typeIDs = new Set<number>();

    for (const item of hub.items) {
      typeIDs.add(item.type_id);
      summary.route_count += 1;
      const units = safeUnits(item.purchase_units);
      totalJumpUnits += item.jumps * units;
      totalUnits += units;

      const existingDestination = destinationMap.get(item.target_system_id);
      if (!existingDestination) {
        destinationMap.set(item.target_system_id, {
          target_system_id: item.target_system_id,
          target_system_name: item.target_system_name,
          route_count: 1,
          purchase_units: item.purchase_units,
          capital_required: item.capital_required,
          target_period_profit: item.target_period_profit,
        });
      } else {
        existingDestination.route_count += 1;
        existingDestination.purchase_units += item.purchase_units;
        existingDestination.capital_required += item.capital_required;
        existingDestination.target_period_profit += item.target_period_profit;
      }
    }

    summary.item_count += typeIDs.size;
    const prevWeightedUnits = summary.avg_jumps * Math.max(summary.purchase_units - hub.purchase_units, 0);
    const combinedUnits = Math.max(summary.purchase_units, 1);
    summary.avg_jumps = (prevWeightedUnits + totalJumpUnits) / combinedUnits;
    summary.top_destinations = [...destinationMap.values()]
      .sort((a, b) => b.target_period_profit - a.target_period_profit)
      .slice(0, 3);
  }

  return [...summaries.values()].sort((a, b) => b.target_period_profit - a.target_period_profit);
}

export function buildSellSinkSummaries(
  hubs: RegionalDayTradeHub[],
): RegionalSellSinkSummary[] {
  const sinks = new Map<number, RegionalSellSinkSummary>();

  for (const hub of hubs) {
    for (const item of hub.items) {
      const existing = sinks.get(item.target_system_id);
      if (!existing) {
        sinks.set(item.target_system_id, {
          target_system_id: item.target_system_id,
          target_system_name: item.target_system_name,
          target_region_id: item.target_region_id,
          target_region_name: item.target_region_name,
          item_count: 0,
          route_count: 0,
          purchase_units: 0,
          capital_required: 0,
          target_period_profit: 0,
          avg_jumps: 0,
          top_sources: [],
        });
      }
      const sink = sinks.get(item.target_system_id);
      if (!sink) continue;
      sink.route_count += 1;
      sink.purchase_units += item.purchase_units;
      sink.capital_required += item.capital_required;
      sink.target_period_profit += item.target_period_profit;

      const sourceMap = new Map<number, RegionalSellSinkSummary["top_sources"][number]>();
      for (const prev of sink.top_sources) {
        sourceMap.set(prev.source_system_id, { ...prev });
      }
      const existingSource = sourceMap.get(item.source_system_id);
      if (!existingSource) {
        sourceMap.set(item.source_system_id, {
          source_system_id: item.source_system_id,
          source_system_name: item.source_system_name,
          route_count: 1,
          purchase_units: item.purchase_units,
          capital_required: item.capital_required,
          target_period_profit: item.target_period_profit,
        });
      } else {
        existingSource.route_count += 1;
        existingSource.purchase_units += item.purchase_units;
        existingSource.capital_required += item.capital_required;
        existingSource.target_period_profit += item.target_period_profit;
      }

      const typeIDs = new Set<number>([...(sink as RegionalSellSinkSummary & { __types?: Set<number> }).__types ?? []]);
      typeIDs.add(item.type_id);
      (sink as RegionalSellSinkSummary & { __types?: Set<number> }).__types = typeIDs;
      sink.item_count = typeIDs.size;

      const previousUnitWeight = Math.max(sink.purchase_units - item.purchase_units, 0);
      const prevJumpTotal = sink.avg_jumps * previousUnitWeight;
      const units = safeUnits(item.purchase_units);
      const totalUnits = previousUnitWeight + units;
      sink.avg_jumps = totalUnits > 0 ? (prevJumpTotal + item.jumps * units) / totalUnits : 0;

      sink.top_sources = [...sourceMap.values()]
        .sort((a, b) => b.target_period_profit - a.target_period_profit)
        .slice(0, 3);
    }
  }

  return [...sinks.values()]
    .map((sink) => {
      delete (sink as RegionalSellSinkSummary & { __types?: Set<number> }).__types;
      return sink;
    })
    .sort((a, b) => b.target_period_profit - a.target_period_profit);
}
