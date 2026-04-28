import { describe, expect, it } from "vitest";
import { evaluateInventorySell } from "@/lib/inventorySellEvaluator";
import type { ClipboardInventoryLine } from "@/lib/clipboardSellList";
import { makeFlipResult } from "@/lib/testFixtures";

const item = (name: string, quantity: number): ClipboardInventoryLine => ({
  lineNumber: 1,
  rawLine: `${name}\t${quantity}`,
  name,
  originalName: name,
  quantity,
});

const row = (name: string, overrides = {}) =>
  makeFlipResult({ TypeName: name, BuyPrice: 100, BuyOrderRemain: 1000, Volume: 2, BuySystemName: "Jita", BuyStation: "Jita 4-4", BuySystemID: 300001, ...overrides });

describe("evaluateInventorySell", () => {
  it("chooses highest net sell destination", () => {
    const result = evaluateInventorySell([item("A", 10)], [row("A", { BuyPrice: 120, BuyStation: "A" }), row("A", { BuyPrice: 200, BuyStation: "B" })]);
    expect(result.items[0].best?.stationName).toBe("B");
  });
  it("jita comparison correctness", () => {
    const result = evaluateInventorySell([item("A", 10)], [row("A", { BuyPrice: 150, BuySystemName: "Amarr" }), row("A", { BuyPrice: 100, BuySystemName: "Jita" })], { compareJita: true });
    expect(result.items[0].jitaBaselineIsk).toBe(1000);
    expect(result.items[0].upliftIsk).toBe(500);
  });
  it("low confidence when depth insufficient", () => {
    const result = evaluateInventorySell([item("A", 100)], [row("A", { BuyOrderRemain: 10 })], { requireDepthCoverage: true });
    expect(result.items[0].confidence).toBe("low");
  });
  it("unresolved items path", () => {
    const result = evaluateInventorySell([item("Missing", 1)], [row("A")]);
    expect(result.unresolvedItems).toHaveLength(1);
  });
  it("zero/empty market data path", () => {
    const result = evaluateInventorySell([item("A", 1)], []);
    expect(result.items[0].resolved).toBe(false);
  });
  it("total volume calculations", () => {
    const result = evaluateInventorySell([item("A", 5)], [row("A", { Volume: 3 })]);
    expect(result.items[0].volumeM3).toBe(15);
  });
  it("grouping by best station", () => {
    const result = evaluateInventorySell([item("A", 1), item("B", 1)], [row("A", { BuyStation: "X", BuyLocationID: 1 }), row("B", { BuyStation: "X", BuyLocationID: 1 })]);
    expect(result.summaries).toHaveLength(1);
  });
});
