import { describe, expect, it } from "vitest";
import { buildNormalizedRouteCopyManifest, formatNormalizedRouteCopyManifest } from "@/lib/routeManifestFormat";
import type { RouteResult } from "@/lib/types";

describe("route copy manifest formatter", () => {
  const route: RouteResult = {
    Hops: [
      {
        TypeID: 34,
        TypeName: "Tritanium",
        StationName: "Jita IV - Moon 4",
        SystemName: "Jita",
        DestSystemName: "Amarr",
        BuyPrice: 10,
        SellPrice: 20,
        Units: 10,
        Profit: 100,
        Jumps: 2,
        EmptyJumps: 1,
        SystemID: 30000142,
        DestSystemID: 30002187,
      },
      {
        TypeID: 35,
        TypeName: "Pyerite",
        StationName: "Amarr VIII (Oris) - Emperor Family Academy",
        SystemName: "Amarr",
        DestSystemName: "Dodixie",
        BuyPrice: 30,
        SellPrice: 45,
        Units: 5,
        Profit: 75,
        Jumps: 3,
        EmptyJumps: 0,
        SystemID: 30002187,
        DestSystemID: 30002659,
      },
    ],
    TotalProfit: 175,
    TotalJumps: 6,
    ProfitPerJump: 29.16,
    HopCount: 2,
    TargetSystemName: "Rens",
    TargetJumps: 4,
  };

  it("formats summary first, then separator, then hops in route order", () => {
    const text = formatNormalizedRouteCopyManifest(buildNormalizedRouteCopyManifest(route));
    const lines = text.split("\n");

    expect(lines[0]).toBe("Route: Jita -> Amarr -> Dodixie -> Rens");
    expect(lines[5]).toBe("---");
    expect(lines[6]).toBe("Hop 1");
    expect(lines).toContain("From: Jita IV - Moon 4");
    expect(lines).toContain("To: Amarr");
    expect(lines).toContain("Hop 2");
    expect(lines).toContain("From: Amarr VIII (Oris) - Emperor Family Academy");
    expect(lines).toContain("To: Dodixie");
  });

  it("omits removed legacy fragments", () => {
    const text = formatNormalizedRouteCopyManifest(buildNormalizedRouteCopyManifest(route));

    expect(text).not.toContain("=== EVE Flipper Route ===");
    expect(text).not.toContain("[1]");
    expect(text).not.toContain("Buy:");
    expect(text).not.toContain("→ ");
    expect(text).not.toContain("Sell: @");
  });

  it("can disable route summary output", () => {
    const text = formatNormalizedRouteCopyManifest(buildNormalizedRouteCopyManifest(route), { includeRouteSummary: false });
    expect(text.startsWith("Hop 1")).toBe(true);
    expect(text).not.toContain("Route:");
    expect(text).not.toContain("---");
  });
});
