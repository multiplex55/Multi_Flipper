import { describe, expect, it } from "vitest";
import { radiusDecisionModeById, radiusDecisionModes } from "@/lib/radiusDecisionModes";
import { radiusColumnPresetById } from "@/lib/radiusColumnPresets";

describe("radiusDecisionModes", () => {
  it("defines five workflow modes", () => {
    expect(radiusDecisionModes).toHaveLength(5);
    expect(radiusDecisionModes.map((mode) => mode.id)).toEqual([
      "scout",
      "route",
      "cargo",
      "execute",
      "audit",
    ]);
  });

  it("links each mode to a known preset", () => {
    for (const mode of radiusDecisionModes) {
      expect(radiusColumnPresetById[mode.presetId]).toBeDefined();
    }
  });

  it("exposes queue and verification emphasis for execute mode", () => {
    expect(radiusDecisionModeById.execute.visibility.queue).toBe("emphasize");
    expect(radiusDecisionModeById.execute.visibility.verification).toBe("emphasize");
  });
});
