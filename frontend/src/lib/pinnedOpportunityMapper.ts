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
    source_label: "Scan",
    opportunity_key: `flip:${row.TypeID}:${buyLocationID}:${sellLocationID}`,
    type_id: row.TypeID,
    type_name: row.TypeName,
    buy_system_id: row.BuySystemID,
    buy_system_name: row.BuySystemName,
    sell_system_id: row.SellSystemID,
    sell_system_name: row.SellSystemName,
    buy_location_id: buyLocationID,
    sell_location_id: sellLocationID,
    buy_region_id: row.BuyRegionID,
    sell_region_id: row.SellRegionID,
    buy_station_name: row.BuyStation,
    sell_station_name: row.SellStation,
    buy_label: row.BuyStation || row.BuySystemName || `Location #${buyLocationID}`,
    sell_label: row.SellStation || row.SellSystemName || `Location #${sellLocationID}`,
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
    source_label: "Station",
    opportunity_key: `station:${row.TypeID}:${stationID}`,
    type_id: row.TypeID,
    type_name: row.TypeName,
    station_id: stationID,
    system_id: row.SystemID,
    region_id: row.RegionID,
    buy_station_name: row.StationName,
    buy_label: row.StationName || (row.SystemID ? `Location #${row.SystemID}` : `Location #${stationID}`),
    sell_label: row.StationName || (row.SystemID ? `Location #${row.SystemID}` : `Location #${stationID}`),
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
    source_label: "Regional",
    opportunity_key: `flip:${row.type_id}:${buyLocationID}:${sellLocationID}`,
    type_id: row.type_id,
    type_name: row.type_name,
    buy_system_id: row.source_system_id,
    buy_system_name: row.source_system_name,
    sell_system_id: row.target_system_id,
    sell_system_name: row.target_system_name,
    buy_location_id: buyLocationID,
    sell_location_id: sellLocationID,
    buy_region_id: row.source_region_id,
    sell_region_id: row.target_region_id,
    buy_station_name: row.source_station_name,
    sell_station_name: row.target_station_name,
    buy_label: row.source_station_name || row.source_system_name || `Location #${buyLocationID}`,
    sell_label: row.target_station_name || row.target_system_name || `Location #${sellLocationID}`,
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
    source_label: "Contracts",
    opportunity_key: `contract:${row.ContractID}`,
    type_id: 0,
    type_name: row.Title,
    contract_id: row.ContractID,
    buy_station_name: row.StationName,
    buy_system_name: row.SystemName,
    region_name: row.RegionName,
    buy_label: row.StationName || row.SystemName || `Location #${row.ContractID}`,
    sell_label: row.LiquidationSystemName || row.LiquidationRegionName || row.RegionName || `Location #${row.ContractID}`,
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
