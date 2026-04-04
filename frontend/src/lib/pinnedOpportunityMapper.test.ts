import { describe, expect, it } from "vitest";
import type { ContractResult, FlipResult, RegionalDayTradeItem, StationTrade } from "@/lib/types";
import {
  mapContractRowToPinnedOpportunity,
  mapRegionalRowToPinnedOpportunity,
  mapScanRowToPinnedOpportunity,
  mapStationRowToPinnedOpportunity,
} from "@/lib/pinnedOpportunityMapper";

describe("pinnedOpportunityMapper", () => {
  it("maps same logical scan/regional opportunity to deterministic key", () => {
    const scan = mapScanRowToPinnedOpportunity({
      TypeID: 34,
      TypeName: "Tritanium",
      Volume: 0.01,
      BuyPrice: 1,
      BuyStation: "Jita",
      BuySystemName: "Jita",
      BuySystemID: 30000142,
      BuyLocationID: 60003760,
      SellPrice: 2,
      SellStation: "Amarr",
      SellSystemName: "Amarr",
      SellSystemID: 30002187,
      SellLocationID: 60008494,
      ProfitPerUnit: 1,
      MarginPercent: 10,
      UnitsToBuy: 10,
      BuyOrderRemain: 10,
      SellOrderRemain: 10,
      TotalProfit: 100,
      ProfitPerJump: 10,
      BuyJumps: 0,
      SellJumps: 0,
      TotalJumps: 9,
      DailyVolume: 100,
      Velocity: 1,
      PriceTrend: 0,
      BuyCompetitors: 1,
      SellCompetitors: 1,
      DailyProfit: 10,
    } as FlipResult);

    const regional = mapRegionalRowToPinnedOpportunity({
      type_id: 34,
      type_name: "Tritanium",
      source_system_id: 30000142,
      source_system_name: "Jita",
      source_station_name: "Jita",
      source_location_id: 60003760,
      source_region_id: 10000002,
      source_region_name: "The Forge",
      target_system_id: 30002187,
      target_system_name: "Amarr",
      target_station_name: "Amarr",
      target_location_id: 60008494,
      target_region_id: 10000043,
      target_region_name: "Domain",
      purchase_units: 1,
      source_units: 1,
      target_demand_per_day: 1,
      target_supply_units: 1,
      target_dos: 1,
      assets: 0,
      active_orders: 0,
      source_avg_price: 1,
      target_now_price: 2,
      target_period_price: 2,
      target_now_profit: 1,
      target_period_profit: 1,
      roi_now: 1,
      roi_period: 1,
      capital_required: 1,
      item_volume: 1,
      shipping_cost: 1,
      jumps: 9,
      margin_now: 10,
      margin_period: 10,
    } as RegionalDayTradeItem);

    expect(scan.opportunity_key).toBe(regional.opportunity_key);
  });

  it("always includes required standardized fields", () => {
    const station = mapStationRowToPinnedOpportunity({ TypeID: 1, TypeName: "A", Volume: 1, BuyPrice: 1, SellPrice: 2, Spread: 1, MarginPercent: 1, ProfitPerUnit: 1, DailyVolume: 1, BuyOrderCount: 1, SellOrderCount: 1, BuyVolume: 1, SellVolume: 1, TotalProfit: 1, ROI: 1, StationName: "X", StationID: 99, CapitalRequired: 1, NowROI: 1, PeriodROI: 1, BuyUnitsPerDay: 1, SellUnitsPerDay: 1, BvSRatio: 1, DOS: 1, VWAP: 1, PVI: 1, OBDS: 1, SDS: 1, CI: 1, CTS: 1, AvgPrice: 1, PriceHigh: 1, PriceLow: 1, IsExtremePriceFlag: false, IsHighRiskFlag: false } as StationTrade);
    expect(station.opportunity_key.length).toBeGreaterThan(0);
    expect(station.metrics).toEqual(expect.objectContaining({ profit: expect.any(Number), margin: expect.any(Number), volume: expect.any(Number), route_risk: expect.any(Number) }));
  });

  it("normalizes null/optional numerics to zero", () => {
    const contract = mapContractRowToPinnedOpportunity({ ContractID: 12, Title: "c", Price: 1, MarketValue: 1, Profit: 1, MarginPercent: 1, Volume: 0, StationName: "Jita", ItemCount: 1, Jumps: 0, ProfitPerJump: 1, LiquidationJumps: undefined, ExpectedProfit: undefined, ExpectedMarginPercent: undefined } as ContractResult);
    expect(contract.metrics.route_risk).toBe(0);
  });

  it("does not include volatile ranking-like fields in key composition", () => {
    const base = {
      TypeID: 34,
      BuySystemID: 30000142,
      BuyLocationID: 60003760,
      SellSystemID: 30002187,
      SellLocationID: 60008494,
      TypeName: "Tritanium",
      BuyStation: "Jita",
      SellStation: "Amarr",
      MarginPercent: 10,
      DailyVolume: 100,
      TotalJumps: 9,
      Volume: 0.01,
      BuyPrice: 1,
      SellPrice: 2,
      ProfitPerUnit: 1,
      UnitsToBuy: 1,
      BuyOrderRemain: 1,
      SellOrderRemain: 1,
      TotalProfit: 1,
      ProfitPerJump: 1,
      BuyJumps: 0,
      SellJumps: 0,
      Velocity: 1,
      PriceTrend: 0,
      BuyCompetitors: 0,
      SellCompetitors: 0,
      DailyProfit: 1,
    } as FlipResult;
    const a = mapScanRowToPinnedOpportunity(base);
    const b = mapScanRowToPinnedOpportunity({
      ...base,
      DailyVolume: 9_999,
      TotalProfit: 999_999,
      MarginPercent: 1,
    } as FlipResult);
    expect(a.opportunity_key).toBe(b.opportunity_key);
  });
});
