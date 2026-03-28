import { describe, expect, it } from "vitest";

import {
  compareBatchToExport,
  normalizeItemName,
  parseBatchManifestLine,
  parseExportOrderLine,
  type ToleranceSettings,
} from "@/lib/batchBuyVerifier";

const strictTolerance: ToleranceSettings = {
  mode: "strict",
  iskSlippageTolerance: 0,
  percentSlippageTolerance: 0,
  quantityMode: "require_exact",
};

describe("batch buy verifier parsing", () => {
  it("parses manifest required + optional fields", () => {
    const parsed = parseBatchManifestLine("  Heavy   Water  | qty 10 | buy 12000 | sell 15000 | note route-a ");
    expect(parsed).toEqual({
      rawName: "Heavy   Water",
      name: "Heavy Water",
      plannedQuantity: 10,
      targetBuyPer: 12000,
      optionalFields: { sell: "15000", note: "route-a" },
    });
  });

  it("parses export tab format and ignores Total: summary row", () => {
    expect(parseExportOrderLine("Total:\t30\t100000\t-")).toBeNull();
    const parsed = parseExportOrderLine("Heavy Water\t10\t12,100\tJita");
    expect(parsed).toMatchObject({ name: "Heavy Water", actualQuantity: 10, actualBuyPer: 12100 });
  });

  it("normalizes trim + whitespace collapse while preserving case", () => {
    expect(normalizeItemName("  Republic   Fleet   EMP S  ")).toBe("Republic Fleet EMP S");
    expect(normalizeItemName("REPUBLIC FLEET EMP S")).not.toBe("Republic Fleet EMP S");
  });
});

describe("batch buy verifier decision precedence and tolerance", () => {
  it("same item higher actual buy-per => do_not_buy", () => {
    const planned = [parseBatchManifestLine("Item A | qty 5 | buy 100")!];
    const actual = [parseExportOrderLine("Item A\t5\t101")!];

    const result = compareBatchToExport(planned, actual, strictTolerance);
    expect(result.rows[0]?.state).toBe("do_not_buy");
    expect(result.summary.doNotBuyCount).toBe(1);
  });

  it("do_not_buy precedes quantity_mismatch when both conditions are true", () => {
    const planned = [parseBatchManifestLine("Item B | qty 10 | buy 200")!];
    const actual = [parseExportOrderLine("Item B\t8\t220")!];

    const result = compareBatchToExport(planned, actual, strictTolerance);
    expect(result.rows[0]?.state).toBe("do_not_buy");
    expect(result.summary.quantityMismatchCount).toBe(0);
  });

  it("quantity mismatch is ignored when quantity mode is ignore_mismatch", () => {
    const planned = [parseBatchManifestLine("Item C | qty 10 | buy 300")!];
    const actual = [parseExportOrderLine("Item C\t9\t300")!];

    const result = compareBatchToExport(planned, actual, {
      ...strictTolerance,
      quantityMode: "ignore_mismatch",
    });
    expect(result.rows[0]?.state).toBe("safe");
  });

  it("ISK and percent slippage tolerances allow bounded buy-per overages", () => {
    const planned = [parseBatchManifestLine("Item D | qty 4 | buy 100")!];

    const iskWithin = compareBatchToExport(
      planned,
      [parseExportOrderLine("Item D\t4\t104")!],
      { ...strictTolerance, mode: "isk_slippage", iskSlippageTolerance: 5 },
    );
    expect(iskWithin.rows[0]?.state).toBe("safe");

    const pctWithin = compareBatchToExport(
      planned,
      [parseExportOrderLine("Item D\t4\t102")!],
      { ...strictTolerance, mode: "percent_slippage", percentSlippageTolerance: 2 },
    );
    expect(pctWithin.rows[0]?.state).toBe("safe");

    const pctOutside = compareBatchToExport(
      planned,
      [parseExportOrderLine("Item D\t4\t103")!],
      { ...strictTolerance, mode: "percent_slippage", percentSlippageTolerance: 2 },
    );
    expect(pctOutside.rows[0]?.state).toBe("do_not_buy");
  });

  it("marks missing and unexpected items with mutually exclusive states", () => {
    const planned = [parseBatchManifestLine("Item E | qty 1 | buy 100")!];
    const actual = [parseExportOrderLine("Item X\t1\t100")!];

    const result = compareBatchToExport(planned, actual, strictTolerance);
    const states = result.rows.map((row) => row.state).sort();
    expect(states).toEqual(["missing_from_export", "unexpected_in_export"]);
    expect(result.summary.missingCount).toBe(1);
    expect(result.summary.unexpectedCount).toBe(1);
  });
});
