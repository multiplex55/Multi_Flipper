import { describe, expect, it } from "vitest";
import { getPinnedOpportunityLabels } from "@/lib/pinnedOpportunityLabels";
import type { PinnedOpportunityRecord } from "@/lib/types";

function row(payload: Record<string, unknown>): PinnedOpportunityRecord {
  return {
    user_id: "u",
    opportunity_key: "k",
    tab: "scan",
    payload_json: JSON.stringify(payload),
    created_at: "2026-04-04T00:00:00Z",
    updated_at: "2026-04-04T00:00:00Z",
    payload: payload as never,
  };
}

describe("getPinnedOpportunityLabels", () => {
  it("prefers explicit names and source label", () => {
    const labels = getPinnedOpportunityLabels(
      row({
        source: "scan",
        source_label: "Scan",
        type_id: 34,
        type_name: "Tritanium",
        buy_label: "Jita IV - Moon 4",
        sell_label: "Amarr VIII",
      }),
    );
    expect(labels.itemLabel).toBe("Tritanium");
    expect(labels.sourceLabel).toBe("Scan");
    expect(labels.buyLabel).toBe("Jita IV - Moon 4");
    expect(labels.sellLabel).toBe("Amarr VIII");
  });

  it("falls back to deterministic type and location ids", () => {
    const labels = getPinnedOpportunityLabels(
      row({
        source: "station",
        type_id: 999,
        station_id: 60003760,
      }),
    );
    expect(labels.itemLabel).toBe("TypeID #999");
    expect(labels.buyLabel).toContain("Location #60003760");
    expect(labels.sellLabel).toContain("Location #Unknown");
  });

  it("uses metadata names when typed labels are absent", () => {
    const labels = getPinnedOpportunityLabels(
      row({
        source: "contracts",
        contract_id: 123,
        metadata: { title: "Navy Omen", station_name: "Jita", region_name: "The Forge" },
      }),
    );
    expect(labels.itemLabel).toBe("Navy Omen");
    expect(labels.buyLabel).toContain("Jita");
    expect(labels.sellLabel).toContain("The Forge");
  });
});
