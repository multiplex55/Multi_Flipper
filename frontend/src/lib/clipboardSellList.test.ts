import { describe, expect, it } from "vitest";
import { parseClipboardSellList } from "@/lib/clipboardSellList";

describe("parseClipboardSellList", () => {
  it("parses tab format", () => {
    const out = parseClipboardSellList("Tritanium\t10");
    expect(out.items[0]).toMatchObject({ name: "Tritanium", quantity: 10 });
  });
  it("parses multi-space format", () => {
    const out = parseClipboardSellList("Pyerite    25");
    expect(out.items[0].quantity).toBe(25);
  });
  it("parses comma qty", () => {
    const out = parseClipboardSellList("Mexallon\t1,000");
    expect(out.items[0].quantity).toBe(1000);
  });
  it("handles invalid qty", () => {
    const out = parseClipboardSellList("Isogen\t0\nNocxium\t-1\nZydrine\tfoo");
    expect(out.errors).toHaveLength(3);
  });
  it("ignores blank lines", () => {
    const out = parseClipboardSellList("\n\nMorphite\t2\n");
    expect(out.items).toHaveLength(1);
  });
  it("merges duplicates", () => {
    const out = parseClipboardSellList("Tritanium\t1\ntritanium\t2", { mergeDuplicates: true });
    expect(out.items).toHaveLength(1);
    expect(out.items[0].quantity).toBe(3);
  });
  it("supports names with numbers", () => {
    const out = parseClipboardSellList("100mm Steel Plates II\t3");
    expect(out.items[0].name).toBe("100mm Steel Plates II");
  });
});
