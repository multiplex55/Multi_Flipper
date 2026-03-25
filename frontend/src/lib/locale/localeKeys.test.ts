import { describe, expect, it } from "vitest";
import { en } from "@/lib/locale/en";
import { ru } from "@/lib/locale/ru";

const requiredKeys = [
  "colBatchNumber",
  "colBatchProfit",
  "colBatchTotalCapital",
  "batchBuilderTotalProfit",
  "batchBuilderTotalCapital",
] as const;

describe("localization key sanity", () => {
  it("has required batch keys in both en and ru locales", () => {
    for (const key of requiredKeys) {
      expect(en).toHaveProperty(key);
      expect(ru).toHaveProperty(key);
    }
  });
});
