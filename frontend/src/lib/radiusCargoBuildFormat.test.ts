import { describe, expect, it } from "vitest";
import type { FlipResult } from "@/lib/types";
import type { RadiusCargoBuild } from "@/lib/radiusCargoBuilds";
import {
  formatRadiusCargoBuildBuyChecklist,
  formatRadiusCargoBuildManifest,
  formatRadiusCargoBuildSellChecklist,
} from "@/lib/radiusCargoBuildFormat";

function makeRow(typeName: string, typeId: number): FlipResult {
  return {
    TypeID: typeId,
    TypeName: typeName,
    BuySystemName: "Jita",
    SellSystemName: "Amarr",
    BuyStation: "Jita 4-4",
    SellStation: "Amarr VIII",
    UnitsToBuy: 10,
    Volume: 1,
    BuyPrice: 100,
    SellPrice: 120,
    ProfitPerUnit: 20,
  } as FlipResult;
}

function makeBuild(): RadiusCargoBuild {
  return {
    id: "route-a:viator_safe",
    routeKey: "route-a",
    routeLabel: "Jita → Amarr",
    rowCount: 2,
    totalProfitIsk: 5000,
    totalCapitalIsk: 20000,
    totalCargoM3: 80,
    totalGrossSellIsk: 25000,
    jumps: 5,
    iskPerJump: 1000,
    jumpEfficiency: 0.8,
    capitalEfficiency: 0.25,
    cargoFillPercent: 40,
    confidencePercent: 72,
    executionQuality: 66,
    riskCount: 1,
    riskRate: 0.2,
    riskCue: "low",
    executionCue: "watch",
    finalScore: 88,
    rows: [makeRow("Beta", 2), makeRow("Alpha", 1)],
    lines: [
      {
        row: makeRow("Beta", 2),
        units: 3,
        volumeM3: 30,
        capitalIsk: 900,
        profitIsk: 300,
        grossSellIsk: 1200,
        partial: false,
      },
      {
        row: makeRow("Alpha", 1),
        units: 5,
        volumeM3: 50,
        capitalIsk: 500,
        profitIsk: 200,
        grossSellIsk: 700,
        partial: true,
      },
    ],
  };
}

describe("radiusCargoBuildFormat", () => {
  it("formats manifest/checklists using deterministic line sequence", () => {
    const build = makeBuild();

    const manifest = formatRadiusCargoBuildManifest(build);
    const betaIndex = manifest.indexOf("1. Beta");
    const alphaIndex = manifest.indexOf("2. Alpha");

    expect(betaIndex).toBeGreaterThan(-1);
    expect(alphaIndex).toBeGreaterThan(betaIndex);
    expect(manifest).toContain("Totals: 2 lines");
  });

  it("includes partial marker and footer totals in buy/sell checklists", () => {
    const build = makeBuild();

    const buy = formatRadiusCargoBuildBuyChecklist(build);
    const sell = formatRadiusCargoBuildSellChecklist(build);

    expect(buy).toContain("BUY Alpha x5");
    expect(buy).toContain("(partial)");
    expect(sell).toContain("SELL Alpha x5");
    expect(sell).toContain("expected profit");
    expect(sell).toContain("Totals: 2 lines");
  });
});
