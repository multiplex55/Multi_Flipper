import type { RegionalDayTradeHub, RegionalTradeCorridor } from "@/lib/types";

function corridorKey(sourceSystemID: number, targetSystemID: number): string {
  return `${sourceSystemID}:${targetSystemID}`;
}

export function aggregateRegionalTradeCorridors(
  hubs: RegionalDayTradeHub[],
): RegionalTradeCorridor[] {
  const grouped = new Map<string, RegionalTradeCorridor>();

  for (const hub of hubs) {
    for (const item of hub.items) {
      const key = corridorKey(item.source_system_id, item.target_system_id);
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          key,
          source_system_id: item.source_system_id,
          source_system_name: item.source_system_name,
          target_system_id: item.target_system_id,
          target_system_name: item.target_system_name,
          item_count: 1,
          purchase_units: item.purchase_units,
          capital_required: item.capital_required,
          target_now_profit: item.target_now_profit,
          target_period_profit: item.target_period_profit,
          weighted_jumps:
            item.purchase_units > 0 ? item.jumps : 0,
          best_item_type_id: item.type_id,
          best_item_name: item.type_name,
          best_item_period_profit: item.target_period_profit,
          best_item_now_profit: item.target_now_profit,
          items: [item],
        });
        continue;
      }

      existing.purchase_units += item.purchase_units;
      existing.capital_required += item.capital_required;
      existing.target_now_profit += item.target_now_profit;
      existing.target_period_profit += item.target_period_profit;
      existing.items.push(item);

      if (item.target_period_profit > existing.best_item_period_profit) {
        existing.best_item_type_id = item.type_id;
        existing.best_item_name = item.type_name;
        existing.best_item_period_profit = item.target_period_profit;
        existing.best_item_now_profit = item.target_now_profit;
      }
    }
  }

  for (const corridor of grouped.values()) {
    const totalUnits = corridor.items.reduce((acc, item) => acc + item.purchase_units, 0);
    corridor.item_count = new Set(corridor.items.map((item) => item.type_id)).size;
    const weightedJumpTotal = corridor.items.reduce(
      (acc, item) => acc + item.jumps * item.purchase_units,
      0,
    );
    corridor.weighted_jumps =
      totalUnits > 0 ? weightedJumpTotal / totalUnits : 0;
  }

  return [...grouped.values()];
}
