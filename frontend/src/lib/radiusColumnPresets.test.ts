import { describe, expect, it } from "vitest";
import { radiusColumnPresetById, radiusColumnPresets } from "@/lib/radiusColumnPresets";
import { radiusColumnRegistryByKey } from "@/lib/radiusColumnRegistry";

describe("radiusColumnPresets", () => {
  it("defines expected presets", () => {
    expect(radiusColumnPresets.map((preset) => preset.id)).toEqual([
      "scout",
      "route",
      "cargo",
      "execute",
      "audit",
    ]);
  });

  it("contains only registry-backed columns and sort keys", () => {
    for (const preset of radiusColumnPresets) {
      for (const key of preset.columns) {
        expect(radiusColumnRegistryByKey[key]).toBeDefined();
      }
      expect(radiusColumnRegistryByKey[preset.defaultSort.key]).toBeDefined();
    }
  });

  it("indexes presets by id", () => {
    expect(radiusColumnPresetById.execute.label).toBe("Execute");
    expect(radiusColumnPresetById.audit.defaultSort.dir).toBe("asc");
  });
});
