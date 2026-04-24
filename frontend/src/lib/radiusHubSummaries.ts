import type { FlipResult } from "@/lib/types";
import type { RadiusMajorHubMatchIdentity } from "@/lib/radiusMajorHubInsights";

export interface RadiusHubSummary {
  location_id: number;
  station_name: string;
  system_id: number;
  system_name: string;
  row_count: number;
  item_count: number;
  units: number;
  capital_required: number;
  period_profit: number;
  avg_jumps: number;
  /**
   * Optional major-hub criteria for exact row-set actions
   * (e.g., Perimeter rows that specifically match TTT structure naming).
   */
  major_hub_match?: RadiusMajorHubMatchIdentity & { matchKey?: string };
}

function summarize(
  results: FlipResult[],
  mode: "buy" | "sell",
): RadiusHubSummary[] {
  const grouped = new Map<number, RadiusHubSummary & { type_ids: Set<number>; jump_weight_total: number }>();

  for (const row of results) {
    const locationID = mode === "buy" ? row.BuyLocationID ?? row.BuySystemID : row.SellLocationID ?? row.SellSystemID;
    if (!locationID || locationID <= 0) continue;

    const stationName = mode === "buy" ? row.BuyStation : row.SellStation;
    const systemID = mode === "buy" ? row.BuySystemID : row.SellSystemID;
    const systemName = mode === "buy" ? row.BuySystemName : row.SellSystemName;

    const units = row.UnitsToBuy > 0 ? row.UnitsToBuy : 0;
    const capitalRequired = row.DayCapitalRequired ?? row.BuyPrice * units;
    const periodProfit = row.DayPeriodProfit ?? row.TotalProfit ?? row.ExpectedProfit ?? 0;
    const totalJumps = row.TotalJumps ?? (row.BuyJumps + row.SellJumps);

    let summary = grouped.get(locationID);
    if (!summary) {
      summary = {
        location_id: locationID,
        station_name: stationName,
        system_id: systemID,
        system_name: systemName,
        row_count: 0,
        item_count: 0,
        units: 0,
        capital_required: 0,
        period_profit: 0,
        avg_jumps: 0,
        type_ids: new Set<number>(),
        jump_weight_total: 0,
      };
      grouped.set(locationID, summary);
    }

    summary.row_count += 1;
    summary.units += units;
    summary.capital_required += capitalRequired;
    summary.period_profit += periodProfit;
    summary.type_ids.add(row.TypeID);
    summary.jump_weight_total += totalJumps * units;
  }

  return [...grouped.values()]
    .map((row) => ({
      location_id: row.location_id,
      station_name: row.station_name,
      system_id: row.system_id,
      system_name: row.system_name,
      row_count: row.row_count,
      item_count: row.type_ids.size,
      units: row.units,
      capital_required: row.capital_required,
      period_profit: row.period_profit,
      avg_jumps: row.units > 0 ? row.jump_weight_total / row.units : 0,
    }))
    .sort((a, b) => b.period_profit - a.period_profit);
}

export function buildRadiusHubSummaries(results: FlipResult[]): {
  buyHubs: RadiusHubSummary[];
  sellHubs: RadiusHubSummary[];
} {
  return {
    buyHubs: summarize(results, "buy"),
    sellHubs: summarize(results, "sell"),
  };
}
