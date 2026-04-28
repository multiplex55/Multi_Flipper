import { aggregateDurations, resetPerfMetrics } from "@/lib/radiusDiagnostics";
import { describe, expect, it } from "vitest";

describe("radiusDiagnostics", () => {
  it("aggregates timer samples", () => {
    expect(aggregateDurations([1.5, 2.5, 3])).toEqual({
      totalMs: 7,
      averageMs: 7 / 3,
      maxMs: 3,
    });
  });

  it("returns zeroed aggregation for empty samples", () => {
    expect(aggregateDurations([])).toEqual({ totalMs: 0, averageMs: 0, maxMs: 0 });
  });

  it("resets metrics with hidden-friendly defaults", () => {
    expect(resetPerfMetrics()).toEqual({
      rowsScanned: 0,
      rowsVisible: 0,
      renderRowCount: 0,
      filterTimeMs: 0,
      sortTimeMs: 0,
      lastScanDurationMs: null,
      lastScanTimestampMs: null,
      cacheAgeMs: null,
      cacheHitCount: null,
      cacheMissCount: null,
    });
  });
});
