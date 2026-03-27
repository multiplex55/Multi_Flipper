import { describe, expect, it } from "vitest";
import { en } from "@/lib/locale/en";
import { ru } from "@/lib/locale/ru";

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
] as const;

describe("localization key sanity", () => {
  it("has required batch keys in both en and ru locales", () => {
    for (const key of requiredKeys) {
      expect(en).toHaveProperty(key);
      expect(ru).toHaveProperty(key);
    }
  });
});
