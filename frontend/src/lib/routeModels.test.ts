import { describe, expect, it } from "vitest";
import { filterRouteResultsByBanlistItems, normalizeRouteHop } from "@/lib/routeModels";

describe("routeModels", () => {
  it("migrates legacy single-item hop payloads to items[]", () => {
    const hop = normalizeRouteHop({
      SystemName: "Jita",
      StationName: "4-4",
      SystemID: 1,
      DestSystemName: "Amarr",
      DestSystemID: 2,
      TypeName: "Tritanium",
      TypeID: 34,
      BuyPrice: 10,
      SellPrice: 12,
      Units: 100,
      Profit: 200,
      Jumps: 1,
    });

    expect(hop.Items).toHaveLength(1);
    expect(hop.Items?.[0].TypeID).toBe(34);
    expect(hop.Items?.[0].Units).toBe(100);
  });

  it("filters banned items from nested hop items", () => {
    const filtered = filterRouteResultsByBanlistItems([
      {
        Hops: [{
          SystemName: "Jita",
          StationName: "4-4",
          SystemID: 1,
          DestSystemName: "Amarr",
          DestSystemID: 2,
          TypeName: "Tritanium",
          TypeID: 34,
          BuyPrice: 10,
          SellPrice: 12,
          Units: 100,
          Profit: 200,
          Jumps: 1,
          Items: [
            { TypeID: 34, TypeName: "Tritanium", Units: 100, BuyPrice: 10, SellPrice: 12, Profit: 200 },
            { TypeID: 35, TypeName: "Pyerite", Units: 50, BuyPrice: 8, SellPrice: 11, Profit: 150 },
          ],
        }],
        TotalProfit: 350,
        TotalJumps: 1,
        ProfitPerJump: 350,
        HopCount: 1,
      },
    ], { byId: { 34: true }, entries: [{ typeId: 34, typeName: "Tritanium" }] });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].Hops).toHaveLength(1);
    expect(filtered[0].Hops[0].Items).toHaveLength(1);
    expect(filtered[0].Hops[0].Items?.[0].TypeID).toBe(35);
    expect(filtered[0].TotalProfit).toBe(150);
    expect(filtered[0].ProfitPerJump).toBe(150);
  });
});
