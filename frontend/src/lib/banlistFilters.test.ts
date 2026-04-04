import { describe, expect, it } from "vitest";
import { filterContractResults, filterFlipResults, filterRouteResults, filterRowsByBannedStationIDs, filterRowsByBannedTypeIDs, filterStationTrades } from "@/lib/banlistFilters";
import type { ContractResult, FlipResult, RouteResult, StationTrade } from "@/lib/types";

describe("banlistFilters", () => {
  it("filters flip rows by type and station without mutating source", () => {
    const rows: FlipResult[] = [
      { TypeID: 1, TypeName: "A", Volume: 1, BuyPrice: 1, BuyStation: "B", BuySystemName: "S", BuySystemID: 1, BuyLocationID: 100, SellPrice: 2, SellStation: "C", SellSystemName: "S2", SellSystemID: 2, SellLocationID: 200, ProfitPerUnit: 1, MarginPercent: 1, UnitsToBuy: 1, BuyOrderRemain: 1, SellOrderRemain: 1, TotalProfit: 1, ProfitPerJump: 1, BuyJumps: 1, SellJumps: 1, TotalJumps: 1, DailyVolume: 1, Velocity: 1, PriceTrend: 1, BuyCompetitors: 1, SellCompetitors: 1, DailyProfit: 1 },
      { TypeID: 2, TypeName: "B", Volume: 1, BuyPrice: 1, BuyStation: "B", BuySystemName: "S", BuySystemID: 1, BuyLocationID: 101, SellPrice: 2, SellStation: "C", SellSystemName: "S2", SellSystemID: 2, SellLocationID: 201, ProfitPerUnit: 1, MarginPercent: 1, UnitsToBuy: 1, BuyOrderRemain: 1, SellOrderRemain: 1, TotalProfit: 1, ProfitPerJump: 1, BuyJumps: 1, SellJumps: 1, TotalJumps: 1, DailyVolume: 1, Velocity: 1, PriceTrend: 1, BuyCompetitors: 1, SellCompetitors: 1, DailyProfit: 1 },
    ];

    const filtered = filterFlipResults(rows, [1], [201]);
    expect(filtered).toHaveLength(0);
    expect(rows).toHaveLength(2);
  });

  it("filters route results by banned hop type and stations", () => {
    const routes: RouteResult[] = [
      {
        Hops: [{ TypeID: 55, TypeName: "X", StationName: "A", SystemName: "S", SystemID: 1, DestSystemName: "S2", DestSystemID: 2, DestStationName: "B", BuyPrice: 1, SellPrice: 2, Units: 1, Profit: 1, Jumps: 1, LocationID: 900001, DestLocationID: 900002 } as never],
        TotalProfit: 10,
        TotalJumps: 2,
        ProfitPerJump: 5,
        HopCount: 1,
      },
      {
        Hops: [{ TypeID: 99, TypeName: "Y", StationName: "A", SystemName: "S", SystemID: 1, DestSystemName: "S2", DestSystemID: 2, DestStationName: "B", BuyPrice: 1, SellPrice: 2, Units: 1, Profit: 1, Jumps: 1, LocationID: 900003, DestLocationID: 900004 } as never],
        TotalProfit: 10,
        TotalJumps: 2,
        ProfitPerJump: 5,
        HopCount: 1,
      },
    ];

    const filtered = filterRouteResults(routes, [55], [900004]);
    expect(filtered).toHaveLength(0);
  });

  it("filters station trades by station id", () => {
    const rows = [
      { TypeID: 1, TypeName: "A", StationID: 300, StationName: "Keep", Volume: 1 } as StationTrade,
      { TypeID: 2, TypeName: "B", StationID: 301, StationName: "Drop", Volume: 1 } as StationTrade,
    ];
    const filtered = filterStationTrades(rows, [], [301]);
    expect(filtered.map((row) => row.TypeID)).toEqual([1]);
  });

  it("filters contract rows using StationID-like field", () => {
    const rows = [
      { ContractID: 1, Title: "A", Price: 1, MarketValue: 2, Profit: 1, MarginPercent: 1, Volume: 1, StationName: "A", ItemCount: 1, Jumps: 1, ProfitPerJump: 1, StationID: 700 } as ContractResult,
      { ContractID: 2, Title: "B", Price: 1, MarketValue: 2, Profit: 1, MarginPercent: 1, Volume: 1, StationName: "B", ItemCount: 1, Jumps: 1, ProfitPerJump: 1, StationID: 701 } as ContractResult,
    ];
    expect(filterContractResults(rows, [701]).map((row) => row.ContractID)).toEqual([1]);
  });

  it("supports generic snake_case helpers", () => {
    const rows = [{ type_id: 10, buy_location_id: 20 }, { type_id: 11, buy_location_id: 21 }];
    expect(filterRowsByBannedTypeIDs(rows, [10])).toEqual([{ type_id: 11, buy_location_id: 21 }]);
    expect(filterRowsByBannedStationIDs(rows, [21])).toEqual([{ type_id: 10, buy_location_id: 20 }]);
  });
});
