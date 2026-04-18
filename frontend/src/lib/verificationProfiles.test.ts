import { describe, expect, it } from "vitest";
import {
  DEFAULT_VERIFICATION_PROFILE_ID,
  getVerificationFreshness,
  getVerificationProfileById,
  verificationProfiles,
} from "@/lib/verificationProfiles";

describe("verificationProfiles", () => {
  it("preset validity and lookup", () => {
    const ids = verificationProfiles.map((profile) => profile.id);
    expect(ids).toEqual(expect.arrayContaining(["strict", "standard", "aggressive"]));

    const standard = getVerificationProfileById("standard");
    expect(standard.id).toBe("standard");

    const fallback = getVerificationProfileById("missing-id");
    expect(fallback.id).toBe(DEFAULT_VERIFICATION_PROFILE_ID);
  });

  it("freshness boundary cases", () => {
    const profile = getVerificationProfileById("standard");
    const now = new Date("2026-01-01T03:00:00.000Z");

    expect(getVerificationFreshness("2026-01-01T02:00:01.000Z", profile, now)).toBe("fresh");
    expect(getVerificationFreshness("2026-01-01T01:29:59.000Z", profile, now)).toBe("aging");
    expect(getVerificationFreshness("2025-12-31T23:59:59.000Z", profile, now)).toBe("stale");
  });
});
