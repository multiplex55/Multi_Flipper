import type { ContractResult, FlipResult, RegionalDayTradeItem, StationTrade } from "@/lib/types";
import type { PinnedOpportunityPayload } from "@/lib/types";

function finite(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function mapScanRowToPinnedOpportunity(row: FlipResult): PinnedOpportunityPayload {
  const buyLocationID = row.BuyLocationID && row.BuyLocationID > 0 ? row.BuyLocationID : row.BuySystemID;
  const sellLocationID = row.SellLocationID && row.SellLocationID > 0 ? row.SellLocationID : row.SellSystemID;
  return {
    source: "scan",
    opportunity_key: `flip:${row.TypeID}:${buyLocationID}:${sellLocationID}`,
    type_id: row.TypeID,
    buy_system_id: row.BuySystemID,
    sell_system_id: row.SellSystemID,
    buy_location_id: buyLocationID,
    sell_location_id: sellLocationID,
    buy_region_id: row.BuyRegionID,
    sell_region_id: row.SellRegionID,
    metrics: {
      profit: finite(row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit),
      margin: finite(row.RealMarginPercent ?? row.MarginPercent),
      volume: finite(row.DailyVolume),
      route_risk: finite(row.TotalJumps),
    },
    metadata: {
      type_name: row.TypeName,
      buy_station_name: row.BuyStation,
      sell_station_name: row.SellStation,
    },
  };
}

export function mapStationRowToPinnedOpportunity(row: StationTrade): PinnedOpportunityPayload {
  const stationID = row.StationID && row.StationID > 0 ? row.StationID : (row.SystemID ?? 0);
  return {
    source: "station",
    opportunity_key: `station:${row.TypeID}:${stationID}`,
    type_id: row.TypeID,
    station_id: stationID,
    system_id: row.SystemID,
    region_id: row.RegionID,
    metrics: {
      profit: finite(row.ExpectedProfit ?? row.RealProfit ?? row.DailyProfit ?? row.TotalProfit),
      margin: finite(row.RealMarginPercent ?? row.MarginPercent),
      volume: finite(row.DailyVolume),
      route_risk: finite(row.SDS),
    },
    metadata: {
      type_name: row.TypeName,
      station_name: row.StationName,
    },
  };
}

export function mapRegionalRowToPinnedOpportunity(row: RegionalDayTradeItem): PinnedOpportunityPayload {
  const buyLocationID = row.source_location_id > 0 ? row.source_location_id : row.source_system_id;
  const sellLocationID = row.target_location_id > 0 ? row.target_location_id : row.target_system_id;
  return {
    source: "regional_day",
    opportunity_key: `flip:${row.type_id}:${buyLocationID}:${sellLocationID}`,
    type_id: row.type_id,
    buy_system_id: row.source_system_id,
    sell_system_id: row.target_system_id,
    buy_location_id: buyLocationID,
    sell_location_id: sellLocationID,
    buy_region_id: row.source_region_id,
    sell_region_id: row.target_region_id,
    metrics: {
      profit: finite(row.target_now_profit),
      margin: finite(row.margin_now),
      volume: finite(row.target_demand_per_day),
      route_risk: finite(row.jumps),
    },
    metadata: {
      type_name: row.type_name,
      source_system_name: row.source_system_name,
      target_system_name: row.target_system_name,
    },
  };
}

export function mapContractRowToPinnedOpportunity(row: ContractResult): PinnedOpportunityPayload {
  return {
    source: "contracts",
    opportunity_key: `contract:${row.ContractID}`,
    type_id: 0,
    contract_id: row.ContractID,
    metrics: {
      profit: finite(row.ExpectedProfit ?? row.Profit),
      margin: finite(row.ExpectedMarginPercent ?? row.MarginPercent),
      volume: finite(row.Volume),
      route_risk: finite(row.LiquidationJumps ?? row.Jumps),
    },
    metadata: {
      title: row.Title,
      station_name: row.StationName,
      region_name: row.RegionName,
    },
  };
}
