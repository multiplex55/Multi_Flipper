import { describe, expect, it } from "vitest";
import { classifyVerificationPriority } from "@/lib/radiusVerificationPriority";

describe("classifyVerificationPriority", () => {
  it("flags high-profit long-jump aging rows as verify_now", () => {
    const result = classifyVerificationPriority({
      expectedProfitIsk: 60_000_000,
      totalJumps: 12,
      urgencyBand: "fragile",
      scanAgeMinutes: 15,
    });
    expect(result.priority).toBe("verify_now");
  });

  it("avoids overflagging stable local rows", () => {
    const result = classifyVerificationPriority({
      expectedProfitIsk: 2_000_000,
      totalJumps: 2,
      urgencyBand: "stable",
      scanAgeMinutes: 10,
    });
    expect(result.priority).toBe("normal");
  });

  it("returns stale after threshold", () => {
    const result = classifyVerificationPriority({
      expectedProfitIsk: 70_000_000,
      totalJumps: 12,
      urgencyBand: "fragile",
      scanAgeMinutes: 80,
      staleAfterMinutes: 45,
    });
    expect(result.priority).toBe("stale");
  });

  it("promotes priority when lens-updated jumps increase", () => {
    const baseline = classifyVerificationPriority({
      expectedProfitIsk: 8_000_000,
      totalJumps: 4,
      urgencyBand: "stable",
      scanAgeMinutes: 20,
      lensJumpDelta: 0,
    });
    const lensUpdated = classifyVerificationPriority({
      expectedProfitIsk: 8_000_000,
      totalJumps: 4,
      urgencyBand: "stable",
      scanAgeMinutes: 20,
      lensJumpDelta: 3,
    });
    expect(baseline.priority).toBe("normal");
    expect(lensUpdated.priority).toBe("watch");
  });
});
