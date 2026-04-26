import { describe, expect, it } from "vitest";
import { en } from "@/lib/locale/en";
import { ru } from "@/lib/locale/ru";
import { baseColumnDefs } from "@/components/ScanResultsTable";

const requiredKeys = [
  "colBatchNumber",
  "colBatchProfit",
  "colBatchTotalCapital",
  "colBatchIskPerJump",
  "colBuyJumps",
  "routeMaxJumps",
  "maxDetourJumpsPerNode",
  "advancedFilters",
  "routeSecurity",
  "batchBuilderTotalProfit",
  "batchBuilderTotalCapital",
  "batchBuilderManifestBuyStation",
  "batchBuilderManifestJumpsToBuyStation",
  "batchBuilderManifestSellStation",
  "batchBuilderManifestItems",
  "batchBuilderManifestTotalVolume",
  "batchBuilderManifestTotalCapital",
  "batchBuilderManifestTotalProfit",
  "batchBuilderManifestJumpsBuyToSell",
  "batchBuilderManifestTotalGrossSell",
  "batchBuilderManifestTotalIskPerJump",
  "batchBuilderManifestItemQty",
  "batchBuilderManifestItemBuyTotal",
  "batchBuilderManifestItemBuyPer",
  "batchBuilderManifestItemSellTotal",
  "batchBuilderManifestItemSellPer",
  "batchBuilderManifestItemVol",
  "batchBuilderManifestItemProfit",
  "colCargoUsedPct",
  "colDailyProfitOverCapital",
] as const;

describe("localization key sanity", () => {
  it("has required batch keys in both en and ru locales", () => {
    for (const key of requiredKeys) {
      expect(en).toHaveProperty(key);
      expect(ru).toHaveProperty(key);
    }
  });

  it("keeps distinct labels for distinct route-pack formulas", () => {
    expect(en.colCargoUsedPct).not.toBe(en.colCanFill);
    expect(en.colDailyProfitOverCapital).not.toBe(en.colROI);
    expect(ru.colCargoUsedPct).not.toBe(ru.colCanFill);
    expect(ru.colDailyProfitOverCapital).not.toBe(ru.colROI);
  });

  it("maps route-pack column keys to revised localization keys", () => {
    const cargoUsedColumn = baseColumnDefs.find((column) => column.key === "RoutePackCapacityUsedPercent");
    const dailyProfitOverCapitalColumn = baseColumnDefs.find(
      (column) => column.key === "RoutePackDailyProfitOverCapital",
    );
    const roiColumn = baseColumnDefs.find((column) => column.key === "RoutePackROI");

    expect(cargoUsedColumn?.labelKey).toBe("colCargoUsedPct");
    expect(dailyProfitOverCapitalColumn?.labelKey).toBe("colDailyProfitOverCapital");
    expect(roiColumn?.labelKey).toBe("colROI");
  });
});
